# Cold Mailing Tool — Design (v1)

- Date: 2026-05-30
- Repo: `coldmailing-app` (fresh Next 16 + React 19 + Tailwind v4 scaffold)
- Status: Design approved in brainstorm, pending written-spec review

## 1. Purpose

An internal cold-outreach tool for the user's web-agency side business (selling
websites/systems to schools and other institutions). It manages prospects,
organizes outreach by offering and campaign, runs AI research/enrichment over
prospect lists, sends sequenced cold emails from the user's own mailbox, detects
replies, and tracks deals through a sales pipeline. A small team shares the data.

Eventual ambition: if it proves good internally, open it up as a SaaS. v1 is
internal-only, but the data model is multi-tenant-ready so that is an added
layer, not a rewrite.

## 2. Build philosophy: mechanics-first

Explicit user directive: **build mechanics first; UI stays minimal and
functional (raw Tailwind, no design system) just enough to test behavior; full
visual design is a separate later phase.** Every phase below is scoped as
"mechanics + throwaway-quality functional UI". Visual polish is deferred to its
own pass at the end.

This front-loads the hard/risky parts (sending engine, sequences, reply
detection, AI research) and leaves styling — the cheap, low-risk part — for last.

## 3. Decisions locked (from brainstorm)

- **Sending model**: auto-send from the user's own Google Workspace / Gmail
  mailbox (OAuth), with throttling, reply detection, and bounce handling. Not an
  ESP (Resend/SES) — those prohibit cold email. Not manual.
- **Scope**: internal tool for one team now; `Organization`/`Team` is a
  first-class entity and all data is scoped by `organizationId` so a future SaaS
  move (billing, public signup, hard isolation) is additive. No billing/signup in
  v1.
- **Organizational layers** (all three requested): Offering line -> Campaign ->
  Leads, plus a sales Pipeline (deal stage) on leads that reply.
- **AI research** (all four requested): batch enrichment over a list, on-demand
  per-lead research, AI writing/personalization of email content, and
  scoring/prioritization. Powered by the Anthropic API with web access.
- **Templates**: a shared team library (team "storage"), with a user-definable
  custom placeholder system inserted via buttons (e.g. Pan/Pani honorifics).
- **Scheduling engine**: durable jobs via **Inngest** (professional standard for
  delayed multi-step sequences with retry/throttle/concurrency; integrates with
  Vercel/Next). Trigger.dev (self-hostable) or a BullMQ+Redis worker are the
  fallbacks if self-host/full control is later wanted. Send/poll/research logic
  sits behind interfaces so the engine is swappable.
- **Hosting assumption**: Vercel (mirrors the salon project). If Railway is
  chosen instead, only Inngest/cron hosting changes.

## 4. Tech stack

Mirrors the salon project (the user knows it cold):

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 (`@theme`), no config file — but **minimal styling in v1**
- Prisma + PostgreSQL on Neon
- Auth.js v5 (NextAuth), **Google OAuth** sign-in restricted to an invited-member
  allowlist
- Inngest for durable background jobs
- Anthropic SDK for AI research (prompt caching, web search tool)
- Zod for validation, date-fns / date-fns-tz (Europe/Warsaw)
- Code conventions identical to salon: tabs, no semicolons, file-path top
  comment, `className` first, `import {motion}` style, no `forwardRef`, no emoji

## 5. Domain model

All models are scoped by `organizationId` unless noted.

### Tenancy / team
- **Organization** — the team/tenant. One row in v1, first-class.
- **User** — team member (from Google OAuth).
- **Membership** — `(userId, organizationId, role: OWNER | ADMIN | MEMBER)`.
- Auth.js tables (Account, Session, VerificationToken) as required.

### Email infrastructure
- **EmailAccount** — a connected sending mailbox:
  `provider (GOOGLE)`, `email`, `displayName`, encrypted OAuth tokens,
  `dailyLimit`, send-window start/end, `timezone`, `warmupState`, `status`.

### Structure layers
- **OfferingLine** — what you sell ("Strony dla szkół", "Systemy rezerwacji").
  Top-level grouping. `name`, `description`, `color`.
- **Campaign** — a cold-mail action under an offering line:
  `offeringLineId`, `name`, `status (DRAFT | ACTIVE | PAUSED | DONE)`,
  `sendingEmailAccountId`, `scheduleConfig` (throttle, window, weekdays),
  `createdBy`.
- **SequenceStep** — a step in a campaign's sequence:
  `campaignId`, `order`, `templateId`, `delayDays`,
  `condition (SEND_IF_NO_REPLY)`.

### Leads
- **Lead** — a prospect, global per organization (a school is a stable entity
  reused across campaigns over time):
  `organizationName`, `website`, `contactPersonName`, `contactRole`, `email`,
  `phone`, `city`, `region`, `schoolType`, `siteQuality (1-5)`, `priority (1-5)`,
  `honorific (PAN | PANI | null)`, `aiHook`, `aiNotes`, `customFields (Json)`,
  `dealStage`, `ownerUserId`, `source`.
- **CampaignLead** — a lead's membership in a campaign + per-campaign sequence
  state: `campaignId`, `leadId`,
  `status (PENDING | ACTIVE | REPLIED | BOUNCED | UNSUBSCRIBED | DONE)`,
  `currentStep`, `nextSendAt`.
  - Split of concerns: **send/outreach status** lives on `CampaignLead`;
    **deal stage** (pipeline) lives on `Lead`.

### Templates & placeholders
- **Template** — reusable message in the **shared team library**:
  `name`, `subject`, `body` (with `{{tokens}}`), `isFollowup`,
  optional `offeringLineId`, `visibility (TEAM | PRIVATE)` default TEAM,
  optional folder/tags, `createdBy`.
- **Placeholder** — org-scoped custom variable the user defines:
  `key` (token, e.g. `zwrot`), `label`, `type (TEXT | CHOICE)`,
  `options (Json)` (e.g. `["Pan","Pani"]` for CHOICE), `fallback`,
  `source` (which lead field/customField it resolves from).
  - Built-in placeholders (name, organization, website, city, AI hook, sender
    signature, honorific) are always available; custom ones are added by the user.
  - Mass send resolves each placeholder **per lead** (Pan/Pani is per-lead data,
    not chosen once).

### Messages / activity
- **Message** — an actual email: `campaignLeadId`, `emailAccountId`,
  `direction (OUTBOUND | INBOUND)`, `subject`, `body`, `gmailMessageId`,
  `gmailThreadId`, `status (QUEUED | SENT | DELIVERED | BOUNCED | FAILED)`,
  `sentAt`, `repliedAt`.
- **EmailEvent** — optional opens/clicks/bounces log.

### Compliance
- **Suppression** — `email`, `reason (UNSUBSCRIBED | BOUNCED | MANUAL)`,
  `createdAt`. Global do-not-contact list, checked before every send.

### Research
- **ResearchRun** — `type (BATCH | SINGLE)`, `status`, `progress`, `input`,
  `createdBy`. Results are written back onto `Lead` fields.

## 6. Architecture & key flows

Module boundaries (each behind an interface, so Gmail/Inngest/Anthropic are
swappable): `Sender`, `ReplyDetector`, `Researcher`, `TemplateRenderer`.

1. **Import + research**: import CSV / pasted URLs -> optional batch research
   (Inngest fan-out, one job per lead -> Anthropic API with web search -> fills
   fields + hook + score) -> review in a table -> assign to a campaign.
2. **Campaign setup**: create campaign under an offering line -> pick sending
   mailbox -> build sequence (steps = template + delay) -> add leads -> activate.
3. **Sending**: activation enrolls each `CampaignLead`; Inngest schedules sends
   respecting per-mailbox throttle + window + randomized gaps -> Gmail API send ->
   log `Message` -> next step gated by `step.waitForEvent("lead.replied", timeout:
   delayDays)`.
4. **Reply handling**: Gmail watch/poll detects INBOUND -> match by `threadId` ->
   set `CampaignLead.status = REPLIED` -> emit event that stops the sequence ->
   lead can advance in the pipeline.
5. **Pipeline**: kanban of leads by `dealStage`
   (new -> audit -> proposal -> meeting -> offer -> won/lost), per-lead activity
   timeline.

## 7. Templates & placeholders UX

- **Placeholder palette** = buttons (built-in + custom); clicking inserts
  `{{token}}` at the cursor in subject/body.
- **Live preview** rendered against a sample lead.
- **Pre-send validation** flags leads with unresolved tokens / missing values,
  with per-placeholder `fallback` support.
- Custom placeholder values are populated by: CSV import (map column ->
  placeholder), AI research (e.g. infer honorific from first name), or manual edit.
- Optional helper for Polish gendered forms, e.g. `{{Szanowny|Szanowna}}`
  resolved by `honorific`. Nice-to-have, can be deferred.

## 8. Cross-cutting concerns (done professionally)

### Deliverability
- DNS: SPF + DKIM + DMARC on the sending domain (checklist; enable DKIM in Google
  Workspace).
- Warmup: conservative per-mailbox daily limit that ramps up; randomized gaps
  between sends; send window (e.g. Mon-Fri 8-16).
- Human-style content (plain-text-friendly, light HTML, at most one link to
  start).
- Open-pixel tracking **OFF by default** (hurts deliverability and is neutralized
  by Apple/Gmail anyway). Open/click tracking optional; click tracking via a
  custom tracking subdomain if enabled.
- Suppression checked before every send; hard bounces auto-suppress.

### GDPR / Polish law (B2B to public institutions)
Not legal advice; baked-in good practice:
- Clear sender identity in the footer + easy opt-out (unsubscribe link ->
  Suppression), honored permanently.
- Basis: B2B legitimate interest + publicly listed institutional addresses; data
  minimization; audit trail of when/whom/opt-out.

### Security
- OAuth tokens encrypted at rest (key from env/KMS).
- Minimal Gmail scopes: `gmail.send` + read access for reply detection
  (`gmail.readonly` or `gmail.modify` if labels are needed).
- App access restricted to invited members (email allowlist / invitations).

### Tracking policy (reversible per campaign)
Reply detection always ON, open-tracking OFF, click-tracking optional.

## 9. Phase decomposition

Each phase gets its own spec -> plan -> implementation cycle. All phases are
"mechanics + minimal functional UI"; visual design is the final phase.

- **Phase 0 — Foundation**: Prisma + Neon, Auth.js v5 Google OAuth (allowlist),
  Organization/Membership, minimal functional app shell (raw Tailwind), Inngest
  wired up (hello job).
- **Phase 1 — Leads + structure**: OfferingLine, Lead, CSV/paste import, leads
  table (filter/sort), CRUD, suppression list. No sending.
- **Phase 2 — AI research**: batch enrichment (Inngest fan-out + Anthropic API +
  web), per-lead "research" action, scoring/priority, AI hook. Early because it
  delivers value immediately and feeds leads.
- **Phase 3 — Templates + placeholders + campaigns**: shared team library, editor
  with placeholder palette, custom placeholders (Pan/Pani), campaign + sequence
  builder, lead assignment, preview/validation.
- **Phase 4 — Mailbox + sending**: Google OAuth mailbox connect, Gmail API send,
  Inngest sending engine (throttle/window), Message log. Single step first.
- **Phase 5 — Sequences + replies**: followup steps with delays, reply detection
  (poll/watch), stop-on-reply, bounce/unsubscribe handling.
- **Phase 6 — Sales pipeline**: kanban by `dealStage`, lead activity timeline,
  notes.
- **Phase 7 — Visual design / polish**: the full UI/UX pass (deferred per
  mechanics-first directive), dashboards (sent/open/reply), team-role UI,
  deliverability settings.

Order rationale: leads -> research (fills hooks) -> templates -> sending (hardest,
split 4+5) -> pipeline -> design.

## 10. First milestone: Phase 0 + Phase 1

The first spec/plan covers Phase 0 + Phase 1 together, because Phase 0 alone is
not user-visible. Outcome: a deployed app where invited team members log in via
Google, create offering lines, import a list of leads, and view/edit/filter them
in a functional table, with a working suppression list — all backed by the
multi-tenant-ready schema and a wired Inngest. No sending and no AI yet.

## 11. Open questions / deferred

- Exact `dealStage` set — start with new/audit/proposal/meeting/offer/won/lost,
  refine later.
- `Placeholder` private vs team visibility — ship TEAM first, PRIVATE optional.
- Gmail reply detection via push (watch + Pub/Sub) vs polling — start with the
  simpler one in Phase 5.
- Microsoft 365 / generic SMTP mailboxes — Google only in v1; add later behind the
  `EmailAccount.provider` field.
- Multiple sending mailboxes / rotation for scale — single mailbox first.
