"use server"
// features/research/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {toLeadUpdate} from "@/features/research/apply"
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
	let proposed = diff.proposed ?? []
	if (proposed.length === 0) return {ok: true}

	const emailItem = proposed.find((p) => p.target === "email")
	if (emailItem && typeof emailItem.value === "string") {
		const taken = await prisma.lead.findFirst({where: {organizationId: orgId, email: emailItem.value, id: {not: run.leadId}}, select: {id: true}})
		if (taken) proposed = proposed.filter((p) => p.target !== "email")
	}

	const existing = (run.lead.customFields as Record<string, string> | null) ?? {}
	const {data, customFields} = toLeadUpdate(proposed, existing)
	await prisma.$transaction([
		prisma.lead.updateMany({where: {id: run.leadId, organizationId: orgId}, data: {...data, customFields}}),
		prisma.leadActivity.create({data: {organizationId: orgId, leadId: run.leadId, kind: "RESEARCH", body: `Zastosowano propozycje researchu (${proposed.length})`, authorUserId: userId}}),
	])
	revalidatePath(`/leady/${run.leadId}`)
	return {ok: true}
}
