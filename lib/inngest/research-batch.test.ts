// lib/inngest/research-batch.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"

const h = vi.hoisted(() => ({
	batch: null as any,
	candidates: [] as {id: string}[],
	recent: [] as {leadId: string}[],
	created: [] as any[],
	updateArgs: null as any,
	sent: [] as any[],
}))

vi.mock("@/lib/prisma", () => ({
	prisma: {
		researchBatch: {
			findFirst: vi.fn(async () => h.batch),
			update: vi.fn(async (args: any) => {
				h.updateArgs = args
				if (h.batch) Object.assign(h.batch, args.data)
				return h.batch
			}),
		},
		lead: {findMany: vi.fn(async () => h.candidates)},
		researchRun: {
			findMany: vi.fn(async ({select}: any) => {
				// recent-dedup query selects leadId; load-ids query selects id for this batch
				if (select?.leadId) return h.recent
				return h.created.map((_, i) => ({id: `run${i}`}))
			}),
			createMany: vi.fn(async ({data}: any) => {
				h.created = data
				return {count: data.length}
			}),
		},
	},
}))

import {runResearchBatchHandler, type BatchTools} from "@/lib/inngest/research-batch"

function tools(): BatchTools {
	return {
		run: async (_id, fn) => fn(),
		sendEvent: async (_id, events) => {
			h.sent.push(...events)
		},
	}
}

beforeEach(() => {
	h.batch = {
		id: "b1", organizationId: "org1", researchTypeId: "t1", researchTypeName: "Licea",
		promptSnapshot: "P", outputFieldsSnapshot: [{key: "k"}], modelIdSnapshot: null, webSearchEnabled: true,
		mode: "AUTO", status: "QUEUED", includeRecent: false, criteria: {offeringLineId: "line1"}, total: 0, createdById: "u1",
	}
	h.candidates = [{id: "a"}, {id: "b"}, {id: "c"}]
	h.recent = []
	h.created = []
	h.updateArgs = null
	h.sent.length = 0
	vi.clearAllMocks()
})

describe("runResearchBatchHandler", () => {
	it("creates a run per candidate, sets RUNNING+total, fans out one event per run", async () => {
		const res = await runResearchBatchHandler("b1", "org1", tools())
		expect(h.created).toHaveLength(3)
		expect(h.created[0]).toMatchObject({organizationId: "org1", leadId: "a", batchId: "b1", mode: "AUTO", status: "QUEUED", promptSnapshot: "P", webSearchEnabledSnapshot: true})
		expect(h.batch.status).toBe("RUNNING")
		expect(h.batch.total).toBe(3)
		expect(h.sent).toHaveLength(3)
		expect(h.sent[0]).toEqual({name: "research/run.requested", data: {runId: "run0", organizationId: "org1"}})
		expect(res).toEqual({total: 3})
	})

	it("dedups recently-researched leads unless includeRecent", async () => {
		h.recent = [{leadId: "b"}]
		await runResearchBatchHandler("b1", "org1", tools())
		expect(h.created.map((r: any) => r.leadId)).toEqual(["a", "c"])
	})

	it("ignores recent dedup when includeRecent is true", async () => {
		h.batch.includeRecent = true
		h.recent = [{leadId: "b"}]
		await runResearchBatchHandler("b1", "org1", tools())
		expect(h.created).toHaveLength(3)
	})

	it("finalizes an empty batch DONE without fanning out", async () => {
		h.candidates = []
		const res = await runResearchBatchHandler("b1", "org1", tools())
		expect(h.created).toHaveLength(0)
		expect(h.sent).toHaveLength(0)
		expect(h.batch.status).toBe("DONE")
		expect(res).toEqual({total: 0})
	})

	it("skips a cancelled batch", async () => {
		h.batch.status = "CANCELLED"
		const res = await runResearchBatchHandler("b1", "org1", tools())
		expect(res).toEqual({skipped: "cancelled"})
		expect(h.created).toHaveLength(0)
	})

	it("skips a missing batch", async () => {
		h.batch = null
		const res = await runResearchBatchHandler("missing", "org1", tools())
		expect(res).toEqual({skipped: "no-batch"})
	})
})
