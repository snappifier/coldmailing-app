import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildFindingsSchema} from "@/features/research/schema-build"
import {computeApply, toLeadUpdate} from "@/features/research/apply"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"
import {runResearch} from "@/features/research/engine"
import {buildLeadContextBlock} from "@/features/research/lead-context"
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
	{
		id: "run-research",
		triggers: {event: "research/run.requested"},
		concurrency: {limit: 3, key: "event.data.organizationId"},
		retries: 3,
		onFailure: async ({event, error}: {event: {data: {event: {data: {runId?: string}}}}; error: unknown}) => {
			const runId = event.data.event.data.runId
			if (!runId) return
			await prisma.researchRun.updateMany({
				where: {id: runId, status: {notIn: ["DONE", "FAILED", "CANCELLED"]}},
				data: {status: "FAILED", error: String(error).slice(0, 500), completedAt: new Date()},
			})
		},
	},
	async ({event, step}) => {
		const {runId} = event.data as {runId: string}
		const run = await prisma.researchRun.findUnique({where: {id: runId}, include: {lead: true, researchType: true}})
		if (!run) return {skipped: true}
		// Best-effort cancellation: a batch cancel sets still-QUEUED runs CANCELLED before they execute.
		if (run.status === "CANCELLED") return {skipped: "cancelled"}
		if (!run.lead || !run.researchType || run.researchType.organizationId !== run.organizationId || run.lead.organizationId !== run.organizationId) {
			await prisma.researchRun.update({where: {id: runId}, data: {status: "FAILED", error: "Brak typu/leada lub niezgodność organizacji", completedAt: new Date()}})
			return {skipped: true}
		}
		const researchType = run.researchType
		const lead = run.lead
		await step.run("mark-running", () => prisma.researchRun.update({where: {id: runId}, data: {status: "RUNNING"}}))

		// Prefer the per-run snapshot (batch runs) so an edit to the type mid-batch is not picked up;
		// single 2b runs have no snapshot and read the live type exactly as before.
		const useSnapshot = run.promptSnapshot != null
		const fields = ((useSnapshot ? run.outputFieldsSnapshot : researchType.outputFields) as OutputField[]) ?? []
		const prompt = useSnapshot ? run.promptSnapshot! : researchType.prompt
		const webSearchEnabled = useSnapshot ? Boolean(run.webSearchEnabledSnapshot) : researchType.webSearchEnabled
		const modelId = useSnapshot ? run.modelIdSnapshot : researchType.modelId

		const placeholders = await prisma.placeholder.findMany({where: {organizationId: run.organizationId}, select: {key: true, source: true, fallback: true}})

		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			const base = buildResearchPrompt(prompt, ctx)
			// CONTENT types get the lead's prior research appended so the model can reuse it (and decide
			// whether to web-search). kind is read live from the type; RESEARCH/SCORING get no block.
			const contextBlock = researchType.kind === "CONTENT" ? buildLeadContextBlock(lead) : ""
			const renderedPrompt = contextBlock ? `${base}\n\n${contextBlock}` : base
			return runResearch({renderedPrompt, inputSchema: buildFindingsSchema(fields), modelId, webSearchEnabled})
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
					data: {status: "DONE", findings: result.findings as Prisma.InputJsonValue, diff: diff as unknown as Prisma.InputJsonValue, modelId: resolveModel(modelId), completedAt: new Date()},
				}),
				prisma.leadActivity.create({
					data: {organizationId: run.organizationId, leadId: run.leadId, kind: "RESEARCH", body: `Research "${run.researchTypeName}": ${diff.applied.length} zastosowane, ${diff.proposed.length} propozycje, ${diff.skipped.length} pominięte`, authorUserId: run.createdById},
				}),
			]),
		)
		return {ok: true, applied: diff.applied.length}
	},
)
