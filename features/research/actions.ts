"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {applyProposedToLead} from "@/features/research/apply-confirm"
import type {ProposedField} from "@/features/research/types"

export type StartResult = {ok: true; runId: string} | {ok: false; error: string}
export type ApplyResult = {ok: true} | {ok: false; error: string}

export async function startResearch(leadId: string, researchTypeId: string, mode: "AUTO" | "MANUAL"): Promise<StartResult> {
	const {orgId, userId} = await requireOrg()
	const [lead, type] = await Promise.all([
		prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}}),
		prisma.researchType.findFirst({where: {id: researchTypeId, organizationId: orgId}, select: {id: true, name: true}}),
	])
	if (!lead || !type) return {ok: false, error: "Nie znaleziono leada lub typu researchu"}

	const run = await prisma.researchRun.create({
		data: {organizationId: orgId, leadId, researchTypeId: type.id, researchTypeName: type.name, mode, status: "QUEUED", createdById: userId},
	})
	await inngest.send({name: "research/run.requested", data: {runId: run.id, organizationId: orgId}})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true, runId: run.id}
}

export async function getResearchRun(runId: string) {
	const {orgId} = await requireOrg()
	return prisma.researchRun.findFirst({where: {id: runId, organizationId: orgId}})
}

export async function confirmResearchApply(runId: string): Promise<ApplyResult> {
	const {orgId, userId} = await requireOrg()
	const run = await prisma.researchRun.findFirst({where: {id: runId, organizationId: orgId}, include: {lead: true}})
	if (!run || !run.lead || run.status !== "DONE" || !run.diff) return {ok: false, error: "Brak wyników do zastosowania"}

	const diff = run.diff as unknown as {proposed?: ProposedField[]}
	const proposed = diff.proposed ?? []
	const existing = (run.lead.customFields as Record<string, string> | null) ?? {}
	await applyProposedToLead({orgId, userId, runId: run.id, leadId: run.leadId, existingCustom: existing, proposed})
	revalidatePath(`/leady/${run.leadId}`)
	return {ok: true}
}
