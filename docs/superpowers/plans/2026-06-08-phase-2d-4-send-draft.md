# Phase 2d-4 — Send the per-lead draft in a sequence step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a sequence step send the lead's `LeadDraft` (subject + body) verbatim instead of a rendered template, deferring (event-driven, 7-day timeout) when the draft is not yet ready.

**Architecture:** A per-step opt-in boolean (`SequenceStep.useLeadDraft`) selects the content source. A pure helper (`resolveDraftDecision`) maps `(useLeadDraft, draft)` to `"template" | "draft" | "wait"`. The verified sending worker (`runLeadSequence`) acts on that decision inside its existing SEND branch: template -> unchanged render path; draft -> send `LeadDraft` verbatim; wait -> `step.waitForEvent("research/draft.ready", timeout "7d", matched by leadId)` then re-decide (send if now ready, else advance without sending). `runDraftFn` (on DONE) and `saveDraft` emit `research/draft.ready {leadId, organizationId}`; `campaign/lead.start` gains `leadId` so the `waitForEvent` `if` can match.

**Tech Stack:** Next 16, Prisma 7.8, Inngest v4.5.0 (`step.waitForEvent` / `step.sendEvent`), Zod 4, Vitest 4, TypeScript 6.

**Invariant (highest-risk change in Phase 2):** steps with `useLeadDraft === false` take a behaviorally identical path — no draft query, no `waitForEvent`, identical DB writes and `sendEmail` calls. Guarded by the existing mutation-proven `sending.test.ts` plus a new explicit regression case.

---

## File structure

- `prisma/schema.prisma` — add `SequenceStep.useLeadDraft Boolean @default(false)` (migration `phase2d4_send_draft`).
- `features/sequences/draft-send.ts` (new, pure) + `features/sequences/draft-send.test.ts` — `resolveDraftDecision`.
- `lib/inngest/sending.ts` — `SequenceStepTools += waitForEvent`; draft decision + verbatim send inside the SEND branch.
- `lib/inngest/sending.test.ts` — extend with draft cases (draft DONE / wait-then-ready / wait-timeout / regression).
- `lib/inngest/draft.ts` — emit `research/draft.ready` after the save step.
- `features/research/draft-actions.ts` — `saveDraft` emits `research/draft.ready`.
- `features/campaigns/sending-actions.ts` — add `leadId` to the `campaign/lead.start` event.
- `features/campaigns/schema.ts` — `sequenceStepSchema += useLeadDraft`.
- `features/campaigns/actions.ts` — `addSequenceStep` persists `useLeadDraft`.
- `app/(app)/kampanie/[id]/sequence-and-leads.tsx` + `app/(app)/kampanie/[id]/page.tsx` — checkbox + step-list marker + prop.

---

## Task 1: Migration — add `SequenceStep.useLeadDraft`

**Files:**
- Modify: `prisma/schema.prisma:475-487` (model `SequenceStep`)
- Create: `prisma/migrations/<timestamp>_phase2d4_send_draft/migration.sql` (generated)

- [ ] **Step 1: Add the field to the schema**

In `model SequenceStep`, add `useLeadDraft` after `condition`:

```prisma
model SequenceStep {
	id         String            @id @default(cuid())
	campaignId String
	order      Int
	templateId String
	delayDays  Int               @default(0)
	condition  SequenceCondition @default(SEND_IF_NO_REPLY)
	useLeadDraft Boolean         @default(false)

	campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
	template Template @relation(fields: [templateId], references: [id], onDelete: Restrict)

	@@unique([campaignId, order])
}
```

- [ ] **Step 2: Create the migration WITHOUT applying or seeding (protects Neon data)**

Run: `npx prisma migrate dev --name phase2d4_send_draft --create-only`
Expected: a new `prisma/migrations/<ts>_phase2d4_send_draft/migration.sql` is created; the DB is NOT touched yet.

- [ ] **Step 3: Verify the generated SQL is the single additive column**

Read `prisma/migrations/<ts>_phase2d4_send_draft/migration.sql`.
Expected exactly (modulo formatting):

```sql
ALTER TABLE "SequenceStep" ADD COLUMN "useLeadDraft" BOOLEAN NOT NULL DEFAULT false;
```

If it contains anything destructive (DROP / data loss), STOP and investigate.

- [ ] **Step 4: Apply the migration + regenerate the client**

Run: `npx prisma migrate deploy`
Expected: `1 migration applied` (`phase2d4_send_draft`).
Run: `npx prisma generate`
Expected: client regenerated at `@/generated/prisma/client` with `useLeadDraft` on `SequenceStep`.

- [ ] **Step 5: Typecheck (schema field is now on the typed client)**

Run: `npx tsc --noEmit`
Expected: 0 errors (no code uses the field yet).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase2d-4): add SequenceStep.useLeadDraft (migration phase2d4_send_draft)"
```

---

## Task 2: Pure content-source decision (`resolveDraftDecision`)

**Files:**
- Create: `features/sequences/draft-send.ts`
- Test: `features/sequences/draft-send.test.ts`

- [ ] **Step 1: Write the failing test**

Create `features/sequences/draft-send.test.ts`:

```typescript
// features/sequences/draft-send.test.ts
import {describe, it, expect} from "vitest"
import {resolveDraftDecision} from "@/features/sequences/draft-send"

const done = {status: "DONE", subject: "Cześć", body: "Treść maila"}

describe("resolveDraftDecision", () => {
	it("returns 'template' when the flag is off (even with a DONE draft)", () => {
		expect(resolveDraftDecision(false, done)).toBe("template")
		expect(resolveDraftDecision(false, null)).toBe("template")
	})

	it("returns 'draft' when the flag is on and the draft is DONE with non-empty subject + body", () => {
		expect(resolveDraftDecision(true, done)).toBe("draft")
	})

	it("returns 'wait' when the flag is on but there is no draft", () => {
		expect(resolveDraftDecision(true, null)).toBe("wait")
	})

	it("returns 'wait' when the flag is on and the draft is not DONE", () => {
		expect(resolveDraftDecision(true, {status: "QUEUED", subject: "x", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "RUNNING", subject: "x", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "FAILED", subject: "x", body: "y"})).toBe("wait")
	})

	it("returns 'wait' when DONE but subject or body is blank/whitespace", () => {
		expect(resolveDraftDecision(true, {status: "DONE", subject: "   ", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "DONE", subject: "x", body: ""})).toBe("wait")
	})
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run features/sequences/draft-send.test.ts`
Expected: FAIL — cannot resolve `@/features/sequences/draft-send`.

- [ ] **Step 3: Write the minimal implementation**

Create `features/sequences/draft-send.ts`:

```typescript
// features/sequences/draft-send.ts

export type DraftDecision = "template" | "draft" | "wait"

export interface DraftForSend {
	status: string
	subject: string
	body: string
}

// Pure: choose the content source for a sequence step.
// - flag off            -> render the template (unchanged behavior)
// - flag on + ready      -> send the lead's draft verbatim
// - flag on + not ready  -> wait for the draft to become ready
export function resolveDraftDecision(useLeadDraft: boolean, draft: DraftForSend | null): DraftDecision {
	if (!useLeadDraft) return "template"
	if (draft && draft.status === "DONE" && draft.subject.trim() !== "" && draft.body.trim() !== "") return "draft"
	return "wait"
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run features/sequences/draft-send.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add features/sequences/draft-send.ts features/sequences/draft-send.test.ts
git commit -m "feat(phase2d-4): resolveDraftDecision (pure content-source helper)"
```

---

## Task 3: Sending worker — draft decision + verbatim send (the careful part)

**Files:**
- Modify: `lib/inngest/sending.ts` (`SequenceStepTools` interface ~30-33; SEND branch ~102-135; createFunction body ~171-179)
- Test: `lib/inngest/sending.test.ts`

Write the tests first (they fail), then change the worker.

- [ ] **Step 1: Extend the test harness with a draft mock + `waitForEvent` tool**

In `lib/inngest/sending.test.ts`:

(1a) Add `draft` to the hoisted state — change the `vi.hoisted` block to include it:

```typescript
const h = vi.hoisted(() => ({
	cLead: null as any,
	campaign: null as any,
	account: null as any,
	steps: [] as any[],
	messages: [] as any[],
	draft: null as any,
	sendEmail: vi.fn(async () => ({gmailMessageId: "gm", gmailThreadId: "gt"})),
}))
```

(1b) Add the `leadDraft` model to the prisma mock (inside the `vi.mock("@/lib/prisma", ...)` object, alongside `suppression`):

```typescript
		suppression: {findUnique: vi.fn(async () => null)},
		leadDraft: {findUnique: vi.fn(async () => h.draft)},
```

(1c) Give the campaign-lead fixture a `leadId` (the worker queries the draft by it). In `beforeEach`, change the `h.cLead` line to:

```typescript
	h.cLead = {id: "cl1", campaignId: "camp1", leadId: "lead1", status: "ACTIVE", currentStep: 0, nextSendAt: new Date("2026-06-01T06:00:00Z"), repliedAt: null}
```

(1d) Reset the draft in `beforeEach` (add after `h.steps = []`):

```typescript
	h.draft = null
```

(1e) Add `useLeadDraft` to the `step` factory and `waitForEvent` to the `tools` helper:

```typescript
function step(order: number, condition: "ALWAYS" | "SEND_IF_NO_REPLY", delayDays: number, useLeadDraft = false) {
	return {order, condition, delayDays, useLeadDraft, template: {subject: "S", body: "B"}}
}

function tools(onSleep?: (id: string) => void, onWait?: () => void): SequenceStepTools {
	return {
		sleepUntil: async (id) => {
			if (onSleep) onSleep(id)
		},
		run: async (_id, fn) => fn(),
		waitForEvent: async (_id) => {
			if (onWait) onWait()
			return null
		},
	}
}
```

- [ ] **Step 2: Add the new draft test cases**

Append inside the `describe("runLeadSequenceHandler", ...)` block (after the existing cases):

```typescript
	it("sends the lead draft verbatim when useLeadDraft and the draft is DONE", async () => {
		h.steps = [step(0, "ALWAYS", 0, true)]
		h.draft = {status: "DONE", subject: "DRAFT SUBJ", body: "DRAFT BODY"}
		await runLeadSequenceHandler("cl1", tools())
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.messages).toHaveLength(1)
		expect(h.messages[0].subject).toBe("DRAFT SUBJ")
		expect(h.messages[0].body).toBe("DRAFT BODY")
		expect(h.cLead.status).toBe("DONE")
	})

	it("waits for the draft, then sends it once it becomes ready", async () => {
		h.steps = [step(0, "ALWAYS", 0, true)]
		h.draft = null // not ready when the step first fires
		await runLeadSequenceHandler("cl1", tools(undefined, () => {
			h.draft = {status: "DONE", subject: "READY SUBJ", body: "READY BODY"}
		}))
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.messages[0].subject).toBe("READY SUBJ")
		expect(h.cLead.status).toBe("DONE")
	})

	it("advances without sending when the draft never becomes ready (wait times out)", async () => {
		h.steps = [step(0, "ALWAYS", 0, true)]
		h.draft = null // stays null through the wait
		await runLeadSequenceHandler("cl1", tools())
		expect(h.sendEmail).not.toHaveBeenCalled()
		expect(h.messages).toHaveLength(0)
		expect(h.cLead.currentStep).toBe(1)
		expect(h.cLead.status).toBe("DONE") // only step skipped -> finalized
	})

	it("never queries the draft or waits when useLeadDraft is false (regression guard)", async () => {
		h.steps = [step(0, "ALWAYS", 0, false)]
		const waitSpy = vi.fn(async () => null)
		const t = tools()
		t.waitForEvent = waitSpy
		await runLeadSequenceHandler("cl1", t)
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.messages[0].subject).toBe("S") // rendered template, not a draft
		expect(waitSpy).not.toHaveBeenCalled()
		expect((prisma.leadDraft.findUnique as any).mock.calls).toHaveLength(0)
	})
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx vitest run lib/inngest/sending.test.ts`
Expected: the 4 new cases FAIL (worker still renders the template / `waitForEvent` not wired); the existing cases still PASS.

- [ ] **Step 4: Add `waitForEvent` to `SequenceStepTools` and wire it in the createFunction body**

In `lib/inngest/sending.ts`, change the interface (lines 30-33):

```typescript
export interface SequenceStepTools {
	sleepUntil: (id: string, time: Date) => Promise<void>
	run: <T>(id: string, fn: () => Promise<T> | T) => Promise<T>
	waitForEvent: (id: string, opts: {event: string; timeout: string; if: string}) => Promise<unknown>
}
```

And the `tools` object in the createFunction body (lines 173-177):

```typescript
		const tools: SequenceStepTools = {
			sleepUntil: (id, time) => step.sleepUntil(id, time),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			run: (id, fn) => (step.run as any)(id, fn),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			waitForEvent: (id, opts) => (step.waitForEvent as any)(id, opts),
		}
```

- [ ] **Step 5: Import the pure helper**

Add to the imports at the top of `lib/inngest/sending.ts` (after the `decideStep` import on line 8):

```typescript
import {resolveDraftDecision} from "@/features/sequences/draft-send"
```

- [ ] **Step 6: Replace the content + send block inside the SEND branch**

In `runLeadSequenceHandler`, the SEND branch currently (lines 102-135) builds `renderLead`/`ctx`, renders subject/body, resolves the recipient, sends, and logs. Replace that entire block (from the `const renderLead: RenderLead = {` line through the closing of the `log-${order}` `step.run`) with:

```typescript
				// Content source: rendered template (default) or the lead's AI draft (opt-in per step).
				let subject: string
				let body: string
				let draftNotReady = false
				if (sequenceStep.useLeadDraft) {
					const loadDraft = () =>
						prisma.leadDraft.findUnique({
							where: {organizationId_leadId: {organizationId: cl.campaign.organizationId, leadId: cl.leadId}},
							select: {status: true, subject: true, body: true},
						})
					let draft = await loadDraft()
					let decision = resolveDraftDecision(true, draft)
					if (decision === "wait") {
						// Defer until the draft is generated/saved; matched to this run's lead.
						await step.waitForEvent(`wait-draft-${order}`, {
							event: "research/draft.ready",
							timeout: "7d",
							if: "async.data.leadId == event.data.leadId",
						})
						draft = await loadDraft()
						decision = resolveDraftDecision(true, draft)
					}
					if (decision === "draft" && draft) {
						// Verbatim: the draft is already fully written, personalized text.
						subject = draft.subject
						body = draft.body
					} else {
						// Still not ready after the wait window -> skip this step (advance, do not send).
						subject = ""
						body = ""
						draftNotReady = true
					}
				} else {
					const renderLead: RenderLead = {
						organizationName: cl.lead.organizationName,
						contactPersonName: cl.lead.contactPersonName,
						city: cl.lead.city,
						website: cl.lead.website,
						aiHook: cl.lead.aiHook,
						honorific: cl.lead.honorific,
						customFields: (cl.lead.customFields as Record<string, unknown> | null) ?? null,
					}
					const ctx = {lead: renderLead, senderName: account.displayName ?? "", placeholders}
					subject = renderTemplate(sequenceStep.template.subject, ctx).rendered
					body = renderTemplate(sequenceStep.template.body, ctx).rendered
				}

				if (draftNotReady) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: order + 1}})
				} else {
					const {to} = resolveRecipient(cl.lead.email, process.env.SEND_OVERRIDE_TO)

					// Let send/log errors propagate so Inngest retries the step; FAILED is set by onFailure once retries are exhausted (setting it here would HARD_STOP the retry).
					const ids = await step.run(`gmail-send-${order}`, () => sendEmail(account, {to, subject, text: body}))
					await step.run(`log-${order}`, async () => {
						await prisma.message.create({
							data: {
								organizationId: cl.campaign.organizationId,
								campaignLeadId: cl.id,
								emailAccountId: account.id,
								subject,
								body,
								intendedTo: cl.lead.email!,
								actualTo: to,
								gmailMessageId: ids.gmailMessageId,
								gmailThreadId: ids.gmailThreadId,
								status: "SENT",
								sentAt: new Date(),
							},
						})
						await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: order + 1}})
					})
				}
```

Note: the `!cl.lead.email` and `suppression` gates above this block stay exactly as they are. For `useLeadDraft === false`, `draftNotReady` stays false and the `else` render branch + the send/log block run identically to today (no draft query, no `waitForEvent`).

- [ ] **Step 7: Run the full sending suite to verify all pass**

Run: `npx vitest run lib/inngest/sending.test.ts`
Expected: PASS — the 4 new cases plus all pre-existing cases (6 handler + 3 failure).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add lib/inngest/sending.ts lib/inngest/sending.test.ts
git commit -m "feat(phase2d-4): send LeadDraft verbatim in a sequence step (decision + waitForEvent), useLeadDraft=false path unchanged"
```

---

## Task 4: Draft-ready signal (`research/draft.ready`)

The worker's `wait` branch resumes on `research/draft.ready {leadId, organizationId}`. Emit it from both draft-completion paths, and add `leadId` to `campaign/lead.start` so the `waitForEvent` `if` can match.

**Files:**
- Modify: `lib/inngest/draft.ts` (after the `save` step, ~55)
- Modify: `features/research/draft-actions.ts` (`saveDraft`, ~44)
- Modify: `features/campaigns/sending-actions.ts` (selects ~30-40; event emit ~79-84)

- [ ] **Step 1: Emit `research/draft.ready` after `runDraftFn` saves a DONE draft**

In `lib/inngest/draft.ts`, the `save` step is the last action before `return {ok: true}`. Add a `step.sendEvent` between them:

```typescript
		await step.run("save", () => prisma.leadDraft.update({where: {id: draftId}, data: {subject: out.subject, body: out.body, status: "DONE", error: null}}))
		await step.sendEvent("draft-ready", {name: "research/draft.ready", data: {leadId: lead.id, organizationId: draft.organizationId}})
		return {ok: true}
```

(`lead` is `draft.lead` loaded above; `draft.organizationId` is in scope.)

- [ ] **Step 2: Emit `research/draft.ready` after a manual `saveDraft`**

In `features/research/draft-actions.ts` `saveDraft`, after the `upsert` and before `revalidatePath` (the `inngest` client is already imported):

```typescript
		update: {subject: subject.trim(), body: body.trim(), status: "DONE", error: null},
	})
	await inngest.send({name: "research/draft.ready", data: {leadId, organizationId: orgId}})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true}
```

(`startDraft` must NOT emit — it sets `QUEUED`, not `DONE`. Leave it unchanged.)

- [ ] **Step 3: Add `leadId` to the `campaign/lead.start` event**

In `features/campaigns/sending-actions.ts`:

(3a) Include `leadId` in both campaign-lead selects (the planner uses the campaignLead id as `leadId`, so we need the real lead id too). Change the `pendingLeads` select (lines 31-34) and the `inflightLeads` select (lines 36-40):

```typescript
	const pendingLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: "PENDING"},
		select: {id: true, leadId: true},
		orderBy: {createdAt: "asc"},
	})
	// Resume: leads still mid-sequence from a previously paused campaign (a step remains).
	const inflightLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: {in: ["ACTIVE", "REPLIED"]}, currentStep: {lte: maxOrder}},
		select: {id: true, leadId: true},
		orderBy: {createdAt: "asc"},
	})
```

(3b) Build a campaignLeadId -> leadId lookup and put `leadId` on the emitted event. Replace the `await inngest.send(...)` block (lines 79-84):

```typescript
	const leadIdByCampaignLead = new Map<string, string>()
	for (const l of [...pendingLeads, ...inflightLeads]) leadIdByCampaignLead.set(l.id, l.leadId)

	await inngest.send(
		[...plan, ...resumePlan].map((p) => ({
			name: "campaign/lead.start",
			data: {campaignLeadId: p.leadId, campaignId, emailAccountId: account.id, leadId: leadIdByCampaignLead.get(p.leadId)!},
		})),
	)
```

(Note: `p.leadId` from the planner is the *campaignLead* id — existing naming. The new `leadId` field is the real `Lead.id`.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Run the full test suite (no behavior should regress)**

Run: `npx vitest run`
Expected: PASS — 181 prior + 5 new draft-send + 4 new sending = 190.

- [ ] **Step 6: Commit**

```bash
git add lib/inngest/draft.ts features/research/draft-actions.ts features/campaigns/sending-actions.ts
git commit -m "feat(phase2d-4): emit research/draft.ready (runDraftFn + saveDraft) and add leadId to campaign/lead.start"
```

---

## Task 5: Sequence builder — opt-in checkbox + marker

**Files:**
- Modify: `features/campaigns/schema.ts:9-14` (`sequenceStepSchema`)
- Modify: `features/campaigns/actions.ts:52-60` (`addSequenceStep` create)
- Modify: `app/(app)/kampanie/[id]/sequence-and-leads.tsx` (props + step list + add-step form)
- Modify: `app/(app)/kampanie/[id]/page.tsx:58-64` (steps map)

- [ ] **Step 1: Add `useLeadDraft` to the step schema**

In `features/campaigns/schema.ts`, extend `sequenceStepSchema`:

```typescript
export const sequenceStepSchema = z.object({
	campaignId: z.string().trim().min(1),
	templateId: z.string().trim().min(1, "Wybierz szablon"),
	delayDays: z.coerce.number().int().min(0).max(365),
	condition: z.enum(["ALWAYS", "SEND_IF_NO_REPLY"]),
	useLeadDraft: z.coerce.boolean().default(false),
})
```

(An unchecked checkbox is absent from the FormData -> `.default(false)`; a checked one sends `"on"` -> `z.coerce.boolean()` -> `true`.)

- [ ] **Step 2: Persist the flag in `addSequenceStep`**

In `features/campaigns/actions.ts`, add `useLeadDraft` to the `sequenceStep.create` data:

```typescript
	await prisma.sequenceStep.create({
		data: {
			campaignId: parsed.data.campaignId,
			order: (last?.order ?? -1) + 1,
			templateId: parsed.data.templateId,
			delayDays: parsed.data.delayDays,
			condition: parsed.data.condition,
			useLeadDraft: parsed.data.useLeadDraft,
		},
	})
```

- [ ] **Step 3: Pass `useLeadDraft` through the page to the client component**

In `app/(app)/kampanie/[id]/page.tsx`, add `useLeadDraft` to the steps map (the `include`d steps already carry all scalars):

```tsx
				steps={campaign.steps.map((s) => ({
					id: s.id,
					order: s.order,
					delayDays: s.delayDays,
					condition: s.condition,
					templateName: s.template.name,
					useLeadDraft: s.useLeadDraft,
				}))}
```

- [ ] **Step 4: Add the prop type, the marker, and the checkbox**

In `app/(app)/kampanie/[id]/sequence-and-leads.tsx`:

(4a) Extend the `steps` prop type in `interface Props`:

```tsx
	steps: {id: string; order: number; delayDays: number; condition: string; templateName: string; useLeadDraft: boolean}[]
```

(4b) Show a marker on draft steps — change the step `<span>` (the `#{s.order + 1} ...` line) to:

```tsx
								<span>
									#{s.order + 1} · {s.useLeadDraft ? "draft AI" : s.templateName} · po {s.delayDays} dniach · {s.condition}
									{s.useLeadDraft ? <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-700">draft</span> : null}
								</span>
```

(4c) Add the checkbox to the add-step form — insert before the submit `<button>` (after the `condition` select):

```tsx
						<label className="flex items-center gap-1 text-sm text-zinc-700">
							<input type="checkbox" name="useLeadDraft" />
							Wyślij draft AI (zamiast szablonu)
						</label>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add features/campaigns/schema.ts features/campaigns/actions.ts "app/(app)/kampanie/[id]/sequence-and-leads.tsx" "app/(app)/kampanie/[id]/page.tsx"
git commit -m "feat(phase2d-4): sequence-builder checkbox + step marker for useLeadDraft"
```

---

## Task 6: Final gates + roadmap update

**Files:**
- Modify: `docs/superpowers/ROADMAP.md` (mark 2d-4 DONE)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS, 190 tests (181 prior + 9 new).

- [ ] **Step 3: Lint**

Run: `npx eslint . --max-warnings=0` (or the project's `npm run lint`)
Expected: clean.

- [ ] **Step 4: Production build (dev server must be OFF)**

Run: `npm run build`
Expected: green; `/kampanie/[id]` still in the route list.

- [ ] **Step 5: Update the roadmap**

In `docs/superpowers/ROADMAP.md`, move the **▶ NEXT TASK** pointer off 2d-4 and mark 2d-4 DONE + verified (code/test/build), noting it is the first change to the sending worker, the `useLeadDraft===false` path is regression-guarded, and it is NOT live-run (drafts need a funded `ANTHROPIC_API_KEY`). Update the Phase 2 table row and the test count.

- [ ] **Step 6: Refresh the knowledge graph (AST-only)**

Run: `graphify update .`
Expected: graph updated, no API cost.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase2d-4): mark send-draft DONE (code/test/build) + roadmap to next, refresh graph"
```

---

## Self-review

**Spec coverage:**
- `SequenceStep.useLeadDraft` migration (additive) -> Task 1. ✓
- Pure `resolveDraftDecision` (template/draft/wait) -> Task 2. ✓
- Worker: load draft when flag on, decide, draft -> verbatim send, wait -> `step.waitForEvent("research/draft.ready", timeout 7d, match leadId)` then re-decide, timeout -> advance without sending -> Task 3. ✓
- Invariant `useLeadDraft===false` byte-identical (no draft query, no waitForEvent) -> Task 3 Step 6 structure + regression test (Task 3 Step 2, case d). ✓
- `research/draft.ready` from `runDraftFn` (on DONE) + `saveDraft`; `startDraft` does not emit -> Task 4 Steps 1-2. ✓
- `campaign/lead.start` gains `leadId` -> Task 4 Step 3. ✓
- Sequence-builder checkbox + marker + schema + action + page query -> Task 5. ✓
- Tests: draft-send unit (template/draft/wait) + sending integration (draft DONE / wait-then-ready / timeout / regression) + full-suite rerun -> Tasks 2, 3, 6. ✓
- Gates tsc/vitest/build -> Task 6. ✓

**Placeholder scan:** no TBD/TODO/"handle edge cases" — every code step shows the exact code. ✓

**Type consistency:** `resolveDraftDecision(useLeadDraft: boolean, draft: DraftForSend | null): "template"|"draft"|"wait"` used identically in Task 2 (def) and Task 3 (call with the `{status,subject,body}|null` prisma result; `DraftStatus` enum is assignable to `string`). `SequenceStepTools.waitForEvent(id, {event, timeout, if})` defined in Task 3 Step 4 and stubbed in Task 3 Step 1e. `useLeadDraft` field name consistent across schema, migration, worker, UI, and the `step()` test factory. ✓

**Risk notes carried from the spec:**
- During a deploy, in-flight `campaign/lead.start` events emitted before this change lack `leadId`; a draft step on such a run would never match `research/draft.ready` and wait the full 7d, then advance without sending. Acceptable graceful degradation; new activations carry `leadId`.
- `templateId` stays required for draft steps (unused at send) — documented wart.
- A multi-step sequence with several `useLeadDraft` steps sends the SAME single draft each time (one draft per lead). Intended: initial step = draft, followups = templates.
- Not live-run (drafts need a funded `ANTHROPIC_API_KEY`); the send path is exercised by tests + tsc/build. Live e2e before trusting in production.
