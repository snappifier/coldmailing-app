# Cold Mailing Tool — Phase 5b: Followups / multi-step sequences (Design)

- Date: 2026-06-01
- Phase: 5b (second sub-phase of Phase 5 "Sequences + replies")
- Depends on: Phase 4 (Gmail send boundary, `Message`, Inngest sending engine, `CampaignLead.status`/`currentStep`/`nextSendAt`) and Phase 5a (reply detection: `CampaignLead.repliedAt`/`REPLIED`, `campaign/lead.replied` event)
- Status: Implemented and verified — tsc 0, vitest 74/74 (incl. a mutation-proven orchestrator integration test), `next build` green. Live Gmail send+reply e2e not run (optional; 5a reply detection is already e2e-verified and 5b only reads `repliedAt`). See the plan and commits `ec1694b`..`f5e4597`.

## 1. Purpose & scope

Send sequence steps `1..N` (today only `order: 0` sends), each after its own `delayDays`,
honoring each step's `condition` (`ALWAYS` | `SEND_IF_NO_REPLY`) against whether the lead has
replied. Stop-on-reply is enforced by reading `CampaignLead.repliedAt` (set by 5a) at each
step's send time — `SEND_IF_NO_REPLY` steps skip once a reply exists; `ALWAYS` steps still send.
A campaign with the default all-`SEND_IF_NO_REPLY` steps therefore behaves as "a reply stops the
sequence"; `ALWAYS` is the opt-in escape hatch (e.g. an acknowledgment or breakup mail).

**Definition of done**
- A campaign with ≥2 steps and a short delay sends step 0, then step 1 after its delay (window/limit honored).
- A reply received before a later `SEND_IF_NO_REPLY` step → that step is skipped; an `ALWAYS` step still fires.
- A lead that completes its sequence ends `DONE`; a lead that ever replied ends `REPLIED` (REPLIED wins over DONE).
- Pausing a campaign halts in-flight followups; re-activating resumes them from their `currentStep`.
- `npx tsc --noEmit` clean, `npx vitest run` green (incl. new pure-logic tests), production `next build` green.
- No Prisma migration (the model already carries every field this phase needs).

## 2. Decisions locked (from brainstorm)

- **Followups = new standalone emails.** Each step renders its own template (own subject/body); no Gmail threading, no `In-Reply-To`/`References`/`threadId` reuse. `mime.ts`/`gmail.ts` are unchanged. (Reply detection still works across the multiple threads a lead accrues — see §6.)
- **Honor per-step condition.** On reply (`repliedAt` set by 5a): `SEND_IF_NO_REPLY` steps are skipped, `ALWAYS` steps still send. The lead's terminal status reflects the reply (`REPLIED`), not `DONE`.
- **Stop-on-reply needs no `waitForEvent`.** Since the action on a reply is "do not send," reading `repliedAt` at the moment of each send is equivalent to racing the `campaign/lead.replied` event — and more robust (DB state is the source of truth; the event is best-effort). 5a's event remains emitted but 5b does not depend on consuming it.
- **Orchestration = a durable per-lead orchestrator** (`runLeadSequence`), the idiomatic Inngest drip-sequence shape; the per-mailbox send throttle stays on the actual Gmail send (see §3, primary vs contingency).
- **No schema change.** `currentStep`, `nextSendAt`, `repliedAt`, `status` and `SequenceStep.{order,delayDays,condition}` already exist.

## 3. Orchestration architecture

Replace the single-shot `sendCampaignEmail` (sends `order: 0`, then sets `DONE`/`currentStep: 1`)
with a durable orchestrator **`runLeadSequence`** that owns a lead's whole sequence. Trigger:
`campaign/lead.start { campaignLeadId, emailAccountId }`, emitted by activation and resume
(rename of today's `campaign/lead.send`).

**Where the throttle sits — decided by Task 0 of the plan (verify in Inngest v4 docs):**

- **Primary — single function.** If a run parked at `step.sleep`/`step.sleepUntil` does **not** consume a `concurrency` slot (Inngest's documented behavior; Phase 4's staggered-send design already assumes it — a list larger than the daily limit schedules `nextSendAt` days out), then put `concurrency: {limit: 1, key: "event.data.emailAccountId"}` directly on `runLeadSequence`. The `gmail-send` step executes under the cap; multi-day sleeps between steps do not. One clean function.
- **Contingency — split.** If sleeping runs **do** hold the slot, split: `runLeadSequence` carries no throttle and owns the waits + per-step logic, and calls a one-shot throttled sender (`sendOneStep`, `concurrency: {limit: 1, key: mailbox}`) via `step.invoke` per step. The orchestrator sleeps freely; only the actual send is capped.

Either way the orchestrator is the state machine; only the throttle location differs.

**Orchestrator loop** (cursor starts at the persisted `currentStep`):

1. Reload `CampaignLead` (+`campaign`, +`lead`) and the sending `EmailAccount`.
2. **Guard / stop:** stop if the campaign is not `ACTIVE`, the account is not `CONNECTED`, or the lead is in a hard-stop status (`PENDING`/`SKIPPED`/`FAILED`/`BOUNCED`/`UNSUBSCRIBED`). `REPLIED` is **not** a stop — `ALWAYS` steps still run.
3. `step = steps.find(order === cursor)`. If none → finalize (§5).
4. `decideStep(step.condition, repliedAt)` (§4): `SEND` (ALWAYS, or SEND_IF_NO_REPLY with no reply) or `SKIP`.
5. **If SEND:** apply the Phase 4 gates — send-window (defer to `nextWindowOpen` if closed), daily-limit (defer to next valid day if hit), suppression (→ `SKIPPED`, stop), missing email (→ `SKIPPED`, stop). Render the step's template (built-in/`{{zwrot}}`/custom/gendered, via existing `renderTemplate`), resolve recipient (`SEND_OVERRIDE_TO` honored), `step.run("gmail-send")`, log `Message(OUTBOUND, SENT)`. On send error after retries → `FAILED` + `lastError`, stop.
6. Persist `currentStep = cursor + 1` (in the same durable step as the success log, mirroring today's code).
7. **`planNext({steps, currentStep, repliedAt})`** (§4): either `done` (finalize, §5) or `{nextOrder, delayDays}`.
8. If continuing: `nextSlot = scheduleFollowupSlot(now, delayDays, account)` (window snap + randomized gap, §8); `step.sleepUntil(nextSlot)`; set `cursor = nextOrder`; loop to step 1.

## 4. Pure decision module (unit-tested) — `features/sequences/plan.ts`

```
type StepDef = {order: number; condition: "ALWAYS" | "SEND_IF_NO_REPLY"; delayDays: number}

type NextPlan =
	| {done: true; finalStatus: "DONE" | "REPLIED"}
	| {done: false; nextOrder: number; delayDays: number}

// SEND if ALWAYS, or SEND_IF_NO_REPLY with no reply yet; otherwise SKIP.
function decideStep(condition: SequenceCondition, repliedAt: Date | null): "SEND" | "SKIP"

// After advancing past the processed step (currentStep already incremented),
// decide whether the sequence is finished (+terminal status) or what comes next.
// Optimization: if repliedAt is set AND every remaining step is SEND_IF_NO_REPLY,
// finish immediately as REPLIED (no point sleeping only to skip).
function planNext(args: {steps: StepDef[]; currentStep: number; repliedAt: Date | null}): NextPlan
```

The Inngest worker is a thin executor of these decisions plus the impure boundaries
(Prisma, Gmail, the schedule snap). This is the only branching logic worth isolating,
matching the repo pattern (pure logic in `features/*`, unit-tested — cf. `render.ts`,
`schedule.ts`, `match.ts`).

## 5. Status lifecycle

- `ACTIVE` = in sequence. The lead **stays `ACTIVE` between steps** (no longer flipped to `DONE` after `order: 0`).
- `REPLIED` is set by the 5a poller; the orchestrator never flips `REPLIED → ACTIVE`.
- **Finalization** (no more steps, or the reply-skip optimization fires): terminal status =
  `REPLIED` if `repliedAt` is set, else `DONE`. (`REPLIED` wins over `DONE`.)
- `SKIPPED` (suppressed / no email) and `FAILED` (send error after retries) are terminal, as today.

## 6. Reply detection across standalone threads (verified — no 5a change)

With standalone followups each step's send creates a `Message` with its own `gmailThreadId`.
`getTrackedThreads` (`features/replies/queries.ts`) already maps **every** outbound thread of the
mailbox (lead not `REPLIED`/`UNSUBSCRIBED`) → `campaignLeadId`, so a reply on **any** of a lead's
threads resolves to the lead. Multi-thread-per-lead works as-is.

Edge (accepted): a reply to an `ALWAYS` step that was sent **after** the lead was already
`REPLIED` is not re-tracked (the lead is excluded from `getTrackedThreads` once `REPLIED`). The
lead is already `REPLIED`, so this only misses logging a second inbound `Message`.

## 7. Pause / resume / disconnect (in-flight followups)

- **Pause:** `pauseCampaign` sets `PAUSED` and emits `campaign/paused { campaignId }`. `runLeadSequence` declares `cancelOn: [{event: "campaign/paused", if: "async.data.campaignId == event.data.campaignId"}]` (the non-deprecated `if` form; `match` is `@deprecated` in inngest 4.5.0), so sleeping orchestrators for that campaign cancel cleanly.
- **Resume:** `activateCampaign` on a `PAUSED → ACTIVE` transition re-emits `campaign/lead.start` for in-sequence leads — status `ACTIVE` or `REPLIED` **and a step still remains** (`currentStep ≤ max(order)`), which excludes finalized leads (a finalized `REPLIED`/`DONE` lead has `currentStep > max(order)`). Resume from the persisted `currentStep`, with `nextSendAt` recomputed to the next open slot. (Today `activateCampaign` only seeds `PENDING` leads; extend it to also resume in-flight leads. Initial activation of a `DRAFT` campaign is unchanged.) The orchestrator's own `decideStep`/`planNext` then correctly skips `SEND_IF_NO_REPLY` for a resumed `REPLIED` lead and only fires remaining `ALWAYS` steps.
- **Disconnect:** the `CONNECTED` guard already stops the orchestrator if the mailbox is gone (5a's cascade note: disconnect deletes `Message`s and nulls `Campaign.sendingEmailAccountId`).
- **Idempotency (optional hardening):** declare the orchestrator a singleton per `campaignLeadId` (verify Inngest v4 `singleton`) to prevent a stale sleeping run and a resumed run from double-sending. In practice `cancelOn` firing before resume is sufficient; singleton is belt-and-suspenders.

## 8. Deliverability — `scheduleFollowupSlot` (extends `features/sending/schedule.ts`)

Followups honor the same gates as step 0 (window, daily-limit, suppression — reused inline in the
worker). `scheduleFollowupSlot(now, delayDays, account)` returns the send instant for a followup:
`now + delayDays` snapped forward into the next open send-window, plus a randomized gap drawn from
`minGapSec..maxGapSec`, so same-day followups don't bunch under `concurrency: 1`. Pure and unit-tested
alongside the existing `planSchedule`/`isWithinWindow`/`nextWindowOpen`.

## 9. Error handling / edge cases

- **Send fails after retries:** `CampaignLead.status = FAILED` + `lastError`; orchestrator stops (no further steps).
- **Mailbox window closed / daily limit hit at a followup slot:** defer via `nextWindowOpen` / next valid day (reuse Phase 4 logic) — the followup waits, it is not dropped.
- **Lead replied mid-sleep:** caught at the next step's `decideStep` (`SEND_IF_NO_REPLY` → skip); the `planNext` optimization finalizes `REPLIED` immediately when no `ALWAYS` step remains.
- **Campaign paused mid-sleep:** `cancelOn` cancels the run (primary), or the next-iteration guard stops it; `currentStep` is persisted for resume.
- **Template deleted between steps:** `SequenceStep.template` relation is `onDelete: Restrict`, so a step's template cannot be deleted while referenced; render always has a template.
- **Step `delayDays = 0`:** allowed; `scheduleFollowupSlot` collapses to "next open slot + gap" (effectively immediate within the window).

## 10. Testing strategy

- **Unit (pure, `features/sequences/plan.test.ts`):** `decideStep` (ALWAYS always sends; SEND_IF_NO_REPLY sends iff no reply); `planNext` — last-step → `DONE`; replied + remaining all SEND_IF_NO_REPLY → finalize `REPLIED`; replied + a remaining `ALWAYS` → continue to it; skip-then-`ALWAYS` ordering.
- **Unit (pure):** `scheduleFollowupSlot` — window snap, daily-rollover, gap bounds (deterministic via injected `rng`, like `planSchedule`).
- **Boundary (mocked):** `runLeadSequence` happy path with mocked step boundaries (cf. 5a's mocked-`googleapis` style): step 0 sends + advances; sleep; step 1 sends; finalize `DONE`. A second case: `repliedAt` set before step 1 (SEND_IF_NO_REPLY) → skipped, finalize `REPLIED`.
- **Manual e2e (user-run, like 5a, with `npm run dev` + `npx inngest-cli dev`):** a 2-step campaign with a short delay; verify step 1 sends after the delay; then a variant where a reply lands before step 1 (SEND_IF_NO_REPLY) → step 1 skipped; and a variant with an `ALWAYS` step that fires despite the reply.
- Gates: `tsc` 0, `vitest` green, `next build` green.

## 11. Verification gates (read official docs before coding — standing rule)

- **Inngest v4 (`node_modules/inngest`):** (a) whether a run at `step.sleep`/`step.sleepUntil` consumes a `concurrency` slot — decides primary vs contingency (§3); (b) `cancelOn` event/match/`if` shape; (c) `singleton` config (if used); (d) `step.invoke` signature (contingency only). Confirm against the installed version.
- **Prisma 7.8:** confirm no migration is needed (read-only check of the schema fields used).
- Reconfirm `renderTemplate`/`resolveRecipient`/`sendEmail` signatures are reused unchanged.

## 12. New / changed files (proposed)

```
features/sequences/plan.ts                # NEW: decideStep + planNext (pure)            (+ plan.test.ts)
features/sending/schedule.ts              # MODIFY: add scheduleFollowupSlot (pure)      (+ schedule.test.ts cases)
lib/inngest/sending.ts                    # MODIFY: sendCampaignEmail -> runLeadSequence (orchestrator loop)  (+ mocked test)
features/campaigns/sending-actions.ts     # MODIFY: emit campaign/lead.start; pause emits campaign/paused; activate resumes in-flight leads
app/api/inngest/route.ts                  # MODIFY: register runLeadSequence (+ sender, contingency only)
```

(If the contingency split is chosen at Task 0: add `sendOneStep` worker; `runLeadSequence` invokes it.)

## 13. Out of scope (explicit)

- Bounce / auto-reply classification, unsubscribe link + RODO sender identity → **5c**.
- Threading followups into the original Gmail conversation (rejected this phase; could revisit in 7).
- Per-step A/B variants, send-time optimization, open/click-gated conditions → later.
- Conversation/timeline UI for the multiple threads a lead accrues → Phase 6/7.
