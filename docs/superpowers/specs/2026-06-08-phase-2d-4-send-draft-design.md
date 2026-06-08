# Phase 2d-4 — Send the per-lead draft in a sequence step — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2d-4 of Phase 2. Builds on 2d-3 (`LeadDraft`
+ `runDraftFn`), Phase 4/5 (sending worker `runLeadSequence`). **Implementation deferred to a fresh
session** (this is the first change to the verified, live-tested sending path — design it carefully).
Not live-runnable until a funded `ANTHROPIC_API_KEY` (drafts) — but the send path itself is testable.

## Goal

Let a sequence step send the lead's `LeadDraft` (subject + body) instead of a rendered template. If the
draft is not ready (`status != DONE`) when the step fires, **defer**: wait for the draft to become ready
(event-driven, like 5b waits for a reply), with a timeout fallback. The step's `condition`
(ALWAYS / SEND_IF_NO_REPLY) is unchanged — the draft only swaps the content source.

## Key decisions (from the brainstorm)

- **Opt-in:** a per-step boolean `SequenceStep.useLeadDraft` (NOT a TEMPLATE|DRAFT source enum). `templateId`
  **stays required** (its presence is unchanged; for a draft step it is simply unused at send time). Minor
  wart accepted to avoid touching the required FK.
- **No-draft behavior:** **defer + retry** — wait for the draft, do not send a generic template, do not
  skip immediately.
- **Deferral mechanism:** `step.waitForEvent("research/draft.ready", ...)` matched by `leadId`, with a
  **7-day** timeout. On timeout: skip this step and advance the sequence (do not send, do not hard-stop
  the lead). Default chosen for least destructiveness.
- **Draft content:** sent **verbatim** (subject + body) — no token rendering (it is already fully written,
  personalized text).

## Data model (migration `phase2d4_send_draft`)

Additive: `SequenceStep += useLeadDraft Boolean @default(false)`. No other schema change. (`LeadDraft`
already exists from 2d-3; one per lead.)

## Sequence builder (config UI)

- `features/campaigns/schema.ts` `sequenceStepSchema`: add `useLeadDraft: z.coerce.boolean().default(false)`
  (parsed from a checkbox: `formData.get("useLeadDraft") === "on"` — or coerce). `templateId` stays
  required.
- `features/campaigns/actions.ts` `addSequenceStep`: persist `useLeadDraft`.
- `app/(app)/kampanie/[id]/sequence-and-leads.tsx`: a "Wyślij draft AI (zamiast szablonu)" checkbox in the
  add-step form; show a "draft" marker on steps where `useLeadDraft` in the step list. The page query that
  builds `steps` (`app/(app)/kampanie/[id]/page.tsx`) must include `useLeadDraft`.

## Content-source decision (pure)

- `features/sequences/draft-send.ts` (pure, unit-tested): `resolveDraftDecision(useLeadDraft, draft)` ->
  `"template" | "draft" | "wait"`, where `draft` is `{status, subject, body} | null`:
  - `!useLeadDraft` -> `"template"`.
  - `useLeadDraft && draft?.status === "DONE" && draft.subject.trim() && draft.body.trim()` -> `"draft"`.
  - otherwise -> `"wait"`.
- Keeps the branching out of the worker; the worker acts on the decision.

## Sending worker change (`lib/inngest/sending.ts` — the careful part)

Inside the existing SEND branch (after `decideStep === "SEND"`, after the window/limit/suppression gates),
before rendering the template:

1. Load the lead's `LeadDraft` (one query, org implied by lead) when `sequenceStep.useLeadDraft`.
2. `resolveDraftDecision(sequenceStep.useLeadDraft, draft)`:
   - `"template"` -> unchanged path: render `sequenceStep.template` subject/body (today's behavior).
   - `"draft"` -> `subject = draft.subject`, `body = draft.body` (verbatim, no `renderTemplate`); then the
     existing `resolveRecipient` + `sendEmail` + `Message` log + `currentStep` advance.
   - `"wait"` -> `await step.waitForEvent("wait-draft-<order>", {event: "research/draft.ready", timeout:
     "7d", if: "async.data.leadId == event.data.leadId"})`; then re-load the draft and
     `resolveDraftDecision` again: if `"draft"` -> send the draft; else (timeout, still not ready) ->
     advance `currentStep` without sending (skip this step) and continue the loop. One wait per step
     occurrence (bounded; no infinite loop).
3. Everything else (throttle `concurrency`, `cancelOn campaign/paused`, `singleton`, retries, onFailure,
   stop-on-reply via `repliedAt`, finalize) is unchanged.

**Invariant:** steps with `useLeadDraft === false` take a byte-identical path (no `waitForEvent`, no draft
query) — the verified behavior is untouched. Covered by the existing + new `sending.test.ts` cases.

## Draft-ready signal

- `lib/inngest/draft.ts` `runDraftFn`: after upserting `status: DONE` (the "save" step), emit
  `research/draft.ready {leadId, organizationId}`.
- `features/research/draft-actions.ts` `saveDraft`: after a manual save (status DONE), emit the same event
  (so a waiting step resumes after a manual edit too). `startDraft` does NOT emit (it sets QUEUED).
- `campaign/lead.start` (emitted by `features/campaigns/sending-actions.ts` activation/resume) gains
  `leadId` alongside the existing `{campaignLeadId, campaignId, emailAccountId}` — required so the
  `waitForEvent` `if` can match the incoming `research/draft.ready.leadId` to the run's `leadId`. The
  worker reads `leadId` from the trigger event (or from the loaded `campaignLead.leadId` — but the
  `waitForEvent` `if` CEL compares against the trigger event data, so `leadId` must be on the event).

## Modules / files

- `prisma/schema.prisma` — `SequenceStep.useLeadDraft`.
- `features/sequences/draft-send.ts` (new, pure) + test.
- `features/campaigns/schema.ts`, `features/campaigns/actions.ts` — persist the flag.
- `app/(app)/kampanie/[id]/sequence-and-leads.tsx` + `app/(app)/kampanie/[id]/page.tsx` — checkbox + marker.
- `lib/inngest/sending.ts` — draft decision + waitForEvent + verbatim send.
- `lib/inngest/draft.ts` + `features/research/draft-actions.ts` — emit `research/draft.ready`.
- `features/campaigns/sending-actions.ts` — add `leadId` to `campaign/lead.start`.

## Testing

- `draft-send.test.ts` — `resolveDraftDecision`: template when flag off; draft when DONE + non-empty; wait
  when flag on but no/incomplete draft.
- `sending.test.ts` (extend the existing mutation-proven integration test, mirroring its `SequenceStepTools`
  pattern — add a `waitForEvent` tool stub): (a) `useLeadDraft` + DONE draft -> sends draft subject/body
  (verbatim, not template); (b) `useLeadDraft` + no draft -> waits, then after the stub returns a "ready"
  signal + a now-DONE draft -> sends; (c) wait times out -> advances without sending; (d) `useLeadDraft
  === false` -> byte-identical template path (regression guard).
- Re-run the full suite (sending worker change touches shared, verified code).
- Gates: `tsc` 0, `vitest` green (181 + new), `next build` green.

## Risks / notes

- **Highest-risk change in Phase 2** — the verified, live-tested sending worker. Mitigations: the pure
  decision helper keeps logic testable; the `useLeadDraft === false` path is provably unchanged; new
  `sending.test.ts` cases + the existing mutation-proven test guard regressions. Live e2e (with a funded
  key + drafts) before trusting in production.
- `step.waitForEvent` is already used in the codebase (5b reply-wait), so the pattern + `cancelOn`/
  `singleton` interplay is known-good. Verify `waitForEvent` + the existing `concurrency`/`singleton` on
  `runLeadSequence` compose (they should — waiting holds no concurrency slot, like `sleepUntil`).
- `templateId` stays required for draft steps (unused at send) — documented wart; revisit only if it
  annoys (would require making `templateId` optional = the rejected enum approach).
- 7-day wait timeout + advance-on-timeout are defaults — easy to change in the plan if desired.
- A multi-step sequence with several `useLeadDraft` steps sends the SAME single draft each time (one draft
  per lead). Intended use: the initial step is the draft; followups use templates. Documented.
- Not live-run (drafts need a funded key); the send path is exercised by tests + tsc/build.
