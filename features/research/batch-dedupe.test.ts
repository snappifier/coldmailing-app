// features/research/batch-dedupe.test.ts
import {describe, it, expect} from "vitest"
import {MAX_BATCH, partitionCandidates, capBatch} from "@/features/research/batch-dedupe"

describe("partitionCandidates", () => {
	it("splits candidates into toQueue and skippedRecent, preserving order", () => {
		const res = partitionCandidates(["a", "b", "c", "d"], new Set(["b", "d"]))
		expect(res.toQueue).toEqual(["a", "c"])
		expect(res.skippedRecent).toEqual(["b", "d"])
	})

	it("queues everything when nothing is recent", () => {
		const res = partitionCandidates(["a", "b"], new Set())
		expect(res.toQueue).toEqual(["a", "b"])
		expect(res.skippedRecent).toEqual([])
	})
})

describe("capBatch", () => {
	it("does not truncate at or below MAX_BATCH", () => {
		const ids = Array.from({length: MAX_BATCH}, (_, i) => String(i))
		const res = capBatch(ids)
		expect(res.capped).toHaveLength(MAX_BATCH)
		expect(res.truncated).toBe(false)
	})

	it("truncates above MAX_BATCH and flags it", () => {
		const ids = Array.from({length: MAX_BATCH + 5}, (_, i) => String(i))
		const res = capBatch(ids)
		expect(res.capped).toHaveLength(MAX_BATCH)
		expect(res.truncated).toBe(true)
	})
})
