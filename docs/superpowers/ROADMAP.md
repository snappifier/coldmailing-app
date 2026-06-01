# Cold Mailing Tool — State & Roadmap

Last updated: 2026-05-31. This is the durable handoff: read it (plus `CLAUDE.md` + `AGENTS.md`) to resume after a context reset.

## Where we are

| Phase | Scope | Status |
|---|---|---|
| 0 Foundation | Prisma+Neon, Auth.js v5 (Google + allowlist + org membership), app shell, Inngest wired | DONE + verified |
| 1 Leads | OfferingLine, Lead, CSV/paste import (parse+map+dedupe+suppression), leads table, suppression list | DONE + verified |
| 3 Templates+Placeholders+Campaigns | Template library, custom placeholders (+reserved-key guard), pure `renderTemplate` (built-in / `{{zwrot}}` / custom / gendered `{{a\|b}}`), editor with palette + live preview, campaigns + sequence builder + lead assignment, lead edit (honorific + customFields) | DONE + verified |
| 2 Research AI | Multi-type research (messages/licea, audyt, ...) via Anthropic API + web | PARKED — blocked on the user authoring the research prompts |
| 4 Mailbox + sending | Google mailbox connect, Gmail API send, Inngest sending engine | DONE + verified |
| 5 Sequences + replies | Followup delays, reply detection, stop-on-reply, bounce/unsub | 5a reply detection DONE + verified (e2e: real reply -> CampaignLead REPLIED + repliedAt, inbound Message logged). 5b followups, 5c bounce/unsub next |
| 6 Sales pipeline | Kanban by `Lead.dealStage`, activity timeline, notes | later |
| 7 Visual design / polish | Full UI pass, dashboards, team-role UI, deliverability settings | last |

Verified end-to-end on Neon: auth (User/Account/Membership OWNER), import (dedupe+suppression), templates/placeholders/campaigns, Phase 4 mailbox connect + Gmail send (real email delivered to `SEND_OVERRIDE_TO`, `Message` SENT, `CampaignLead` DONE), and Phase 5a reply detection (real reply on a sent thread -> `CampaignLead` REPLIED + `repliedAt`, inbound `Message` logged). `tsc` 0, `vitest` 57/57, production `next build` green.

## Stack + key decisions (current as of 2026-05-31)

- Next 16.2.6, React 19.2.6, **TypeScript 6**, Tailwind v4, Prisma 7.8 (`prisma-client` generator + `@prisma/adapter-pg`, client at `@/generated/prisma/client`), Auth.js v5 beta (`next-auth` 5 beta.31 + `@auth/prisma-adapter`), **Inngest v4** (triggers inside `createFunction` config; client `isDev: NODE_ENV === "development"`), Zod 4 (`z.email()` not `z.string().email()`), Vitest 4, `@types/node` 22.
- Mechanics-first: minimal raw-Tailwind UI; full visual design is Phase 7.
- Everything org-scoped via `requireOrg()` (`lib/org.ts`); multi-tenant-ready (single org now, no billing/public signup).
- Domain model: `prisma/schema.prisma`. Pure logic lives in `features/*` (e.g. `features/templates/render.ts`, `features/leads/import.ts`, `features/leads/dedupe.ts`) and is unit-tested.

## Standing rules (enforced; see CLAUDE.md / AGENTS.md)

- Conventions: tabs, no semicolons, path comment line 1 (or line 2 after a `"use client"`/`"use server"` directive), `className` first, `import {x}` no inner spaces, NO emoji anywhere.
- Verify current library versions + best practices in the official docs before writing code that uses them.
- Persist knowledge to graphify + Obsidian: `graphify update .` after code changes; `graphify . --obsidian` after doc changes.
- Git: work on `master`; Claude/subagents may commit (no emoji in messages); the USER pushes. Never `git push`.
- Dev server: the USER runs `npm run dev` on :3000. Coordinate `next build` (needs dev OFF) vs live verification (needs dev ON).

## Test data currently in Neon (sample — can be wiped for a clean slate)

1 lead (I LO Zamość, honorific PANI, customFields.branza=liceum), 1 offering line (Strony dla szkół), 1 suppression (blok@szkola.pl), 1 placeholder (`branza`), 1 template (Audyt LO), 1 campaign (Kampania LO Q2: 1 sequence step + 1 assigned lead).

## Next steps (detailed)

### Phase 4 — Mailbox + sending (DONE + verified)
- `EmailAccount` model (provider GOOGLE, encrypted OAuth tokens, dailyLimit, send-window, timezone, warmupState, status). Add Campaign sending fields (`sendingEmailAccountId`, `scheduleConfig`).
- Connect a Google mailbox via OAuth (separate from login scope; needs `gmail.send` + read scope for replies later).
- Gmail API send; `Message` model (OUTBOUND, gmailMessageId/threadId, status).
- Inngest v4 sending engine: per-mailbox throttle, send window (e.g. Mon-Fri 8-16), randomized gaps. Single-step send first.
- **Before coding**: verify current Gmail API client + `google-auth-library` + Inngest v4 step/throttle/concurrency patterns in the docs.
- Token encryption at rest; minimal scopes.

**Status (2026-05-31):** Implemented + committed on `master` (plan Tasks 0-11): migration `phase4_mailbox_sending` (`EmailAccount`, `Message`, enums `EmailProvider`/`EmailAccountStatus`/`MessageDirection`/`MessageStatus`, `CampaignLeadStatus` += `SKIPPED`/`FAILED`, `Campaign.sendingEmailAccountId`, `CampaignLead.lastError`); `lib/crypto.ts` AES-256-GCM; pure `features/sending/{recipient,mime,schedule}.ts` + `features/campaigns/activation.ts` (all unit-tested); `features/sending/gmail.ts` send boundary (token-refresh persistence); `features/email-accounts/*` (signed-state OAuth, queries, disconnect); `app/api/mailbox/google/{connect,callback}` routes; `features/campaigns/sending-actions.ts` (`activateCampaign`/`pauseCampaign`/`setSendingMailbox`); `lib/inngest/sending.ts` `sendCampaignEmail` worker (registered in `app/api/inngest/route.ts`); `/skrzynki` page + nav link + campaign sending controls. Gates: `tsc` 0, `vitest` 49/49, `next build` green.
**Live e2e (2026-05-31, done):** GCP OAuth client created, mailbox connected at `/skrzynki` (status `CONNECTED`, tokens stored as ciphertext), seeded campaign activated, real email delivered to `SEND_OVERRIDE_TO`, `Message` logged `SENT`, `CampaignLead` -> `DONE`. Ran with `npm run dev` + the Inngest dev server (`npx inngest-cli dev`). Caveat: the test mailbox's send window was temporarily widened to all-days / 24h for an immediate send -- restore conservative hours (`sendDays`=31 Mon-Fri, `sendWindowStartMin`=480, `sendWindowEndMin`=960) before real campaigns.
**Plan deviations (intentional):** (1) pure `validateActivation` lives in `features/campaigns/activation.ts`, not inside the `use server` `sending-actions.ts` — a `use server` module may only export async functions, and this keeps the unit test off the `next-auth` import chain (which fails to resolve under vitest). (2) The consent screen requests `userinfo.email` alongside `gmail.send` so the connected mailbox address is readable (`gmail.send` alone cannot read it). (3) `planSchedule`'s day-rollover was rewritten so hitting the daily limit rolls to the next valid day (the plan draft stayed same-day); behavior locked by `features/sending/schedule.test.ts`.

### Phase 5 — Sequences + replies (decomposed into 5a / 5b / 5c)

**5a Reply detection + stop-on-reply (DONE + verified).** Committed on `master` (spec `docs/superpowers/specs/2026-05-31-phase-5a-reply-detection-design.md`, plan `docs/superpowers/plans/2026-05-31-phase-5a-reply-detection.md`): migration `phase5a_reply_detection` (`EmailAccount.lastHistoryId`, `CampaignLead.repliedAt`); `gmail.readonly` added to mailbox consent; pure `features/replies/match.ts` (matchReplies, tested); `features/replies/gmail-history.ts` (History API delta boundary, mocked test, 404-expired handling); `features/replies/queries.ts` (tracked threads + atomic recordReply); `lib/inngest/replies.ts` `scanMailboxesForReplies` (5-min cron, fan-out to CONNECTED + readonly mailboxes) + `pollMailboxReplies` (per-mailbox concurrency; `step.sendEvent`/`step.run` durable; baseline/rebaseline cursor; emits `campaign/lead.replied`); `/skrzynki` per-mailbox reply on/off hint. Gates: `tsc` 0, `vitest` 57/57, `next build` green. Mechanism = polling Gmail History API (chosen over watch+Pub/Sub: professional + near-realtime + no 7-day renewal + works on localhost). **Live e2e (2026-06-01, done):** re-consented the mailbox with `gmail.readonly`, activated a fresh send, replied from `nzzhry`; the poller matched the reply on the sent thread -> `CampaignLead` `REPLIED` (+`repliedAt`), inbound `Message` logged, `campaign/lead.replied` emitted. (Debug note: disconnecting a mailbox cascade-deletes its `Message` rows and nulls `Campaign.sendingEmailAccountId`, so a tracked thread requires a send from the *currently* connected mailbox.) Minor: inbound `Message.body` stores the sender `from` (metadata-only fetch, no snippet) — refine when the Phase 6 timeline lands.

**5b Followups / multi-step sequences (NEXT).** Steps 1..N via Inngest delays (`step.sleep`); `SEND_IF_NO_REPLY` consumes the `campaign/lead.replied` event from 5a (`step.waitForEvent`) so stop-on-reply works without rework.

**5c Bounce + unsubscribe + RODO.** Bounce/auto-reply classification -> auto-add to `Suppression`; unsubscribe link + sender identity (RODO).

### Phase 2 — Research AI (when prompts exist)
- Multiple research types (name + prompt + structured output schema). First type: messages/licea -> full name, director first name + **gender**, email (director -> secretariat fallback). Gender feeds `honorific`; results map to lead fields + `customFields`.
- Anthropic API with web tools (verify current SDK + web_search/web_fetch), Inngest fan-out batch + per-lead on-demand, scoring/priority, content writing. Use prompt caching.

### Phase 6 — Sales pipeline
- Kanban by `Lead.dealStage` (NEW/AUDIT/PROPOSAL/MEETING/OFFER/WON/LOST), per-lead activity timeline, notes.

### Phase 7 — Visual design / polish
- Full UI/UX pass, dashboards (sent/open/reply rates), team-role UI, deliverability settings. Import-column -> `customFields` mapping. Per-org sender signature (replaces `{{podpisNadawcy}}` = user name).

### Cross-cutting before launch
- Deliverability: SPF/DKIM/DMARC, conservative warmup ramp, randomized gaps, send windows, suppression honored, open-pixel OFF by default.
- RODO (PL B2B): sender identity + easy opt-out + permanent suppression; data minimization.
- Tracking policy: reply-detection ON, open OFF, click optional (custom subdomain).

## How to resume
1. Read `CLAUDE.md`, `AGENTS.md`, this file.
2. Specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
3. Knowledge graph in `graphify-out/` — `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<concept>"`; `GRAPH_REPORT.md` for architecture; Obsidian vault for navigation.
4. Migrations: `npx prisma migrate dev`. Tests: `npx vitest run`. Types: `npx tsc --noEmit`. App: the user runs `npm run dev`.
