// lib/inngest/research.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildFindingsSchema} from "@/features/research/schema-build"
import {computeApply, toLeadUpdate} from "@/features/research/apply"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"
import {runResearch} from "@/features/research/engine"
import {resolveModel} from "@/features/research/model"
import type {OutputField} from "@/features/research-types/schema"
import type {Prisma} from "@/generated/prisma/client"

async function emailTakenFor(orgId: string, leadId: string, fields: OutputField[], findings: Record<string, unknown>): Promise<boolean> {
	const field = fields.find((f) => f.target === "email")
	if (!field) return false
	const raw = findings[field.key]
	const email = typeof raw === "string" ? raw.trim().toLowerCase() : ""
	if (!email) return false
	const other = await prisma.lead.findFirst({where: {organizationId: orgId, email, id: {not: leadId}}, select: {id: true}})
	return Boolean(other)
}

export const runResearchFn = inngest.createFunction(
	{id: "run-research", triggers: {event: "research/run.requested"}, concurrency: {limit: 3, key: "event.data.organizationId"}, retries: 2},
	async ({event, step}) => {
		const {runId} = event.data as {runId: string}
		const run = await prisma.researchRun.findUnique({where: {id: runId}, include: {lead: true, researchType: true}})
		if (!run || !run.lead || !run.researchType) {
			if (run) await prisma.researchRun.update({where: {id: runId}, data: {status: "FAILED", error: "Brak typu researchu lub leada", completedAt: new Date()}})
			return {skipped: true}
		}
		const researchType = run.researchType
		const lead = run.lead
		await step.run("mark-running", () => prisma.researchRun.update({where: {id: runId}, data: {status: "RUNNING"}}))

		const fields = (researchType.outputFields as OutputField[]) ?? []
		const placeholders = await prisma.placeholder.findMany({where: {organizationId: run.organizationId}, select: {key: true, source: true, fallback: true}})

		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			return runResearch({renderedPrompt: buildResearchPrompt(researchType.prompt, ctx), inputSchema: buildFindingsSchema(fields), modelId: researchType.modelId, webSearchEnabled: researchType.webSearchEnabled})
		})

		if (!result.ok) {
			await prisma.researchRun.update({where: {id: runId}, data: {status: "FAILED", error: result.error, completedAt: new Date()}})
			return {ok: false}
		}

		const emailTaken = await emailTakenFor(run.organizationId, run.leadId, fields, result.findings)
		const diff = computeApply({lead, fields, findings: result.findings, mode: run.mode, emailTaken})

		if (diff.applied.length > 0) {
			const existing = (lead.customFields as Record<string, string> | null) ?? {}
			const {data, customFields} = toLeadUpdate(diff.applied, existing)
			await step.run("apply", () => prisma.lead.updateMany({where: {id: run.leadId, organizationId: run.organizationId}, data: {...data, customFields}}))
		}

		await step.run("finish", () =>
			prisma.$transaction([
				prisma.researchRun.update({
					where: {id: runId},
					data: {status: "DONE", findings: result.findings as Prisma.InputJsonValue, diff: diff as unknown as Prisma.InputJsonValue, modelId: resolveModel(researchType.modelId), completedAt: new Date()},
				}),
				prisma.leadActivity.create({
					data: {organizationId: run.organizationId, leadId: run.leadId, kind: "RESEARCH", body: `Research "${run.researchTypeName}": ${diff.applied.length} zastosowane, ${diff.proposed.length} propozycje, ${diff.skipped.length} pominięte`, authorUserId: run.createdById},
				}),
			]),
		)
		return {ok: true, applied: diff.applied.length}
	},
)
