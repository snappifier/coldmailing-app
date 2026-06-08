# Phase 2c — Batch research (Inngest fan-out) — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2c of Phase 2. Builds on 2b
(`docs/superpowers/specs/2026-06-08-phase-2b-research-engine-design.md`). **Implementation deferred to
a fresh session** — resume by reading this spec, then run the writing-plans skill, then execute.

## Goal

Run one `ResearchType` across MANY leads by fanning the existing 2b engine out over an Inngest
orchestrator. Launched from `/leady` (carrying the current filter), with a preview-count + confirm
step, AUTO or MANUAL apply, per-batch progress tracking, and cost/concurrency guards. The 2b per-lead
engine (`runResearchFn`) is reused essentially unchanged.

## Reuse of 2b (one change)

`lib/inngest/research.ts` `runResearchFn` currently reads the LIVE `researchType` at execution. Change:
it prefers per-run **snapshot** fields when present, else falls back to the live type — so a batch run
is reproducible even if the type is edited mid-batch, while single 2b runs (no snapshot) behave exactly
as today. Resolution: `prompt = run.promptSnapshot ?? researchType.prompt`; `outputFields =
run.outputFieldsSnapshot ?? researchType.outputFields`; `webSearchEnabled = run.webSearchEnabledSnapshot
?? researchType.webSearchEnabled`; input `modelId = run.promptSnapshot != null ? run.modelIdSnapshot :
researchType.modelId`. The existing "type/lead exists + org-match" guard stays (a type deleted
mid-batch fails those runs; editing is the case the snapshot covers).

## Engine robustness (shared fix, benefits 2b too)

`features/research/engine.ts` currently catches ALL errors and returns `{ok:false}`, so `runResearchFn`
marks the run FAILED with NO Inngest retry. Under batch rate-limit pressure this silently fails many
runs. Change: **transient** errors (`Anthropic.RateLimitError` 429, `Anthropic.InternalServerError`
5xx, overloaded 529) **propagate (throw)** so Inngest retries with backoff; **permanent** errors
(billing, 400/invalid-request, schema) return `{ok:false}` -> FAILED. `runResearchFn`: on a thrown
transient error let it bubble (Inngest backoff via `retries`); keep the existing FAILED path for
`{ok:false}`. Raise `runResearchFn` `retries` (e.g. 3) to absorb 429 bursts. Keep the billing-warning
message from the 2b follow-up.

## Data model (migration `phase2c_research_batches`)

```prisma
enum ResearchBatchStatus { QUEUED RUNNING DONE PARTIAL CANCELLED }

model ResearchBatch {
	id                    String              @id @default(cuid())
	organizationId        String
	researchTypeId        String?             // SetNull
	researchTypeName      String              // snapshot
	promptSnapshot        String
	outputFieldsSnapshot  Json
	modelIdSnapshot       String?
	webSearchEnabled      Boolean
	mode                  ResearchApplyMode   @default(AUTO)
	status                ResearchBatchStatus @default(QUEUED)
	criteria              Json                // {offeringLineId?: string, q?: string}
	total                 Int                 @default(0)
	createdById           String?
	createdAt             DateTime            @default(now())
	updatedAt             DateTime            @updatedAt
	startedAt             DateTime?
	completedAt           DateTime?

	organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	researchType ResearchType? @relation(fields: [researchTypeId], references: [id], onDelete: SetNull)
	createdBy    User?         @relation("ResearchBatchCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
	runs         ResearchRun[]

	@@index([organizationId, createdAt])
}
```

`ResearchRun` gains: `batchId String?` (FK `ResearchBatch`, onDelete SetNull, `@@index([organizationId,
batchId])`) + snapshot fields `promptSnapshot String?`, `outputFieldsSnapshot Json?`,
`webSearchEnabledSnapshot Boolean?`, `modelIdSnapshot String?`. Back-relations: `Organization.researchBatches`,
`User.researchBatches @relation("ResearchBatchCreatedBy")`, `ResearchType.batches`.

Progress is derived at read time via GROUP BY on `ResearchRun.status` for a `batchId` (no per-run
write-back to the batch). `ResearchBatch.status`: QUEUED -> RUNNING (orchestrator) -> derived DONE
(all runs terminal, none FAILED) / PARTIAL (some FAILED) at read, or CANCELLED.

## Fan-out (durable orchestrator)

1. `startBatch(criteria, researchTypeId, mode, includeRecent)` (use server, requireOrg): load the type
   (org-scoped), snapshot it onto a new `ResearchBatch` (QUEUED), emit ONE
   `research/batch.requested {batchId, organizationId}`. Returns `{ok, batchId}`. Fast + durable — no
   N-send loop in the request.
2. `runResearchBatchFn` (`lib/inngest/research-batch.ts`, trigger `research/batch.requested`,
   `concurrency {limit:1, key:event.data.organizationId}` to serialize batches per org,
   `cancelOn research/batch.cancelled` matched on `batchId`, `retries:2`): load batch; resolve candidate
   leads from `criteria` (org-scoped) via `batch-select`; dedup via `batch-dedupe` (unless
   includeRecent); cap to MAX_BATCH; `step.run` `createMany` N `ResearchRun` rows (status QUEUED,
   `batchId`, `mode`, snapshot fields copied from the batch); set batch RUNNING + `total`;
   `step.sendEvent([...])` fan out N `research/run.requested {runId, organizationId}`. `runResearchFn`
   processes each (unchanged besides snapshot read).

## Lead selection + UI

- Selection axes = the existing `/leady` filter: `{offeringLineId?, q?}` (q = name/email/contact
  contains). `batch-select.ts` (pure) builds the `Prisma.LeadWhereInput` from criteria + orgId,
  mirroring `app/(app)/leady/page.tsx`.
- **Launcher** `app/(app)/leady/batch-research-launcher.tsx` ("use client"): a "Batch research" button
  on `/leady` carrying the current `line`/`q`; opens a panel — research-type picker, mode (AUTO/MANUAL),
  "researchuj mimo niedawnego" checkbox; calls `previewBatch(criteria, researchTypeId, includeRecent)`
  -> shows matched / to-queue / skipped(recent) counts; confirm -> `startBatch` -> navigate to the
  batch page.
- **Batch page** `app/(app)/badania/batches/[id]/page.tsx` + client: polls `getBatch(batchId)` (status
  + GROUP BY counts) every 2s; per-lead table (lead, status, error, applied/proposed summary);
  "wznów nieudane" (re-queue FAILED runs in this batch); for MANUAL: "Zatwierdź wszystko" + per-row
  approve.

## Modes

- **AUTO**: runs auto-fill empty lead fields (2b AUTO); already-set fields stay as proposals (visible
  per lead in the 2b lead-page UI).
- **MANUAL**: runs compute the diff but apply NOTHING; the batch page lists proposals. `applyBatch(batchId)`
  iterates the batch's DONE runs and applies each one's `proposed` (re-coerce + per-run email-collision
  re-check), plus per-row `confirmResearchApply(runId)`. **Refactor:** extract the proposed-apply core
  of 2b's `confirmResearchApply` into a shared helper (`features/research/apply-confirm.ts` or a pure
  function in `apply.ts`) so single-run (2b) and batch (2c) share it.

## Guards

- **MAX_BATCH = 200** leads per batch (hard cap; preview warns + truncates with a clear note).
- **Re-research window = 30 days**: dedup skips leads that already have a DONE `ResearchRun` for this
  `researchTypeId` within 30 days, unless `includeRecent`. `batch-dedupe.ts` (pure) partitions
  candidates into `toQueue` / `skippedRecent` given the set of recently-researched leadIds (queried by
  the action).
- Preview-with-count + explicit confirm before any run is created.
- **Cancel**: `cancelBatch(batchId)` sets batch CANCELLED + its still-QUEUED runs CANCELLED, emits
  `research/batch.cancelled {batchId}` (orchestrator `cancelOn`). `runResearchFn` skips a run whose
  status is already CANCELLED (best-effort; in-flight RUNNING runs finish).
- Per-org throughput: orchestrator `{limit:1,key:org}` (one batch at a time/org) + `runResearchFn`
  `{limit:3,key:org}` + transient-retry backoff.

## Modules

Pure (unit-tested, no next-auth/SDK imports):
- `features/research/batch-select.ts` — `buildLeadWhere(orgId, criteria)` -> `Prisma.LeadWhereInput`.
- `features/research/batch-dedupe.ts` — `partitionCandidates(candidateIds, recentlyResearchedIds)` ->
  `{toQueue, skippedRecent}`; cap helper.
- shared apply-confirm helper (extract from `confirmResearchApply`).

Boundary / orchestration:
- `features/research/batch-actions.ts` — `previewBatch`, `startBatch`, `getBatch`, `cancelBatch`,
  `applyBatch`, `resumeFailed` (use server, org-scoped, `{ok,error}`).
- `lib/inngest/research-batch.ts` — `runResearchBatchFn`; register in `app/api/inngest/route.ts`.
- `lib/inngest/research.ts` — snapshot-read change + transient-error rethrow + skip-CANCELLED.
- UI: `app/(app)/leady/batch-research-launcher.tsx`, `app/(app)/badania/batches/[id]/page.tsx` (+ client).

## Error handling

Actions return `{ok}|{ok:false,error}`. Orchestrator: a deleted type/lead -> batch FAILED-ish (mark
runs FAILED). Per-run errors live on `ResearchRun.error`, surfaced in the batch table. Transient
Anthropic errors retry (Inngest backoff); permanent -> run FAILED. `applyBatch` reports per-lead
email-collision skips.

## Testing

- `batch-select.test.ts` — where-clause from criteria (line, q, both, none) + org scoping.
- `batch-dedupe.test.ts` — partition toQueue/skippedRecent; cap to MAX_BATCH; includeRecent override.
- apply-confirm helper test — proposed apply + email re-check (shared with 2b).
- Optionally a mutation-proven `runResearchBatchFn` integration test (mirror `lib/inngest/sending.test.ts`).
- Gates: `tsc` 0, `vitest` green (existing 137 + new), `next build` green (`/badania/batches/[id]`).
- Re-run the 2b tests — the engine transient-error + snapshot changes touch shared code.

## Risks / notes

- The engine transient-rethrow + snapshot read modify SHARED 2b code -> keep 2b's `runResearchFn`
  single-run path behaviorally identical (no snapshot = live type; permanent errors still FAIL).
- Cost: each lead = one opus call (+ optional web search). MAX_BATCH 200 + dedup window are the only
  cost guards; there is still no token/$ budget cap (Anthropic exposes no balance API — see the 2b
  billing-warning). A 200-lead batch is 200 expensive calls; the preview count is the user's check.
- Inngest event-ingestion: `step.sendEvent([...up to 200])` is within limits; verify on Inngest Cloud
  (same pending cron-on-cloud verification as Phase 5).
- `2b is NOT live-run yet` — 2c builds on it; the first batch is also the first real exercise of the
  engine. Smoke-test one lead (2b) before a large batch.
- MANUAL batch has no undo; AUTO writes only empty fields so it is low-risk, but there is no pre-apply
  lead snapshot for rollback (out of scope).
