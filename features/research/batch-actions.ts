"use server"

import {revalidatePath} from "next/cache"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {buildLeadWhere, type BatchCriteria} from "@/features/research/batch-select"
import {partitionCandidates, capBatch, MAX_BATCH} from "@/features/research/batch-dedupe"
import {deriveBatchStatus, type RunStatusCounts} from "@/features/research/batch-progress"
import {applyProposedToLead} from "@/features/research/apply-confirm"
import type {ProposedField} from "@/features/research/types"

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export type PreviewResult = {ok: true; matched: number; skippedRecent: number; willQueue: number; truncated: boolean; max: number} | {ok: false; error: string}
export type StartBatchResult = {ok: true; batchId: string} | {ok: false; error: string}
export type BatchActionResult = {ok: true} | {ok: false; error: string}

function normalizeCriteria(criteria: BatchCriteria): BatchCriteria {
	const out: BatchCriteria = {}
	if (criteria.offeringLineId) out.offeringLineId = criteria.offeringLineId
	if (criteria.q) out.q = criteria.q
	return out
}

async function recentLeadIds(orgId: string, researchTypeId: string): Promise<Set<string>> {
	const cutoff = new Date(Date.now() - RECENT_WINDOW_MS)
	const recent = await prisma.researchRun.findMany({
		where: {organizationId: orgId, researchTypeId, status: "DONE", completedAt: {gte: cutoff}},
		select: {leadId: true},
	})
	return new Set(recent.map((r) => r.leadId))
}

export async function previewBatch(criteria: BatchCriteria, researchTypeId: string, includeRecent: boolean): Promise<PreviewResult> {
	const {orgId} = await requireOrg()
	const type = await prisma.researchType.findFirst({where: {id: researchTypeId, organizationId: orgId}, select: {id: true}})
	if (!type) return {ok: false, error: "Nie znaleziono typu researchu"}

	const candidates = await prisma.lead.findMany({where: buildLeadWhere(orgId, normalizeCriteria(criteria)), select: {id: true}})
	let toQueue = candidates.map((c) => c.id)
	let skippedRecent = 0
	if (!includeRecent) {
		const part = partitionCandidates(toQueue, await recentLeadIds(orgId, researchTypeId))
		toQueue = part.toQueue
		skippedRecent = part.skippedRecent.length
	}
	const {capped, truncated} = capBatch(toQueue)
	return {ok: true, matched: candidates.length, skippedRecent, willQueue: capped.length, truncated, max: MAX_BATCH}
}

export async function startBatch(criteria: BatchCriteria, researchTypeId: string, mode: "AUTO" | "MANUAL", includeRecent: boolean): Promise<StartBatchResult> {
	const {orgId, userId} = await requireOrg()
	const type = await prisma.researchType.findFirst({where: {id: researchTypeId, organizationId: orgId}})
	if (!type) return {ok: false, error: "Nie znaleziono typu researchu"}

	const batch = await prisma.researchBatch.create({
		data: {
			organizationId: orgId,
			researchTypeId: type.id,
			researchTypeName: type.name,
			promptSnapshot: type.prompt,
			outputFieldsSnapshot: type.outputFields as Prisma.InputJsonValue,
			modelIdSnapshot: type.modelId,
			webSearchEnabled: type.webSearchEnabled,
			mode,
			includeRecent,
			criteria: normalizeCriteria(criteria) as Prisma.InputJsonValue,
			status: "QUEUED",
			createdById: userId,
		},
	})
	await inngest.send({name: "research/batch.requested", data: {batchId: batch.id, organizationId: orgId}})
	return {ok: true, batchId: batch.id}
}

export async function getBatch(batchId: string) {
	const {orgId} = await requireOrg()
	const batch = await prisma.researchBatch.findFirst({where: {id: batchId, organizationId: orgId}})
	if (!batch) return null

	const grouped = await prisma.researchRun.groupBy({by: ["status"], where: {batchId, organizationId: orgId}, _count: {_all: true}})
	const counts: RunStatusCounts = {QUEUED: 0, RUNNING: 0, DONE: 0, FAILED: 0, CANCELLED: 0}
	for (const g of grouped) counts[g.status] = g._count._all

	const runs = await prisma.researchRun.findMany({
		where: {batchId, organizationId: orgId},
		orderBy: {createdAt: "asc"},
		include: {lead: {select: {organizationName: true}}},
	})
	const rows = runs.map((r) => {
		const diff = r.diff as {applied?: unknown[]; proposed?: unknown[]} | null
		return {
			runId: r.id,
			leadId: r.leadId,
			leadName: r.lead?.organizationName ?? "—",
			status: r.status,
			error: r.error,
			applied: diff?.applied?.length ?? 0,
			proposed: diff?.proposed?.length ?? 0,
		}
	})

	return {
		id: batch.id,
		name: batch.researchTypeName,
		mode: batch.mode,
		total: batch.total,
		status: deriveBatchStatus(batch.status, counts, batch.total),
		counts,
		rows,
	}
}

export async function cancelBatch(batchId: string): Promise<BatchActionResult> {
	const {orgId} = await requireOrg()
	const batch = await prisma.researchBatch.findFirst({where: {id: batchId, organizationId: orgId}, select: {id: true}})
	if (!batch) return {ok: false, error: "Nie znaleziono badania"}
	await prisma.$transaction([
		prisma.researchBatch.update({where: {id: batchId, organizationId: orgId}, data: {status: "CANCELLED", completedAt: new Date()}}),
		prisma.researchRun.updateMany({where: {batchId, organizationId: orgId, status: "QUEUED"}, data: {status: "CANCELLED", completedAt: new Date()}}),
	])
	await inngest.send({name: "research/batch.cancelled", data: {batchId}})
	revalidatePath(`/badania/batches/${batchId}`)
	return {ok: true}
}

export async function resumeFailed(batchId: string): Promise<BatchActionResult> {
	const {orgId} = await requireOrg()
	const batch = await prisma.researchBatch.findFirst({where: {id: batchId, organizationId: orgId}, select: {id: true, status: true}})
	if (!batch) return {ok: false, error: "Nie znaleziono badania"}
	if (batch.status === "CANCELLED") return {ok: false, error: "Badanie anulowane"}
	const failed = await prisma.researchRun.findMany({where: {batchId, organizationId: orgId, status: "FAILED"}, select: {id: true}})
	if (failed.length === 0) return {ok: true}
	await prisma.$transaction([
		prisma.researchRun.updateMany({where: {id: {in: failed.map((f) => f.id)}, organizationId: orgId}, data: {status: "QUEUED", error: null, completedAt: null}}),
		prisma.researchBatch.update({where: {id: batchId, organizationId: orgId}, data: {status: "RUNNING"}}),
	])
	await inngest.send(failed.map((f) => ({name: "research/run.requested", data: {runId: f.id, organizationId: orgId}})))
	revalidatePath(`/badania/batches/${batchId}`)
	return {ok: true}
}

export async function applyBatch(batchId: string): Promise<{ok: true; applied: number; emailCollisions: number} | {ok: false; error: string}> {
	const {orgId, userId} = await requireOrg()
	const batch = await prisma.researchBatch.findFirst({where: {id: batchId, organizationId: orgId}, select: {id: true, mode: true}})
	if (!batch) return {ok: false, error: "Nie znaleziono badania"}
	if (batch.mode !== "MANUAL") return {ok: false, error: "Tryb AUTO nie wymaga zatwierdzania"}

	const runs = await prisma.researchRun.findMany({where: {batchId, organizationId: orgId, status: "DONE"}, include: {lead: {select: {customFields: true}}}})
	let applied = 0
	let emailCollisions = 0
	for (const run of runs) {
		if (!run.lead || !run.diff) continue
		const proposed = (run.diff as unknown as {proposed?: ProposedField[]}).proposed ?? []
		const existing = (run.lead.customFields as Record<string, string> | null) ?? {}
		const res = await applyProposedToLead({orgId, userId, runId: run.id, leadId: run.leadId, existingCustom: existing, proposed})
		applied += res.applied
		if (res.emailSkipped) emailCollisions++
	}
	revalidatePath(`/badania/batches/${batchId}`)
	return {ok: true, applied, emailCollisions}
}
