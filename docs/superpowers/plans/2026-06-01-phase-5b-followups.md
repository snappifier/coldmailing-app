# Phase 5b — Followups / multi-step sequences — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send sequence steps `1..N` (today only `order 0` sends), each after its `delayDays`, honoring each step's `condition` against whether the lead replied, with pause/resume of in-flight followups.

**Architecture:** One durable per-lead Inngest orchestrator `runLeadSequence` (replaces the single-shot `sendCampaignEmail`) loops the steps: sleep to the slot → re-check gates → `decideStep` (SEND/SKIP) → reuse the Phase 4 send path → advance `currentStep` → `planNext` → sleep or finalize. The per-mailbox `concurrency:{limit:1}` throttles only the executing `gmail-send` step (sleeping runs do not hold a slot — verified, Task 0). Stop-on-reply is `repliedAt` read at send time (no `waitForEvent`). Pause cancels in-flight runs via `cancelOn`; resume re-emits the start event (`singleton mode:"cancel"` makes it idempotent). Followups are standalone emails (no Gmail threading). No Prisma migration.

**Tech Stack:** Next 16 / React 19 / TypeScript 6, Prisma 7.8 (`@/generated/prisma/client`), Inngest v4.5.0, Vitest 4, Zod 4. Spec: `docs/superpowers/specs/2026-06-01-phase-5b-followups-design.md`.

---

## File structure (decomposition)

- `features/sequences/plan.ts` (NEW) — pure `decideStep` + `planNext`. The only branching logic worth isolating; fully unit-tested. Test: `features/sequences/plan.test.ts`.
- `features/sending/schedule.ts` (MODIFY) — add pure `scheduleFollowupSlot` (delay + random gap + window snap), reusing `nextWindowOpen` + `PacingAccount`. Test: extend `features/sending/schedule.test.ts`.
- `lib/inngest/sending.ts` (MODIFY) — replace `sendCampaignEmail` with the `runLeadSequence` orchestrator. Thin glue over the pure helpers + Phase 4 send path; no unit test (repo convention: Inngest workers are verified by `tsc` + pure tests + the live e2e — cf. `lib/inngest/replies.ts`).
- `features/campaigns/activation.ts` (MODIFY) — `validateActivation` accepts `inflightLeadCount` (resume). Test: extend `features/campaigns/activation.test.ts`.
- `features/campaigns/sending-actions.ts` (MODIFY) — `activateCampaign` emits `campaign/lead.start` (+`campaignId`) and resumes in-flight leads; `pauseCampaign` emits `campaign/paused`. Server-action glue; no unit test (next-auth import chain, per the Phase 4 deviation note).
- `app/api/inngest/route.ts` (MODIFY) — register `runLeadSequence` in place of `sendCampaignEmail`.

---

## Task 0: Verification notes (no code)

Record the library facts this plan relies on (AGENTS.md: verify against installed docs before coding). These were confirmed against `node_modules/inngest@4.5.0`; re-confirm if the version changed.

- [ ] **Step 1: Confirm Inngest semantics (already verified — re-read if version changed)**

  - `concurrency.limit` limits "how many concurrent **steps** can execute at once" (`node_modules/inngest/types.d.ts:1023`). A run parked at `step.sleep`/`step.sleepUntil` is not executing a step, so it does **not** consume a concurrency slot. → `concurrency:{limit:1, key:"event.data.emailAccountId"}` may sit directly on the long-lived orchestrator (the **primary** design from the spec). The contingency split is not needed.
  - `cancelOn: Cancellation[]` with `event` + `match` (dot-path compared in both the trigger event and the cancel event) (`node_modules/inngest/components/InngestFunction.d.ts:330`, `types.d.ts:1054`). → `cancelOn:[{event:"campaign/paused", match:"data.campaignId"}]` requires `campaignId` in the trigger event data.
  - `singleton: {key?: string, mode: "skip"|"cancel"}` (`node_modules/inngest/components/InngestFunction.d.ts:316`). `mode:"cancel"` cancels the existing run and starts the new one. → resume-safe.
  - `step.sleepUntil(idOrOptions, time: Date | string | ...)` and `step.run` exist (`node_modules/inngest/components/InngestStepTools.d.ts:302,309`). The codebase's working config shape is `triggers:{event: "..."}` (see `lib/inngest/sending.ts:12`) — match it.

- [ ] **Step 2: Confirm no migration + reused signatures**

  - Schema already has every field used: `CampaignLead.{currentStep,nextSendAt,repliedAt,status}`, `SequenceStep.{order,delayDays,condition}`, `Campaign.status`, `EmailAccount` pacing fields (`prisma/schema.prisma`). No `prisma migrate` in this phase.
  - Reused unchanged: `renderTemplate(text, {lead, senderName, placeholders}).rendered` (`features/templates/render.ts`), `resolveRecipient(email, SEND_OVERRIDE_TO).to` (`features/sending/recipient.ts`), `sendEmail(account, {to,subject,text})` (`features/sending/gmail.ts`), `isWithinWindow`/`nextWindowOpen`/`planSchedule`/`PacingAccount` (`features/sending/schedule.ts`).

No commit (notes only).

---

## Task 1: Pure sequence decisions — `features/sequences/plan.ts`

**Files:**
- Create: `features/sequences/plan.ts`
- Test: `features/sequences/plan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/sequences/plan.test.ts
import {describe, it, expect} from "vitest"
import {decideStep, planNext, type StepDef} from "@/features/sequences/plan"

const NOW = new Date("2026-06-01T10:00:00Z")
const steps: StepDef[] = [
	{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
	{order: 1, condition: "SEND_IF_NO_REPLY", delayDays: 3},
	{order: 2, condition: "ALWAYS", delayDays: 2},
]

describe("decideStep", () => {
	it("ALWAYS always sends", () => {
		expect(decideStep("ALWAYS", null)).toBe("SEND")
		expect(decideStep("ALWAYS", NOW)).toBe("SEND")
	})
	it("SEND_IF_NO_REPLY sends only without a reply", () => {
		expect(decideStep("SEND_IF_NO_REPLY", null)).toBe("SEND")
		expect(decideStep("SEND_IF_NO_REPLY", NOW)).toBe("SKIP")
	})
})

describe("planNext", () => {
	it("returns the next step + its delay when steps remain", () => {
		expect(planNext({steps, currentStep: 1, repliedAt: null})).toEqual({done: false, nextOrder: 1, delayDays: 3})
	})
	it("finishes DONE after the last step with no reply", () => {
		expect(planNext({steps, currentStep: 3, repliedAt: null})).toEqual({done: true, finalStatus: "DONE"})
	})
	it("finishes REPLIED after the last step when replied", () => {
		expect(planNext({steps, currentStep: 3, repliedAt: NOW})).toEqual({done: true, finalStatus: "REPLIED"})
	})
	it("finishes REPLIED early when every remaining step is SEND_IF_NO_REPLY and replied", () => {
		const noAlways: StepDef[] = [
			{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
			{order: 1, condition: "SEND_IF_NO_REPLY", delayDays: 3},
		]
		expect(planNext({steps: noAlways, currentStep: 1, repliedAt: NOW})).toEqual({done: true, finalStatus: "REPLIED"})
	})
	it("continues to a remaining ALWAYS step even after a reply", () => {
		expect(planNext({steps, currentStep: 2, repliedAt: NOW})).toEqual({done: false, nextOrder: 2, delayDays: 2})
	})
	it("picks the next existing order when orders have gaps", () => {
		const gapped: StepDef[] = [
			{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
			{order: 2, condition: "ALWAYS", delayDays: 1},
		]
		expect(planNext({steps: gapped, currentStep: 1, repliedAt: null})).toEqual({done: false, nextOrder: 2, delayDays: 1})
	})
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run features/sequences/plan.test.ts`
Expected: FAIL — cannot resolve `@/features/sequences/plan`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// features/sequences/plan.ts
export type SequenceCondition = "ALWAYS" | "SEND_IF_NO_REPLY"

export interface StepDef {
	order: number
	condition: SequenceCondition
	delayDays: number
}

export type SendDecision = "SEND" | "SKIP"

// SEND if the step is ALWAYS, or SEND_IF_NO_REPLY and the lead has not replied. Otherwise SKIP.
export function decideStep(condition: SequenceCondition, repliedAt: Date | null): SendDecision {
	if (condition === "ALWAYS") return "SEND"
	return repliedAt ? "SKIP" : "SEND"
}

export type NextPlan =
	| {done: true; finalStatus: "DONE" | "REPLIED"}
	| {done: false; nextOrder: number; delayDays: number}

// Given the steps and the cursor AFTER advancing past the processed step, decide whether the
// sequence is finished (and its terminal status) or which step comes next and its delay.
// If the lead replied and every remaining step is SEND_IF_NO_REPLY, finish as REPLIED immediately
// (no point waking only to skip). Steps may be unsorted and orders may have gaps.
export function planNext(args: {steps: StepDef[]; currentStep: number; repliedAt: Date | null}): NextPlan {
	const remaining = args.steps.filter((s) => s.order >= args.currentStep).sort((a, b) => a.order - b.order)
	if (remaining.length === 0) return {done: true, finalStatus: args.repliedAt ? "REPLIED" : "DONE"}
	if (args.repliedAt && remaining.every((s) => s.condition === "SEND_IF_NO_REPLY")) {
		return {done: true, finalStatus: "REPLIED"}
	}
	const next = remaining[0]
	return {done: false, nextOrder: next.order, delayDays: next.delayDays}
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run features/sequences/plan.test.ts`
Expected: PASS (8 assertions across the cases).

- [ ] **Step 5: Commit**

```bash
git add features/sequences/plan.ts features/sequences/plan.test.ts
git commit -m "$(printf 'feat: pure sequence step decisions (decideStep + planNext)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Pure followup slot — `features/sending/schedule.ts`

**Files:**
- Modify: `features/sending/schedule.ts` (append `scheduleFollowupSlot`)
- Test: `features/sending/schedule.test.ts` (add a `describe`)

- [ ] **Step 1: Write the failing test (append to the existing file)**

```ts
// add to features/sending/schedule.test.ts
import {scheduleFollowupSlot} from "@/features/sending/schedule" // extend the existing import line

describe("scheduleFollowupSlot", () => {
	const rng0 = () => 0 // gap = minGapSec (300s)

	it("adds delay + gap and stays within the window", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const slot = scheduleFollowupSlot(now, 0, acct, rng0)
		expect(slot.toISOString()).toBe("2026-06-01T06:05:00.000Z") // +300s, still in window
	})

	it("applies whole-day delays", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const slot = scheduleFollowupSlot(now, 2, acct, rng0) // Wed 08:05 local
		expect(localParts(slot, TZ)).toEqual({weekdayIso: 3, minutes: 485})
	})

	it("snaps a weekend landing to Monday open", () => {
		const now = new Date("2026-06-04T06:00:00Z") // Thu 08:00 local
		const slot = scheduleFollowupSlot(now, 2, acct, rng0) // Sat -> Mon 08:00
		expect(localParts(slot, TZ)).toEqual({weekdayIso: 1, minutes: 480})
	})
})
```

(`acct`, `TZ`, `localParts` are already defined/imported at the top of the file.)

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run features/sending/schedule.test.ts`
Expected: FAIL — `scheduleFollowupSlot` is not exported.

- [ ] **Step 3: Append the implementation to `features/sending/schedule.ts`**

```ts
// The slot for a followup step: delayDays after `now`, plus a random gap in [minGapSec, maxGapSec]
// (so concurrent followups do not bunch under concurrency:1), snapped forward into the next open
// send-window. Daily-limit deferral is handled at send time by the worker (mirrors planSchedule's
// division of labor). Deterministic given `now` and `rng`.
export function scheduleFollowupSlot(now: Date, delayDays: number, account: PacingAccount, rng: () => number): Date {
	const gapSec = account.minGapSec + Math.floor(rng() * (account.maxGapSec - account.minGapSec + 1))
	const base = new Date(now.getTime() + delayDays * 86_400_000 + gapSec * 1000)
	return nextWindowOpen(base, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run features/sending/schedule.test.ts`
Expected: PASS (existing cases + 3 new).

- [ ] **Step 5: Commit**

```bash
git add features/sending/schedule.ts features/sending/schedule.test.ts
git commit -m "$(printf 'feat: scheduleFollowupSlot (delay + gap + window snap)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Orchestrator — replace `sendCampaignEmail` with `runLeadSequence`

**Files:**
- Modify: `lib/inngest/sending.ts` (full replacement of the function)
- Modify: `app/api/inngest/route.ts` (register the new function)
- Modify: `features/campaigns/sending-actions.ts:64-66` (emit `campaign/lead.start` with `campaignId`)

No unit test (repo convention — thin Inngest glue; covered by the Task 1/2 pure tests, `tsc`, and the Task 5 live e2e).

- [ ] **Step 1: Replace `lib/inngest/sending.ts` in full**

```ts
// lib/inngest/sending.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {sendEmail} from "@/features/sending/gmail"
import {renderTemplate, type RenderLead} from "@/features/templates/render"
import {resolveRecipient} from "@/features/sending/recipient"
import {isWithinWindow, nextWindowOpen, scheduleFollowupSlot} from "@/features/sending/schedule"
import {decideStep, planNext, type StepDef} from "@/features/sequences/plan"

const HARD_STOP = ["SKIPPED", "FAILED", "BOUNCED", "UNSUBSCRIBED", "DONE"]

// Mark DONE only if still in-sequence; REPLIED (and other terminal statuses) win and are left as-is.
async function finalizeLead(campaignLeadId: string): Promise<void> {
	await prisma.campaignLead.updateMany({
		where: {id: campaignLeadId, status: {notIn: ["REPLIED", "SKIPPED", "FAILED", "BOUNCED", "UNSUBSCRIBED"]}},
		data: {status: "DONE"},
	})
}

export const runLeadSequence = inngest.createFunction(
	{
		id: "run-lead-sequence",
		triggers: {event: "campaign/lead.start"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
		cancelOn: [{event: "campaign/paused", if: "async.data.campaignId == event.data.campaignId"}],
		singleton: {key: "event.data.campaignLeadId", mode: "cancel"},
		retries: 3,
	},
	async ({event, step}) => {
		const {campaignLeadId} = event.data as {campaignLeadId: string; campaignId: string; emailAccountId: string}

		// Steps + placeholders loaded once; mid-flight sequence edits are not picked up (accepted, see spec).
		const base = await prisma.campaignLead.findUnique({where: {id: campaignLeadId}, include: {campaign: true}})
		if (!base) return {skipped: "no-lead"}
		const steps = await prisma.sequenceStep.findMany({
			where: {campaignId: base.campaignId},
			include: {template: true},
			orderBy: {order: "asc"},
		})
		const stepDefs: StepDef[] = steps.map((s) => ({order: s.order, condition: s.condition, delayDays: s.delayDays}))
		const placeholders = await prisma.placeholder.findMany({
			where: {organizationId: base.campaign.organizationId},
			select: {key: true, source: true, fallback: true},
		})

		let cursor = base.currentStep
		let slot: Date = base.nextSendAt ?? new Date()

		for (let iterations = 0; iterations <= steps.length; iterations++) {
			await step.sleepUntil(`slot-${cursor}`, slot)

			// Fresh read after sleeping: status / repliedAt / currentStep may have changed.
			const cl = await prisma.campaignLead.findUnique({where: {id: campaignLeadId}, include: {campaign: true, lead: true}})
			if (!cl) return {skipped: "no-lead"}
			if (cl.campaign.status !== "ACTIVE") return {skipped: "campaign-not-active"}
			if (HARD_STOP.includes(cl.status)) return {skipped: `status-${cl.status}`}

			const account = cl.campaign.sendingEmailAccountId
				? await prisma.emailAccount.findUnique({where: {id: cl.campaign.sendingEmailAccountId}})
				: null
			if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

			// First step at/after the cursor (gap-safe and tolerant of a provisional currentStep).
			const sequenceStep = steps.find((s) => s.order >= cursor)
			if (!sequenceStep) {
				await finalizeLead(campaignLeadId)
				return {finalized: true}
			}
			const order = sequenceStep.order

			if (decideStep(sequenceStep.condition, cl.repliedAt) === "SEND") {
				// Window gate: defer to the next open slot if closed now.
				const now = new Date()
				if (!isWithinWindow(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)) {
					await step.sleepUntil(`window-${order}`, nextWindowOpen(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays))
				}
				// Daily-limit gate: if today's quota is spent, defer to the next valid day.
				const dayStart = new Date(
					new Intl.DateTimeFormat("en-CA", {timeZone: account.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date()) + "T00:00:00",
				)
				const sentToday = await prisma.message.count({where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: dayStart}}})
				if (sentToday >= account.dailyLimit) {
					await step.sleepUntil(`limit-${order}`, nextWindowOpen(new Date(Date.now() + 60_000), account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays))
				}
				// Suppression / missing-email gates.
				if (!cl.lead.email) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
					return {skipped: "no-email"}
				}
				const sup = await prisma.suppression.findUnique({
					where: {organizationId_email: {organizationId: cl.campaign.organizationId, email: cl.lead.email}},
				})
				if (sup) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
					return {skipped: "suppressed"}
				}

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
				const subject = renderTemplate(sequenceStep.template.subject, ctx).rendered
				const body = renderTemplate(sequenceStep.template.body, ctx).rendered
				const {to} = resolveRecipient(cl.lead.email, process.env.SEND_OVERRIDE_TO)

				try {
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
				} catch (err) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "FAILED", lastError: String(err).slice(0, 500)}})
					throw err // surface to Inngest after retries
				}
			} else {
				// SKIP: advance without sending.
				await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: order + 1}})
			}

			const plan = planNext({steps: stepDefs, currentStep: order + 1, repliedAt: cl.repliedAt})
			if (plan.done) {
				await finalizeLead(campaignLeadId)
				return {finalized: true}
			}

			const nextDelay = plan.delayDays
			// Compute the next slot inside a step so the rng + clock are memoized across retries.
			const computedIso = await step.run(`slot-calc-${order}`, async () =>
				scheduleFollowupSlot(new Date(), nextDelay, account, Math.random).toISOString(),
			)
			slot = new Date(computedIso)
			await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: plan.nextOrder, nextSendAt: slot}})
			cursor = plan.nextOrder
		}
		return {finalized: false, exhausted: true}
	},
)
```

- [ ] **Step 2: Update the Inngest route registration**

In `app/api/inngest/route.ts` replace the `sendCampaignEmail` import + registration with `runLeadSequence`:

```ts
// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"
import {runLeadSequence} from "@/lib/inngest/sending"
import {scanMailboxesForReplies, pollMailboxReplies} from "@/lib/inngest/replies"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, runLeadSequence, scanMailboxesForReplies, pollMailboxReplies]})
```

- [ ] **Step 3: Update activation to emit the new event (keeps initial send working)**

In `features/campaigns/sending-actions.ts`, change the send at lines 64-66 to emit `campaign/lead.start` with `campaignId`:

```ts
		await inngest.send(
			plan.map((p) => ({name: "campaign/lead.start", data: {campaignLeadId: p.leadId, campaignId, emailAccountId: account.id}})),
		)
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `triggers`/`cancelOn`/`singleton` type-error, re-read `node_modules/inngest/components/InngestFunction.d.ts` — the config object accepts all of `id`/`triggers`/`concurrency`/`cancelOn`/`singleton`/`retries`.)

- [ ] **Step 5: Commit**

```bash
git add lib/inngest/sending.ts app/api/inngest/route.ts features/campaigns/sending-actions.ts
git commit -m "$(printf 'feat: runLeadSequence orchestrator for multi-step followups\n\nReplaces single-shot sendCampaignEmail. Loops steps 1..N with per-step\ncondition + stop-on-reply via repliedAt; concurrency throttles the send\nstep; cancelOn/singleton make pause/resume safe. No schema change.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: Pause / resume of in-flight followups

**Files:**
- Modify: `features/campaigns/activation.ts` (add `inflightLeadCount`)
- Modify: `features/campaigns/activation.test.ts`
- Modify: `features/campaigns/sending-actions.ts` (`pauseCampaign` emits `campaign/paused`; `activateCampaign` resumes in-flight leads)

- [ ] **Step 1: Update `validateActivation` test for the resume case**

Replace `features/campaigns/activation.test.ts` with:

```ts
// features/campaigns/activation.test.ts
import {describe, it, expect} from "vitest"
import {validateActivation} from "@/features/campaigns/activation"

describe("validateActivation", () => {
	it("ok when mailbox, step 0 and a pending lead exist", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 3, inflightLeadCount: 0})).toEqual({ok: true})
	})
	it("ok on resume when only in-flight leads remain", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 0, inflightLeadCount: 2})).toEqual({ok: true})
	})
	it("fails without a sending mailbox", () => {
		expect(validateActivation({sendingEmailAccountId: null, hasStepZero: true, pendingLeadCount: 3, inflightLeadCount: 0}))
			.toEqual({ok: false, error: "Wybierz skrzynkę wysyłkową"})
	})
	it("fails without a first step", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: false, pendingLeadCount: 3, inflightLeadCount: 0}))
			.toEqual({ok: false, error: "Dodaj pierwszy krok sekwencji"})
	})
	it("fails without any pending or in-flight leads", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 0, inflightLeadCount: 0}))
			.toEqual({ok: false, error: "Brak leadów do wysłania"})
	})
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run features/campaigns/activation.test.ts`
Expected: FAIL — `inflightLeadCount` not on `ActivationFacts` (type error / missing field behavior).

- [ ] **Step 3: Update `features/campaigns/activation.ts`**

```ts
// features/campaigns/activation.ts
export type ActivateResult = {ok: true} | {ok: false; error: string}

export interface ActivationFacts {
	sendingEmailAccountId: string | null
	hasStepZero: boolean
	pendingLeadCount: number
	inflightLeadCount: number
}

// Pure precondition check for campaign activation / resume (unit-tested).
export function validateActivation(f: ActivationFacts): ActivateResult {
	if (!f.sendingEmailAccountId) return {ok: false, error: "Wybierz skrzynkę wysyłkową"}
	if (!f.hasStepZero) return {ok: false, error: "Dodaj pierwszy krok sekwencji"}
	if (f.pendingLeadCount + f.inflightLeadCount <= 0) return {ok: false, error: "Brak leadów do wysłania"}
	return {ok: true}
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run features/campaigns/activation.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Update `activateCampaign` + `pauseCampaign` in `features/campaigns/sending-actions.ts`**

Replace `activateCampaign` and `pauseCampaign` with:

```ts
export async function activateCampaign(campaignId: string): Promise<ActivateResult> {
	const {orgId} = await requireOrg()
	const campaign = await prisma.campaign.findFirst({
		where: {id: campaignId, organizationId: orgId},
		select: {id: true, sendingEmailAccountId: true},
	})
	if (!campaign) return {ok: false, error: "Kampania nie istnieje"}

	const stepZero = await prisma.sequenceStep.findFirst({where: {campaignId, order: 0}, select: {id: true}})
	const maxOrderAgg = await prisma.sequenceStep.aggregate({where: {campaignId}, _max: {order: true}})
	const maxOrder = maxOrderAgg._max.order ?? 0

	const pendingLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: "PENDING"},
		select: {id: true},
		orderBy: {createdAt: "asc"},
	})
	// Resume: leads still mid-sequence from a previously paused campaign (a step remains).
	const inflightLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: {in: ["ACTIVE", "REPLIED"]}, currentStep: {lte: maxOrder}},
		select: {id: true},
		orderBy: {createdAt: "asc"},
	})

	const check = validateActivation({
		sendingEmailAccountId: campaign.sendingEmailAccountId,
		hasStepZero: Boolean(stepZero),
		pendingLeadCount: pendingLeads.length,
		inflightLeadCount: inflightLeads.length,
	})
	if (!check.ok) return check

	const account = await prisma.emailAccount.findFirst({
		where: {id: campaign.sendingEmailAccountId!, organizationId: orgId},
	})
	if (!account) return {ok: false, error: "Skrzynka nie istnieje"}

	const now = new Date()
	const sentTodayCount = await prisma.message.count({
		where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: startOfLocalDayUTC(now, account.timezone)}},
	})

	// Stagger the first send for new (PENDING) leads; resume in-flight leads at the next open slots.
	const plan = planSchedule({leadIds: pendingLeads.map((l) => l.id), now, account, sentTodayCount, rng: Math.random})
	const resumePlan = planSchedule({
		leadIds: inflightLeads.map((l) => l.id),
		now,
		account,
		sentTodayCount: sentTodayCount + plan.length,
		rng: Math.random,
	})

	await prisma.$transaction([
		prisma.campaign.update({where: {id: campaignId}, data: {status: "ACTIVE"}}),
		...plan.map((p) =>
			prisma.campaignLead.update({where: {id: p.leadId}, data: {status: "ACTIVE", currentStep: 0, nextSendAt: p.nextSendAt}}),
		),
		// Resumed leads keep their status + currentStep; only the next slot is refreshed.
		...resumePlan.map((p) => prisma.campaignLead.update({where: {id: p.leadId}, data: {nextSendAt: p.nextSendAt}})),
	])

	await inngest.send(
		[...plan, ...resumePlan].map((p) => ({
			name: "campaign/lead.start",
			data: {campaignLeadId: p.leadId, campaignId, emailAccountId: account.id},
		})),
	)

	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}

export async function pauseCampaign(campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	const res = await prisma.campaign.updateMany({where: {id: campaignId, organizationId: orgId}, data: {status: "PAUSED"}})
	// Cancel in-flight orchestrators for this campaign (runLeadSequence cancelOn campaign/paused).
	if (res.count > 0) await inngest.send({name: "campaign/paused", data: {campaignId}})
	revalidatePath(`/kampanie/${campaignId}`)
}
```

(`setSendingMailbox` is unchanged. Note: `singleton mode:"cancel"` on `runLeadSequence` makes the resume re-emit idempotent even if a stale sleeping run survived.)

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/campaigns/activation.ts features/campaigns/activation.test.ts features/campaigns/sending-actions.ts
git commit -m "$(printf 'feat: pause cancels in-flight followups; activate resumes them\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Full gates, live e2e, housekeeping

**Files:** none (verification + docs)

- [ ] **Step 1: Run the full unit suite**

Run: `npx vitest run`
Expected: all green (the prior 57 + the new `plan.test.ts` cases + the 3 new schedule cases + the extra activation case).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build (coordinate: dev server OFF)**

Run: `npm run build`
Expected: green. (If `:3000` is held by the dev server, stop it first — see ROADMAP "Local dev gotchas".)

- [ ] **Step 4: Live e2e (user-run; needs `npm run dev` on :3000 + `npx inngest-cli dev`)**

Prepare a 2-step campaign on the seeded data (or add a step 1). Reset the test lead's `CampaignLead`: `status=PENDING, currentStep=0, nextSendAt=null, repliedAt=null`. Use a short `delayDays` (e.g. 0) and widen the send window only if needed (restore Mon-Fri 08-16 after — `sendDays=31, sendWindowStartMin=480, sendWindowEndMin=960`). `SEND_OVERRIDE_TO` reroutes all outbound.

  - **5b.1 followup fires:** activate → step 0 sends → after the delay, step 1 sends. Verify two OUTBOUND `Message` rows (SENT), `currentStep` advanced, lead ends `DONE`.
  - **5b.2 stop-on-reply skips SEND_IF_NO_REPLY:** reset; make step 1 `SEND_IF_NO_REPLY`; activate; reply to step 0's thread before step 1's slot; verify step 1 does NOT send and the lead ends `REPLIED` (5a poller + planNext early-finalize).
  - **5b.3 ALWAYS fires after reply:** reset; make step 1 `ALWAYS`; reply before step 1; verify step 1 STILL sends and the lead is `REPLIED`.
  - **5b.4 pause/resume:** activate a 2-step campaign; pause during the inter-step wait (Inngest panel shows the run cancelled); re-activate; verify step 1 still sends after resume.

- [ ] **Step 5: Restore conservative send window** (if widened for the test): `sendDays=31, sendWindowStartMin=480, sendWindowEndMin=960`.

- [ ] **Step 6: Housekeeping**

  - Update `docs/superpowers/ROADMAP.md`: mark 5b DONE + verified (with the e2e summary), set NEXT = 5c, note any deviations.
  - `graphify update .` (AST refresh after code), then `graphify . --obsidian` once (semantic refresh after the spec+plan docs — the deferred refresh agreed in brainstorm).
  - Commit the roadmap + graphify outputs.

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "$(printf 'docs: phase 5b followups DONE + verified; refresh knowledge graph\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-review notes (spec coverage)

- Steps 1..N on a delay → Task 3 loop + Task 2 slot. Per-step condition / stop-on-reply → Task 1 `decideStep` + worker. Status lifecycle (ACTIVE between steps, REPLIED>DONE) → `finalizeLead` + planNext finalStatus. Standalone emails → reused send path, no thread headers. Reply across threads → already works (5a, no change). Pause/resume → Task 4 + `cancelOn`/`singleton`. Deliverability gates/gap → reused inline gates + `scheduleFollowupSlot`. No migration → Task 0. All gates → Task 5.
- **Accepted edges (documented in spec):** a reply to an `ALWAYS` step sent after the lead is already `REPLIED` is not re-tracked; mid-flight sequence edits are not picked up by an already-running orchestrator; a pause landing exactly between the `gmail-send` and `log` steps may send without logging (resend on resume).
