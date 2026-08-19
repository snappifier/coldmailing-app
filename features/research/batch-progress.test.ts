import {describe, it, expect} from "vitest"
import {deriveBatchStatus, type RunStatusCounts} from "@/features/research/batch-progress"

const counts = (over: Partial<RunStatusCounts> = {}): RunStatusCounts => ({QUEUED: 0, RUNNING: 0, DONE: 0, FAILED: 0, CANCELLED: 0, ...over})

describe("deriveBatchStatus", () => {
	it("returns CANCELLED when the batch is cancelled regardless of counts", () => {
		expect(deriveBatchStatus("CANCELLED", counts({DONE: 3}), 3)).toBe("CANCELLED")
	})

	it("returns QUEUED before the orchestrator starts", () => {
		expect(deriveBatchStatus("QUEUED", counts(), 0)).toBe("QUEUED")
	})

	it("returns DONE for the empty-batch finalized case", () => {
		expect(deriveBatchStatus("DONE", counts(), 0)).toBe("DONE")
	})

	it("stays RUNNING while runs are still in flight", () => {
		expect(deriveBatchStatus("RUNNING", counts({DONE: 1, RUNNING: 1, QUEUED: 1}), 3)).toBe("RUNNING")
	})

	it("derives DONE when every run is terminal and none failed", () => {
		expect(deriveBatchStatus("RUNNING", counts({DONE: 2, CANCELLED: 1}), 3)).toBe("DONE")
	})

	it("derives PARTIAL when all terminal but some failed", () => {
		expect(deriveBatchStatus("RUNNING", counts({DONE: 2, FAILED: 1}), 3)).toBe("PARTIAL")
	})
})
