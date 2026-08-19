import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildLeadWhere, type BatchCriteria} from "@/features/research/batch-select"
import {partitionCandidates, capBatch} from "@/features/research/batch-dedupe"
import type {Prisma} from "@/generated/prisma/client"

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

export interface BatchTools {
	run: <T>(id: string, fn: () => Promise<T> | T) => Promise<T>
	sendEvent: (id: string, events: {name: string; data: Record<string, unknown>}[]) => Promise<void>
}

export async function runResearchBatchHandler(batchId: string, organizationId: string, step: BatchTools) {
	// Org-scoped load: the event's organizationId (set by the org-scoped startBatch) must match the
	// batch row -- defense-in-depth so a forged/mismatched event cannot drive another org's batch.
	const batch = await prisma.researchBatch.findFirst({where: {id: batchId, organizationId}})
	if (!batch) return {skipped: "no-batch"}
	if (batch.status === "CANCELLED") return {skipped: "cancelled"}

	const criteria = (batch.criteria as BatchCriteria) ?? {}
	const candidates = await step.run("select-leads", () =>
		prisma.lead.findMany({where: buildLeadWhere(batch.organizationId, criteria), select: {id: true}, orderBy: {createdAt: "desc"}}),
	)

	let toQueue = candidates.map((c) => c.id)
	if (!batch.includeRecent && batch.researchTypeId) {
		const cutoff = new Date(Date.now() - RECENT_WINDOW_MS)
		const recent = await step.run("recent-runs", () =>
			prisma.researchRun.findMany({
				where: {organizationId: batch.organizationId, researchTypeId: batch.researchTypeId, status: "DONE", completedAt: {gte: cutoff}},
				select: {leadId: true},
			}),
		)
		toQueue = partitionCandidates(toQueue, new Set(recent.map((r) => r.leadId))).toQueue
	}

	const {capped} = capBatch(toQueue)
	if (capped.length === 0) {
		await step.run("finalize-empty", () =>
			prisma.researchBatch.update({where: {id: batchId, organizationId: batch.organizationId}, data: {status: "DONE", total: 0, startedAt: new Date(), completedAt: new Date()}}),
		)
		return {total: 0}
	}

	await step.run("create-runs", () =>
		prisma.researchRun.createMany({
			data: capped.map((leadId) => ({
				organizationId: batch.organizationId,
				leadId,
				researchTypeId: batch.researchTypeId,
				researchTypeName: batch.researchTypeName,
				mode: batch.mode,
				status: "QUEUED" as const,
				batchId,
				createdById: batch.createdById,
				promptSnapshot: batch.promptSnapshot,
				outputFieldsSnapshot: batch.outputFieldsSnapshot as Prisma.InputJsonValue,
				webSearchEnabledSnapshot: batch.webSearchEnabled,
				modelIdSnapshot: batch.modelIdSnapshot,
			})),
		}),
	)

	// total is the count of run rows created for this batch; deriveBatchStatus relies on it matching
	// the eventual sum of terminal-status runs to flip the batch DONE/PARTIAL at read time.
	const runs = await step.run("load-run-ids", () => prisma.researchRun.findMany({where: {batchId}, select: {id: true}}))
	await step.run("mark-running", () =>
		prisma.researchBatch.update({where: {id: batchId, organizationId: batch.organizationId}, data: {status: "RUNNING", total: runs.length, startedAt: new Date()}}),
	)
	await step.sendEvent(
		"fan-out-runs",
		runs.map((r) => ({name: "research/run.requested", data: {runId: r.id, organizationId: batch.organizationId}})),
	)
	return {total: runs.length}
}

export const runResearchBatchFn = inngest.createFunction(
	{
		id: "run-research-batch",
		triggers: {event: "research/batch.requested"},
		concurrency: {limit: 1, key: "event.data.organizationId"},
		cancelOn: [{event: "research/batch.cancelled", if: "async.data.batchId == event.data.batchId"}],
		retries: 2,
	},
	async ({event, step}) => {
		const {batchId, organizationId} = event.data as {batchId: string; organizationId: string}
		const tools: BatchTools = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			run: (id, fn) => (step.run as any)(id, fn),
			sendEvent: async (id, events) => {
				await step.sendEvent(id, events as Parameters<typeof step.sendEvent>[1])
			},
		}
		return runResearchBatchHandler(batchId, organizationId, tools)
	},
)
