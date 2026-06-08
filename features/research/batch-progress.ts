// features/research/batch-progress.ts
import type {ResearchBatchStatus} from "@/generated/prisma/client"

export interface RunStatusCounts {
	QUEUED: number
	RUNNING: number
	DONE: number
	FAILED: number
	CANCELLED: number
}

export type BatchDisplayStatus = "QUEUED" | "RUNNING" | "DONE" | "PARTIAL" | "CANCELLED"

// The batch row is only ever persisted as QUEUED / RUNNING / CANCELLED (and DONE for the empty-batch
// shortcut). Terminal DONE/PARTIAL are derived from run-status counts at read time (no write-back).
// `total` is the run-row count the orchestrator wrote (mark-running step); the batch is considered
// finished once the terminal-run count reaches it. resumeFailed flips runs back to QUEUED, which
// lowers the terminal count below total and correctly returns the batch to RUNNING.
export function deriveBatchStatus(persisted: ResearchBatchStatus, counts: RunStatusCounts, total: number): BatchDisplayStatus {
	if (persisted === "CANCELLED") return "CANCELLED"
	if (persisted === "QUEUED") return "QUEUED"
	if (persisted === "DONE") return "DONE"
	const terminal = counts.DONE + counts.FAILED + counts.CANCELLED
	if (total > 0 && terminal >= total) return counts.FAILED > 0 ? "PARTIAL" : "DONE"
	return "RUNNING"
}
