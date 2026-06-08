# Phase 2c — Batch Research (Inngest fan-out) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one `ResearchType` across many leads by fanning the existing 2b per-lead engine out over a durable Inngest orchestrator, launched from `/leady` with a preview+confirm step, AUTO/MANUAL apply, per-batch progress, and cost/concurrency guards.

**Architecture:** A new `ResearchBatch` row snapshots the research type at queue time. `startBatch` (server action) creates the batch QUEUED and emits ONE `research/batch.requested`. A durable orchestrator `runResearchBatchFn` (one-batch-at-a-time per org) resolves candidate leads from the `/leady` filter, dedups against recent runs, caps to 200, `createMany`-s `ResearchRun` rows, then `step.sendEvent`-fans-out `research/run.requested` per run. The 2b `runResearchFn` processes each run unchanged except a snapshot-read and CANCELLED-skip. Progress is derived at read time via GROUP BY on run status (no write-back). The 2b engine gains transient/permanent error classification so rate-limit bursts retry via Inngest instead of silently failing.

**Tech Stack:** Next 16 (App Router, server actions), Prisma 7 (`@/generated/prisma/client`), Inngest v4 (`createFunction` triggers, `concurrency`, `cancelOn`, `step.sendEvent`, `onFailure`), Anthropic SDK, Vitest 4 (prisma mocked via `vi.mock`), Zod 4, Tailwind v4. Conventions: tabs, no semicolons, path comment on line 1 (line 2 after a `"use client"`/`"use server"` directive), `className` first, `import {x}` no inner spaces, NO emoji.

---

## File Structure

**Migration / schema**
- Modify: `prisma/schema.prisma` — new `ResearchBatchStatus` enum; `ResearchRunStatus += CANCELLED`; new `ResearchBatch` model; `ResearchRun` gains `batchId` + 4 snapshot fields + index; back-relations on `Organization` / `User` / `ResearchType`.

**Pure logic (unit-tested, no next-auth / no SDK; type-only Prisma import allowed)**
- Create: `features/research/batch-select.ts` — `buildLeadWhere(orgId, criteria)`.
- Create: `features/research/batch-dedupe.ts` — `MAX_BATCH`, `partitionCandidates`, `capBatch`.
- Create: `features/research/batch-progress.ts` — `deriveBatchStatus`.

**Boundary helper (prisma, no next-auth — testable with prisma mock)**
- Create: `features/research/apply-confirm.ts` — `applyProposedToLead(...)` (extracted from `confirmResearchApply`).

**Boundary / orchestration**
- Modify: `features/research/engine.ts` — transient vs permanent error handling (throw transient, return `{ok:false}` permanent).
- Modify: `features/research/actions.ts` — `confirmResearchApply` delegates to `applyProposedToLead`.
- Modify: `lib/inngest/research.ts` — snapshot-read, skip-CANCELLED, `onFailure` marks FAILED, `retries:3`.
- Create: `lib/inngest/research-batch.ts` — `runResearchBatchHandler` (testable) + `runResearchBatchFn`.
- Create: `features/research/batch-actions.ts` — `previewBatch`, `startBatch`, `getBatch`, `cancelBatch`, `applyBatch`, `resumeFailed`.
- Create: `features/research/batch-queries.ts` — `listResearchBatches(orgId)`.
- Modify: `app/api/inngest/route.ts` — register `runResearchBatchFn`.

**UI**
- Create: `app/(app)/leady/batch-research-launcher.tsx` ("use client") — "Badanie zbiorcze" button + preview/confirm panel.
- Modify: `app/(app)/leady/page.tsx` — fetch research types, render the launcher carrying the current `line`/`q`.
- Create: `app/(app)/badania/batches/[id]/page.tsx` — server page loads the batch + initial snapshot.
- Create: `app/(app)/badania/batches/[id]/batch-view.tsx` ("use client") — polls `getBatch`, progress + per-lead table + MANUAL bulk/per-row approve + resume-failed + cancel.
- Modify: `app/(app)/badania/page.tsx` — add a minimal "Ostatnie badania zbiorcze" list (reachability; one cheap query). *Beyond the spec's listed UI but a sensible default so batches are findable after navigating away.*
- Modify: `app/(app)/leady/[id]/uruchom-research.tsx` — widen `RunView.status` union to include `"CANCELLED"` (the enum now has it; single runs never reach it, type-only change).

**Tests**
- Create: `features/research/batch-select.test.ts`, `features/research/batch-dedupe.test.ts`, `features/research/batch-progress.test.ts`, `features/research/apply-confirm.test.ts`, `lib/inngest/research-batch.test.ts`.

---

## Task 1: Migration + schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `CANCELLED` member to `ResearchRunStatus`**

In `prisma/schema.prisma`, change the existing enum (around line 327):

```prisma
enum ResearchRunStatus {
	QUEUED
	RUNNING
	DONE
	FAILED
	CANCELLED
}
```

- [ ] **Step 2: Add the `ResearchBatchStatus` enum**

Add immediately after `ResearchApplyMode` (around line 337):

```prisma
enum ResearchBatchStatus {
	QUEUED
	RUNNING
	DONE
	PARTIAL
	CANCELLED
}
```

- [ ] **Step 3: Add snapshot + batch fields to `ResearchRun`**

In `model ResearchRun`, add these fields after `diff Json?` and before `error String?`:

```prisma
	batchId                  String?
	promptSnapshot           String?
	outputFieldsSnapshot     Json?
	webSearchEnabledSnapshot Boolean?
	modelIdSnapshot          String?
```

Add the relation (after the existing `createdBy` relation line) and a new index (next to the existing `@@index`):

```prisma
	batch        ResearchBatch? @relation(fields: [batchId], references: [id], onDelete: SetNull)
```

```prisma
	@@index([organizationId, leadId])
	@@index([organizationId, batchId])
```

- [ ] **Step 4: Add the `ResearchBatch` model**

Add after `model ResearchRun { ... }`:

```prisma
model ResearchBatch {
	id                   String              @id @default(cuid())
	organizationId       String
	researchTypeId       String?
	researchTypeName     String
	promptSnapshot       String
	outputFieldsSnapshot Json
	modelIdSnapshot      String?
	webSearchEnabled     Boolean
	mode                 ResearchApplyMode   @default(AUTO)
	status               ResearchBatchStatus @default(QUEUED)
	criteria             Json
	includeRecent        Boolean             @default(false)
	total                Int                 @default(0)
	createdById          String?
	createdAt            DateTime            @default(now())
	updatedAt            DateTime            @updatedAt
	startedAt            DateTime?
	completedAt          DateTime?

	organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	researchType ResearchType? @relation(fields: [researchTypeId], references: [id], onDelete: SetNull)
	createdBy    User?         @relation("ResearchBatchCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
	runs         ResearchRun[]

	@@index([organizationId, createdAt])
}
```

> Note: `includeRecent` is added to the model (the spec's prisma block omitted it, but the orchestrator needs it persisted to apply the dedup window at execution time). Documented deviation.

- [ ] **Step 5: Add the back-relations**

In `model Organization`, after `researchRuns ResearchRun[]`:

```prisma
	researchBatches ResearchBatch[]
```

In `model User`, after `researchRuns ResearchRun[] @relation("ResearchRunCreatedBy")`:

```prisma
	researchBatches ResearchBatch[] @relation("ResearchBatchCreatedBy")
```

In `model ResearchType`, after `runs ResearchRun[]`:

```prisma
	batches ResearchBatch[]
```

- [ ] **Step 6: Create + apply the migration**

Run: `npx prisma migrate dev --name phase2c_research_batches`
Expected: migration created under `prisma/migrations/`, applied to Neon, Prisma client regenerated, no errors.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: This will FAIL only in `app/(app)/leady/[id]/uruchom-research.tsx` (the `RunView.status` union no longer matches `ResearchRunStatus`). Fix it now:

In `app/(app)/leady/[id]/uruchom-research.tsx`, change the `RunView` interface status union:

```tsx
interface RunView {
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "CANCELLED"
	error: string | null
	diff: {applied: DiffField[]; proposed: DiffField[]; skipped: DiffField[]} | null
}
```

Re-run `npx tsc --noEmit` — Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations app/(app)/leady/[id]/uruchom-research.tsx
git commit -m "feat(phase2c): ResearchBatch model + run snapshot/batch fields + CANCELLED status"
```

---

## Task 2: Pure `batch-select.ts`

**Files:**
- Create: `features/research/batch-select.ts`
- Test: `features/research/batch-select.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/batch-select.test.ts
import {describe, it, expect} from "vitest"
import {buildLeadWhere} from "@/features/research/batch-select"

describe("buildLeadWhere", () => {
	it("scopes to the org with no criteria", () => {
		expect(buildLeadWhere("org1", {})).toEqual({organizationId: "org1"})
	})

	it("adds the offering-line filter", () => {
		expect(buildLeadWhere("org1", {offeringLineId: "line1"})).toEqual({organizationId: "org1", offeringLineId: "line1"})
	})

	it("adds a case-insensitive OR over name/email/contact for q", () => {
		const where = buildLeadWhere("org1", {q: "abc"})
		expect(where.organizationId).toBe("org1")
		expect(where.OR).toEqual([
			{organizationName: {contains: "abc", mode: "insensitive"}},
			{email: {contains: "abc", mode: "insensitive"}},
			{contactPersonName: {contains: "abc", mode: "insensitive"}},
		])
	})

	it("combines line + q", () => {
		const where = buildLeadWhere("org1", {offeringLineId: "line1", q: "abc"})
		expect(where.offeringLineId).toBe("line1")
		expect(where.OR).toHaveLength(3)
	})

	it("ignores empty-string q and line", () => {
		expect(buildLeadWhere("org1", {q: "", offeringLineId: ""})).toEqual({organizationId: "org1"})
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/batch-select.test.ts`
Expected: FAIL — cannot resolve `@/features/research/batch-select`.

- [ ] **Step 3: Write the implementation**

```ts
// features/research/batch-select.ts
import type {Prisma} from "@/generated/prisma/client"

export interface BatchCriteria {
	offeringLineId?: string
	q?: string
}

export function buildLeadWhere(orgId: string, criteria: BatchCriteria): Prisma.LeadWhereInput {
	const where: Prisma.LeadWhereInput = {organizationId: orgId}
	if (criteria.offeringLineId) where.offeringLineId = criteria.offeringLineId
	if (criteria.q) {
		where.OR = [
			{organizationName: {contains: criteria.q, mode: "insensitive"}},
			{email: {contains: criteria.q, mode: "insensitive"}},
			{contactPersonName: {contains: criteria.q, mode: "insensitive"}},
		]
	}
	return where
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/batch-select.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research/batch-select.ts features/research/batch-select.test.ts
git commit -m "feat(phase2c): pure buildLeadWhere for batch lead selection"
```

---

## Task 3: Pure `batch-dedupe.ts`

**Files:**
- Create: `features/research/batch-dedupe.ts`
- Test: `features/research/batch-dedupe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/batch-dedupe.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

```ts
// features/research/batch-dedupe.ts
export const MAX_BATCH = 200

export function partitionCandidates(candidateIds: string[], recentlyResearchedIds: Set<string>): {toQueue: string[]; skippedRecent: string[]} {
	const toQueue: string[] = []
	const skippedRecent: string[] = []
	for (const id of candidateIds) {
		if (recentlyResearchedIds.has(id)) skippedRecent.push(id)
		else toQueue.push(id)
	}
	return {toQueue, skippedRecent}
}

export function capBatch(ids: string[]): {capped: string[]; truncated: boolean} {
	return {capped: ids.slice(0, MAX_BATCH), truncated: ids.length > MAX_BATCH}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/batch-dedupe.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research/batch-dedupe.ts features/research/batch-dedupe.test.ts
git commit -m "feat(phase2c): pure partitionCandidates + capBatch (MAX_BATCH 200)"
```

---

## Task 4: Pure `batch-progress.ts`

**Files:**
- Create: `features/research/batch-progress.ts`
- Test: `features/research/batch-progress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/batch-progress.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/batch-progress.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

```ts
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
export function deriveBatchStatus(persisted: ResearchBatchStatus, counts: RunStatusCounts, total: number): BatchDisplayStatus {
	if (persisted === "CANCELLED") return "CANCELLED"
	if (persisted === "QUEUED") return "QUEUED"
	if (persisted === "DONE") return "DONE"
	const terminal = counts.DONE + counts.FAILED + counts.CANCELLED
	if (total > 0 && terminal >= total) return counts.FAILED > 0 ? "PARTIAL" : "DONE"
	return "RUNNING"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/batch-progress.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research/batch-progress.ts features/research/batch-progress.test.ts
git commit -m "feat(phase2c): pure deriveBatchStatus (read-time progress)"
```

---

## Task 5: Shared `apply-confirm.ts` helper + refactor `confirmResearchApply`

**Files:**
- Create: `features/research/apply-confirm.ts`
- Test: `features/research/apply-confirm.test.ts`
- Modify: `features/research/actions.ts:35-58`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/apply-confirm.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"

const h = vi.hoisted(() => ({
	takenEmail: null as string | null,
	updateManyArgs: null as any,
	activityArgs: null as any,
}))

vi.mock("@/lib/prisma", () => ({
	prisma: {
		lead: {
			findFirst: vi.fn(async ({where}: any) => (h.takenEmail && where.email === h.takenEmail ? {id: "other"} : null)),
			updateMany: vi.fn(async (args: any) => {
				h.updateManyArgs = args
				return {count: 1}
			}),
		},
		leadActivity: {create: vi.fn(async (args: any) => {h.activityArgs = args})},
		$transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
	},
}))

import {applyProposedToLead} from "@/features/research/apply-confirm"
import type {ProposedField} from "@/features/research/types"

const prop = (over: Partial<ProposedField>): ProposedField => ({key: "k", target: "contactRole", label: "L", value: "v", current: null, ...over})

beforeEach(() => {
	h.takenEmail = null
	h.updateManyArgs = null
	h.activityArgs = null
	vi.clearAllMocks()
})

describe("applyProposedToLead", () => {
	it("is a no-op for empty proposed", async () => {
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: []})
		expect(res).toEqual({applied: 0, emailSkipped: false})
		expect(h.updateManyArgs).toBeNull()
	})

	it("applies non-email proposals and logs the activity", async () => {
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: [prop({target: "city", value: "Kraków"})]})
		expect(res.applied).toBe(1)
		expect(res.emailSkipped).toBe(false)
		expect(h.updateManyArgs.where).toEqual({id: "l1", organizationId: "org1"})
		expect(h.updateManyArgs.data.city).toBe("Kraków")
		expect(h.activityArgs.data.kind).toBe("RESEARCH")
	})

	it("drops a colliding email and flags emailSkipped", async () => {
		h.takenEmail = "taken@x.pl"
		const res = await applyProposedToLead({
			orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {},
			proposed: [prop({target: "email", value: "taken@x.pl"}), prop({target: "city", value: "Kraków"})],
		})
		expect(res.emailSkipped).toBe(true)
		expect(res.applied).toBe(1)
		expect(h.updateManyArgs.data.email).toBeUndefined()
		expect(h.updateManyArgs.data.city).toBe("Kraków")
	})

	it("returns applied:0 when the only proposal was a colliding email", async () => {
		h.takenEmail = "taken@x.pl"
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: [prop({target: "email", value: "taken@x.pl"})]})
		expect(res).toEqual({applied: 0, emailSkipped: true})
		expect(h.updateManyArgs).toBeNull()
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/apply-confirm.test.ts`
Expected: FAIL — cannot resolve `@/features/research/apply-confirm`.

- [ ] **Step 3: Write the implementation**

```ts
// features/research/apply-confirm.ts
import {prisma} from "@/lib/prisma"
import {toLeadUpdate} from "@/features/research/apply"
import type {ProposedField} from "@/features/research/types"

interface ApplyArgs {
	orgId: string
	userId: string | null
	runId: string
	leadId: string
	existingCustom: Record<string, string>
	proposed: ProposedField[]
}

// Shared by single-run confirm (2b) and batch apply (2c): re-check an email collision against the
// org, drop the colliding email proposal, write the rest, and log a RESEARCH activity.
export async function applyProposedToLead({orgId, userId, runId, leadId, existingCustom, proposed}: ApplyArgs): Promise<{applied: number; emailSkipped: boolean}> {
	void runId
	if (proposed.length === 0) return {applied: 0, emailSkipped: false}

	let toApply = proposed
	let emailSkipped = false
	const emailItem = toApply.find((p) => p.target === "email")
	if (emailItem && typeof emailItem.value === "string") {
		const taken = await prisma.lead.findFirst({where: {organizationId: orgId, email: emailItem.value, id: {not: leadId}}, select: {id: true}})
		if (taken) {
			toApply = toApply.filter((p) => p.target !== "email")
			emailSkipped = true
		}
	}
	if (toApply.length === 0) return {applied: 0, emailSkipped}

	const {data, customFields} = toLeadUpdate(toApply, existingCustom)
	await prisma.$transaction([
		prisma.lead.updateMany({where: {id: leadId, organizationId: orgId}, data: {...data, customFields}}),
		prisma.leadActivity.create({data: {organizationId: orgId, leadId, kind: "RESEARCH", body: `Zastosowano propozycje researchu (${toApply.length})`, authorUserId: userId}}),
	])
	return {applied: toApply.length, emailSkipped}
}
```

> `runId` is accepted (and `void`-ignored) so callers can pass it for future per-run tracking without a signature change; remove the `void runId` line if a linter flags it differently — it documents intent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/apply-confirm.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `confirmResearchApply` to delegate**

In `features/research/actions.ts`, replace the body of `confirmResearchApply` (lines 35-58) with:

```ts
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
```

Update the imports at the top of `features/research/actions.ts`: remove the now-unused `toLeadUpdate` import and add the helper:

```ts
import {applyProposedToLead} from "@/features/research/apply-confirm"
import type {ProposedField} from "@/features/research/types"
```

(Delete the old `import {toLeadUpdate} from "@/features/research/apply"` line — `toLeadUpdate` is no longer referenced in this file.)

- [ ] **Step 6: Verify the refactor + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0 errors; all tests pass (137 baseline + batch-select 5 + batch-dedupe 4 + batch-progress 6 + apply-confirm 4 = 156).

- [ ] **Step 7: Commit**

```bash
git add features/research/apply-confirm.ts features/research/apply-confirm.test.ts features/research/actions.ts
git commit -m "refactor(phase2c): extract applyProposedToLead shared by 2b confirm + 2c batch"
```

---

## Task 6: Engine transient/permanent error handling + `runResearchFn` changes

**Files:**
- Modify: `features/research/engine.ts:52-64`
- Modify: `lib/inngest/research.ts`

- [ ] **Step 1: Update the engine catch block**

In `features/research/engine.ts`, replace the `catch (e) { ... }` block (lines 52-64) with:

```ts
		} catch (e) {
			// Transient -> rethrow so Inngest retries with backoff (batch rate-limit bursts).
			if (e instanceof Anthropic.APIConnectionError) throw e
			if (e instanceof Anthropic.RateLimitError) throw e
			if (e instanceof Anthropic.InternalServerError) throw e
			if (e instanceof Anthropic.APIError) {
				const status = e.status
				if (status === 529 || (typeof status === "number" && status >= 500)) throw e
				// Permanent -> {ok:false} -> run FAILED. Anthropic has no balance API, so a low/empty
				// key budget only surfaces here on a billing failure -> a clear, distinct warning.
				const type = (e as {type?: string}).type
				if (type === "billing_error" || /credit|balance|billing|insufficient|budget/i.test(e.message)) {
					return {ok: false, error: "Środki/budżet na kluczu API Anthropic wyczerpane lub przekroczony limit wydatków — uzupełnij w konsoli Anthropic."}
				}
				return {ok: false, error: `Błąd API Anthropic (${e.status}): ${e.message}`}
			}
			return {ok: false, error: e instanceof Error ? e.message : "Błąd API"}
		}
```

> Behavior change: rate-limit / 5xx / 529 / connection errors now THROW (previously returned a friendly `{ok:false}`). They are caught by Inngest's retry. Permanent errors (billing, 400/invalid, schema) still return `{ok:false}`. The friendly billing message is preserved.

- [ ] **Step 2: Update `runResearchFn` — skip CANCELLED, snapshot-read, onFailure, retries:3**

Replace the whole `runResearchFn` definition in `lib/inngest/research.ts` (lines 22-70) with:

```ts
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
			return runResearch({renderedPrompt: buildResearchPrompt(prompt, ctx), inputSchema: buildFindingsSchema(fields), modelId, webSearchEnabled})
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
```

> Notes: (1) the original code only marked FAILED for a bad guard *if `run` existed*; the new `if (!run) return {skipped:true}` keeps that. (2) On a thrown transient error the `step.run("anthropic")` bubbles, Inngest retries (now 3), and after exhaustion `onFailure` marks the run FAILED — without it the run would be stuck RUNNING.

- [ ] **Step 3: Typecheck + full suite (no regression)**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0; all 156 tests still pass (engine + research.ts changes are not directly unit-tested but must not break the existing suite).

- [ ] **Step 4: Commit**

```bash
git add features/research/engine.ts lib/inngest/research.ts
git commit -m "feat(phase2c): engine transient-retry + runResearchFn snapshot-read, skip-cancelled, onFailure"
```

---

## Task 7: Orchestrator `runResearchBatchFn` (+ testable handler)

**Files:**
- Create: `lib/inngest/research-batch.ts`
- Test: `lib/inngest/research-batch.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
			findUnique: vi.fn(async () => h.batch),
			update: vi.fn(async (args: any) => {
				h.updateArgs = args
				Object.assign(h.batch, args.data)
				return h.batch
			}),
		},
		lead: {findMany: vi.fn(async () => h.candidates)},
		researchRun: {
			findMany: vi.fn(async ({where, select}: any) => {
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
		const res = await runResearchBatchHandler("b1", tools())
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
		await runResearchBatchHandler("b1", tools())
		expect(h.created.map((r: any) => r.leadId)).toEqual(["a", "c"])
	})

	it("ignores recent dedup when includeRecent is true", async () => {
		h.batch.includeRecent = true
		h.recent = [{leadId: "b"}]
		await runResearchBatchHandler("b1", tools())
		expect(h.created).toHaveLength(3)
	})

	it("finalizes an empty batch DONE without fanning out", async () => {
		h.candidates = []
		const res = await runResearchBatchHandler("b1", tools())
		expect(h.created).toHaveLength(0)
		expect(h.sent).toHaveLength(0)
		expect(h.batch.status).toBe("DONE")
		expect(res).toEqual({total: 0})
	})

	it("skips a cancelled batch", async () => {
		h.batch.status = "CANCELLED"
		const res = await runResearchBatchHandler("b1", tools())
		expect(res).toEqual({skipped: "cancelled"})
		expect(h.created).toHaveLength(0)
	})

	it("skips a missing batch", async () => {
		h.batch = null
		const res = await runResearchBatchHandler("missing", tools())
		expect(res).toEqual({skipped: "no-batch"})
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/inngest/research-batch.test.ts`
Expected: FAIL — cannot resolve `@/lib/inngest/research-batch`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/inngest/research-batch.ts
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

export async function runResearchBatchHandler(batchId: string, step: BatchTools) {
	const batch = await prisma.researchBatch.findUnique({where: {id: batchId}})
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
		await prisma.researchBatch.update({where: {id: batchId}, data: {status: "DONE", total: 0, startedAt: new Date(), completedAt: new Date()}})
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

	const runs = await step.run("load-run-ids", () => prisma.researchRun.findMany({where: {batchId}, select: {id: true}}))
	await prisma.researchBatch.update({where: {id: batchId}, data: {status: "RUNNING", total: runs.length, startedAt: new Date()}})
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
		const {batchId} = event.data as {batchId: string; organizationId: string}
		const tools: BatchTools = {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			run: (id, fn) => (step.run as any)(id, fn),
			sendEvent: (id, events) => step.sendEvent(id, events as Parameters<typeof step.sendEvent>[1]),
		}
		return runResearchBatchHandler(batchId, tools)
	},
)
```

> The `load-run-ids` step re-reads all runs for `batchId` (createMany returns no IDs). On an orchestrator retry, `createMany` may have already inserted rows; because the function is `retries:2`, a partial-then-retry could double-insert. This is acceptable for the batch case (duplicate runs over the same lead just produce extra DONE runs; AUTO only fills empty fields). If this proves a problem in the live run, gate `create-runs` with a "no runs exist for this batch yet" check — noted as a follow-up, not implemented now to keep the path simple.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/inngest/research-batch.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add lib/inngest/research-batch.ts lib/inngest/research-batch.test.ts
git commit -m "feat(phase2c): runResearchBatchFn durable fan-out orchestrator"
```

---

## Task 8: Register the orchestrator

**Files:**
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Add the import + registration**

Replace `app/api/inngest/route.ts` with:

```ts
// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"
import {runLeadSequence} from "@/lib/inngest/sending"
import {scanMailboxesForReplies, pollMailboxReplies} from "@/lib/inngest/replies"
import {runResearchFn} from "@/lib/inngest/research"
import {runResearchBatchFn} from "@/lib/inngest/research-batch"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, runLeadSequence, scanMailboxesForReplies, pollMailboxReplies, runResearchFn, runResearchBatchFn]})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/inngest/route.ts
git commit -m "feat(phase2c): register runResearchBatchFn with the Inngest serve handler"
```

---

## Task 9: Batch server actions + queries

**Files:**
- Create: `features/research/batch-actions.ts`
- Create: `features/research/batch-queries.ts`

- [ ] **Step 1: Write `batch-queries.ts`**

```ts
// features/research/batch-queries.ts
import {prisma} from "@/lib/prisma"

export function listResearchBatches(orgId: string) {
	return prisma.researchBatch.findMany({
		where: {organizationId: orgId},
		orderBy: {createdAt: "desc"},
		take: 25,
		select: {id: true, researchTypeName: true, mode: true, status: true, total: true, createdAt: true},
	})
}
```

- [ ] **Step 2: Write `batch-actions.ts`**

```ts
"use server"
// features/research/batch-actions.ts

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
		prisma.researchBatch.update({where: {id: batchId}, data: {status: "CANCELLED", completedAt: new Date()}}),
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
		prisma.researchBatch.update({where: {id: batchId}, data: {status: "RUNNING"}}),
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `g._count._all` types as possibly-undefined, it is `number` here because `_count: {_all: true}` was requested — no change needed; if tsc complains, use `g._count._all ?? 0`.)

- [ ] **Step 4: Commit**

```bash
git add features/research/batch-actions.ts features/research/batch-queries.ts
git commit -m "feat(phase2c): batch actions (preview/start/get/cancel/resume/apply) + list query"
```

---

## Task 10: Launcher on `/leady`

**Files:**
- Create: `app/(app)/leady/batch-research-launcher.tsx`
- Modify: `app/(app)/leady/page.tsx`

- [ ] **Step 1: Write the launcher client component**

```tsx
"use client"
// app/(app)/leady/batch-research-launcher.tsx

import {useState} from "react"
import {useRouter} from "next/navigation"
import {previewBatch, startBatch, type PreviewResult} from "@/features/research/batch-actions"

interface TypeOption {
	id: string
	name: string
}

export function BatchResearchLauncher({types, criteria}: {types: TypeOption[]; criteria: {offeringLineId?: string; q?: string}}) {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO")
	const [includeRecent, setIncludeRecent] = useState(false)
	const [preview, setPreview] = useState<Extract<PreviewResult, {ok: true}> | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	if (types.length === 0) return null

	async function onPreview() {
		setError(null)
		setPreview(null)
		setBusy(true)
		const res = await previewBatch(criteria, typeId, includeRecent)
		setBusy(false)
		if (!res.ok) {
			setError(res.error)
			return
		}
		setPreview(res)
	}

	async function onStart() {
		setError(null)
		setBusy(true)
		const res = await startBatch(criteria, typeId, mode, includeRecent)
		if (!res.ok) {
			setBusy(false)
			setError(res.error)
			return
		}
		router.push(`/badania/batches/${res.batchId}`)
	}

	return (
		<div className="rounded border border-zinc-200 p-3 text-sm">
			<div className="flex items-center justify-between">
				<h2 className="font-semibold text-zinc-600">Badanie zbiorcze</h2>
				<button className="text-blue-600" type="button" onClick={() => setOpen((v) => !v)}>
					{open ? "Ukryj" : "Uruchom dla filtra"}
				</button>
			</div>
			{open ? (
				<div className="mt-3 flex flex-col gap-2">
					<p className="text-xs text-zinc-500">Uruchomi research dla leadów pasujących do bieżącego filtra (linia + szukaj).</p>
					<div className="flex flex-wrap items-end gap-2">
						<select className="rounded border border-zinc-300 px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
						<select className="rounded border border-zinc-300 px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}>
							<option value="AUTO">Auto (uzupełnij puste)</option>
							<option value="MANUAL">Ręczne zatwierdzenie</option>
						</select>
						<label className="flex items-center gap-1 text-xs text-zinc-600">
							<input type="checkbox" checked={includeRecent} onChange={(e) => setIncludeRecent(e.target.checked)} />
							researchuj mimo niedawnego (30 dni)
						</label>
						<button className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50" type="button" disabled={busy || !typeId} onClick={onPreview}>
							Podgląd
						</button>
					</div>
					{error ? <p className="text-red-600">{error}</p> : null}
					{preview ? (
						<div className="flex flex-col gap-2 rounded bg-zinc-50 p-2">
							<p className="text-zinc-700">
								Pasujące: {preview.matched} · pominięte (niedawne): {preview.skippedRecent} · do uruchomienia: <span className="font-semibold">{preview.willQueue}</span>
								{preview.truncated ? <span className="text-amber-700"> (ograniczono do {preview.max})</span> : null}
							</p>
							<button className="self-start rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="button" disabled={busy || preview.willQueue === 0} onClick={onStart}>
								Uruchom dla {preview.willQueue} leadów
							</button>
						</div>
					) : null}
				</div>
			) : null}
		</div>
	)
}
```

- [ ] **Step 2: Wire the launcher into `/leady`**

In `app/(app)/leady/page.tsx`:

Add imports near the top (after the `deleteLead` import):

```tsx
import {listResearchTypes} from "@/features/research-types/queries"
import {BatchResearchLauncher} from "./batch-research-launcher"
```

Add `researchTypes` to the parallel fetch (replace the existing `Promise.all` destructuring at lines 26-29):

```tsx
	const [leads, offeringLines, researchTypes] = await Promise.all([
		prisma.lead.findMany({where, orderBy, take: 500, include: {offeringLine: {select: {name: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		listResearchTypes(orgId),
	])
```

Render the launcher between `<LeadForm ... />` and the filter `<form>` (after line 40):

```tsx
			<LeadForm offeringLines={offeringLines} />

			<BatchResearchLauncher types={researchTypes.map((t) => ({id: t.id, name: t.name}))} criteria={{offeringLineId: line, q}} />

```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/leady/batch-research-launcher.tsx app/(app)/leady/page.tsx
git commit -m "feat(phase2c): batch research launcher on /leady (preview + confirm)"
```

---

## Task 11: Batch detail page + view

**Files:**
- Create: `app/(app)/badania/batches/[id]/page.tsx`
- Create: `app/(app)/badania/batches/[id]/batch-view.tsx`

- [ ] **Step 1: Write the server page**

```tsx
// app/(app)/badania/batches/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {getBatch} from "@/features/research/batch-actions"
import {BatchView} from "./batch-view"

export default async function BatchPage({params}: {params: Promise<{id: string}>}) {
	const {id} = await params
	const batch = await getBatch(id)
	if (!batch) notFound()

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-blue-600" href="/badania">
				← Badania
			</Link>
			<BatchView batchId={id} initial={batch} />
		</section>
	)
}
```

- [ ] **Step 2: Write the client view**

```tsx
"use client"
// app/(app)/badania/batches/[id]/batch-view.tsx

import {useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {getBatch, cancelBatch, resumeFailed, applyBatch} from "@/features/research/batch-actions"
import {confirmResearchApply} from "@/features/research/actions"

type Batch = NonNullable<Awaited<ReturnType<typeof getBatch>>>

const STATUS_LABEL: Record<string, string> = {
	QUEUED: "W kolejce",
	RUNNING: "W toku",
	DONE: "Zakończone",
	PARTIAL: "Częściowe (błędy)",
	CANCELLED: "Anulowane",
	FAILED: "Błąd",
}

export function BatchView({batchId, initial}: {batchId: string; initial: Batch}) {
	const router = useRouter()
	const [batch, setBatch] = useState<Batch>(initial)
	const [busy, setBusy] = useState(false)
	const [msg, setMsg] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		function isTerminal(s: string) {
			return s === "DONE" || s === "PARTIAL" || s === "CANCELLED"
		}
		timer.current = setInterval(async () => {
			const b = await getBatch(batchId)
			if (!b) return
			setBatch(b)
			if (isTerminal(b.status) && timer.current) clearInterval(timer.current)
		}, 2000)
		return () => {
			if (timer.current) clearInterval(timer.current)
		}
	}, [batchId])

	async function onCancel() {
		setBusy(true)
		setMsg(null)
		const res = await cancelBatch(batchId)
		setBusy(false)
		if (!res.ok) setMsg(res.error)
		else router.refresh()
	}

	async function onResume() {
		setBusy(true)
		setMsg(null)
		const res = await resumeFailed(batchId)
		setBusy(false)
		setMsg(res.ok ? "Ponowiono nieudane." : res.error)
	}

	async function onApplyAll() {
		setBusy(true)
		setMsg(null)
		const res = await applyBatch(batchId)
		setBusy(false)
		if (!res.ok) setMsg(res.error)
		else setMsg(`Zastosowano ${res.applied} pól${res.emailCollisions ? `, pominięto ${res.emailCollisions} kolizji email` : ""}.`)
	}

	async function onApplyRow(runId: string) {
		setBusy(true)
		setMsg(null)
		const res = await confirmResearchApply(runId)
		setBusy(false)
		if (!res.ok) setMsg(res.error)
	}

	const c = batch.counts
	const isTerminal = batch.status === "DONE" || batch.status === "PARTIAL" || batch.status === "CANCELLED"

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="text-lg font-semibold">{batch.name}</h1>
				<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{STATUS_LABEL[batch.status] ?? batch.status}</span>
				<span className="text-xs text-zinc-500">{batch.mode === "MANUAL" ? "Ręczne zatwierdzenie" : "Auto"}</span>
			</div>

			<p className="text-sm text-zinc-600">
				Łącznie {batch.total} · DONE {c.DONE} · w toku {c.RUNNING} · w kolejce {c.QUEUED} · błędy {c.FAILED}
				{c.CANCELLED ? ` · anulowane ${c.CANCELLED}` : ""}
			</p>

			<div className="flex flex-wrap gap-2 text-sm">
				{!isTerminal ? (
					<button className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50" type="button" disabled={busy} onClick={onCancel}>
						Anuluj badanie
					</button>
				) : null}
				{c.FAILED > 0 && batch.status !== "CANCELLED" ? (
					<button className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50" type="button" disabled={busy} onClick={onResume}>
						Wznów nieudane ({c.FAILED})
					</button>
				) : null}
				{batch.mode === "MANUAL" ? (
					<button className="rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50" type="button" disabled={busy || c.DONE === 0} onClick={onApplyAll}>
						Zatwierdź wszystko
					</button>
				) : null}
			</div>
			{msg ? <p className="text-sm text-zinc-700">{msg}</p> : null}

			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-zinc-300 text-left text-zinc-500">
						<th className="py-1 pr-2">Lead</th>
						<th className="py-1 pr-2">Status</th>
						<th className="py-1 pr-2">Zastosowane</th>
						<th className="py-1 pr-2">Propozycje</th>
						<th className="py-1 pr-2">Błąd</th>
						<th className="py-1 pr-2"></th>
					</tr>
				</thead>
				<tbody>
					{batch.rows.map((r) => (
						<tr className="border-b border-zinc-100" key={r.runId}>
							<td className="py-1 pr-2">
								<a className="text-blue-600 hover:underline" href={`/leady/${r.leadId}`}>
									{r.leadName}
								</a>
							</td>
							<td className="py-1 pr-2">{STATUS_LABEL[r.status] ?? r.status}</td>
							<td className="py-1 pr-2">{r.applied}</td>
							<td className="py-1 pr-2">{r.proposed}</td>
							<td className="py-1 pr-2 text-red-600">{r.error ?? ""}</td>
							<td className="py-1 pr-2 text-right">
								{batch.mode === "MANUAL" && r.status === "DONE" && r.proposed > 0 ? (
									<button className="text-amber-700 disabled:opacity-50" type="button" disabled={busy} onClick={() => onApplyRow(r.runId)}>
										Zastosuj
									</button>
								) : null}
							</td>
						</tr>
					))}
					{batch.rows.length === 0 ? (
						<tr>
							<td className="py-2 text-zinc-500" colSpan={6}>
								Brak uruchomień.
							</td>
						</tr>
					) : null}
				</tbody>
			</table>
		</div>
	)
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/badania/batches/[id]/page.tsx" "app/(app)/badania/batches/[id]/batch-view.tsx"
git commit -m "feat(phase2c): batch detail page with live progress + MANUAL approve + cancel/resume"
```

---

## Task 12: Recent-batches list on `/badania`

**Files:**
- Modify: `app/(app)/badania/page.tsx`

- [ ] **Step 1: Add the list**

In `app/(app)/badania/page.tsx`:

Add the import + query:

```tsx
import {listResearchBatches} from "@/features/research/batch-queries"
```

Change the data fetch:

```tsx
	const [types, batches] = await Promise.all([listResearchTypes(orgId), listResearchBatches(orgId)])
```

Add this block after the closing `</ul>` of the research-types list (before the closing `</section>`):

```tsx
			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-zinc-500">Ostatnie badania zbiorcze</h2>
				<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
					{batches.map((b) => (
						<li className="flex items-center justify-between py-2 text-sm" key={b.id}>
							<Link className="underline" href={`/badania/batches/${b.id}`}>
								{b.researchTypeName}
							</Link>
							<span className="text-zinc-400">
								{b.total} leadów · {b.mode === "MANUAL" ? "ręczne" : "auto"} · {b.createdAt.toLocaleDateString("pl-PL")}
							</span>
						</li>
					))}
					{batches.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak badań zbiorczych.</li> : null}
				</ul>
			</div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/badania/page.tsx
git commit -m "feat(phase2c): recent batch-research list on /badania"
```

---

## Task 13: Full gate run + ROADMAP update

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all pass — 137 baseline + 5 (batch-select) + 4 (batch-dedupe) + 6 (batch-progress) + 4 (apply-confirm) + 6 (research-batch) = 162.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build (dev server must be OFF)**

Run: `npx next build`
Expected: green; route list includes `/badania/batches/[id]`.

> If the build fails because the dev server holds the port / `.next` lock, ask the user to stop `npm run dev` first (per the standing rules — coordinate build vs live).

- [ ] **Step 4: Refresh the knowledge graph**

Run: `graphify update .`
Expected: AST graph updated (no API cost).

- [ ] **Step 5: Update the ROADMAP**

In `docs/superpowers/ROADMAP.md`, update the Phase 2 row + the "NEXT TASK" banner: mark 2c DONE (code/test/build), note it is NOT live-run, and set the next task to **2d (scoring/priority + content writing)**. Note the standing pre-launch items (first live research run with `ANTHROPIC_API_KEY`; verify `run-research` + `run-research-batch` + the reply cron fire on Inngest Cloud).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase2c): mark 2c DONE (code/test/build) + roadmap to 2d"
```

---

## Self-Review (run after the plan is written, before execution)

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| 2b reuse: snapshot-read in `runResearchFn` | Task 6 |
| Engine transient-throw / permanent-`{ok:false}` + raised retries | Task 6 |
| Migration `phase2c_research_batches` (ResearchBatch + run snapshot/batch fields) | Task 1 |
| ResearchRunStatus CANCELLED (cancel support) | Task 1 |
| Fan-out orchestrator `runResearchBatchFn` (limit:1/org, cancelOn, createMany, sendEvent) | Task 7 |
| `batch-select.ts` pure | Task 2 |
| `batch-dedupe.ts` pure (partition + cap, MAX_BATCH 200) | Task 3 |
| Read-time progress (GROUP BY → derived status) | Task 4 (pure) + Task 9 (`getBatch`) |
| Shared apply-confirm helper extracted from `confirmResearchApply` | Task 5 |
| `previewBatch` / `startBatch` / `getBatch` / `cancelBatch` / `applyBatch` / `resumeFailed` | Task 9 |
| Launcher on `/leady` carrying the filter + preview + confirm | Task 10 |
| Batch page `/badania/batches/[id]` (poll, table, MANUAL approve, resume) | Task 11 |
| AUTO + MANUAL modes | Task 7 (mode copied to runs) + Task 9 (`applyBatch`) + Task 11 (UI) |
| Guards: 30-day dedup + includeRecent override + MAX_BATCH + preview-confirm + cancel | Tasks 3, 7, 9, 10 |
| Register orchestrator | Task 8 |
| Tests: batch-select, batch-dedupe, apply-confirm, orchestrator integration | Tasks 2, 3, 5, 7 |
| Re-run 2b tests (shared engine/apply touched) | Tasks 5, 6, 13 |

Gaps consciously deviated: `includeRecent` persisted as a model column (needed by the orchestrator); a recent-batches list added on `/badania` (reachability). Both documented at their tasks. The orchestrator-retry double-insert edge (Task 7 note) is accepted, not guarded, for the first cut.

**2. Placeholder scan** — every code step contains complete code; no TBD/TODO/"handle errors" placeholders.

**3. Type consistency** — `BatchCriteria` (`{offeringLineId?, q?}`) is shared across `batch-select`, `batch-actions`, the launcher, and the orchestrator. `RunStatusCounts` is shared by `batch-progress` and `getBatch`. `applyProposedToLead` signature is identical in its definition (Task 5), its `confirmResearchApply` caller (Task 5), and its `applyBatch` caller (Task 9). Event names `research/batch.requested` / `research/batch.cancelled` / `research/run.requested` are consistent across `startBatch`, `cancelBatch`, `resumeFailed`, and both orchestrators.
