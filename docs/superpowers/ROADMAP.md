# Cold Mailing Tool — State & Roadmap

Last updated: 2026-05-31. This is the durable handoff: read it (plus `CLAUDE.md` + `AGENTS.md`) to resume after a context reset.

## Where we are

| Phase | Scope | Status |
|---|---|---|
| 0 Foundation | Prisma+Neon, Auth.js v5 (Google + allowlist + org membership), app shell, Inngest wired | DONE + verified |
| 1 Leads | OfferingLine, Lead, CSV/paste import (parse+map+dedupe+suppression), leads table, suppression list | DONE + verified |
| 3 Templates+Placeholders+Campaigns | Template library, custom placeholders (+reserved-key guard), pure `renderTemplate` (built-in / `{{zwrot}}` / custom / gendered `{{a\|b}}`), editor with palette + live preview, campaigns + sequence builder + lead assignment, lead edit (honorific + customFields) | DONE + verified |
| 2 Research AI | Multi-type research (messages/licea, audyt, ...) via Anthropic API + web | PARKED — blocked on the user authoring the research prompts |
| 4 Mailbox + sending | Google mailbox connect, Gmail API send, Inngest sending engine | CODE COMPLETE + static-verified (tsc 0, vitest 49/49, `next build` green); live OAuth+send pending GCP creds + manual e2e |
| 5 Sequences + replies | Followup delays, reply detection, stop-on-reply, bounce/unsub | after 4 |
| 6 Sales pipeline | Kanban by `Lead.dealStage`, activity timeline, notes | later |
| 7 Visual design / polish | Full UI pass, dashboards, team-role UI, deliverability settings | last |

Verified end-to-end on Neon: auth (User/Account/Membership OWNER), import (dedupe+suppression), templates/placeholders/campaigns. `tsc` 0, `vitest` 24/24, production `next build` green.

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

### Phase 4 — Mailbox + sending (CODE COMPLETE — live e2e pending)
- `EmailAccount` model (provider GOOGLE, encrypted OAuth tokens, dailyLimit, send-window, timezone, warmupState, status). Add Campaign sending fields (`sendingEmailAccountId`, `scheduleConfig`).
- Connect a Google mailbox via OAuth (separate from login scope; needs `gmail.send` + read scope for replies later).
- Gmail API send; `Message` model (OUTBOUND, gmailMessageId/threadId, status).
- Inngest v4 sending engine: per-mailbox throttle, send window (e.g. Mon-Fri 8-16), randomized gaps. Single-step send first.
- **Before coding**: verify current Gmail API client + `google-auth-library` + Inngest v4 step/throttle/concurrency patterns in the docs.
- Token encryption at rest; minimal scopes.

**Status (2026-05-31):** Implemented + committed on `master` (plan Tasks 0-11): migration `phase4_mailbox_sending` (`EmailAccount`, `Message`, enums `EmailProvider`/`EmailAccountStatus`/`MessageDirection`/`MessageStatus`, `CampaignLeadStatus` += `SKIPPED`/`FAILED`, `Campaign.sendingEmailAccountId`, `CampaignLead.lastError`); `lib/crypto.ts` AES-256-GCM; pure `features/sending/{recipient,mime,schedule}.ts` + `features/campaigns/activation.ts` (all unit-tested); `features/sending/gmail.ts` send boundary (token-refresh persistence); `features/email-accounts/*` (signed-state OAuth, queries, disconnect); `app/api/mailbox/google/{connect,callback}` routes; `features/campaigns/sending-actions.ts` (`activateCampaign`/`pauseCampaign`/`setSendingMailbox`); `lib/inngest/sending.ts` `sendCampaignEmail` worker (registered in `app/api/inngest/route.ts`); `/skrzynki` page + nav link + campaign sending controls. Gates: `tsc` 0, `vitest` 49/49, `next build` green.
**Remaining (pending USER):** create a GCP OAuth client (type Web, Gmail API enabled, yourself as test user), set `GOOGLE_MAILBOX_CLIENT_ID`/`_SECRET` in `.env` (other Phase-4 keys already set), then run the live e2e (plan Task 12 steps 3-5): connect a mailbox at `/skrzynki`, activate the seeded campaign, confirm the email lands at `SEND_OVERRIDE_TO`, `Message` is `SENT`, `CampaignLead` is `DONE`. Inngest dev server needed locally for the worker to run. Only after that does Phase 4 become DONE + verified.
**Plan deviations (intentional):** (1) pure `validateActivation` lives in `features/campaigns/activation.ts`, not inside the `use server` `sending-actions.ts` — a `use server` module may only export async functions, and this keeps the unit test off the `next-auth` import chain (which fails to resolve under vitest). (2) The consent screen requests `userinfo.email` alongside `gmail.send` so the connected mailbox address is readable (`gmail.send` alone cannot read it). (3) `planSchedule`'s day-rollover was rewritten so hitting the daily limit rolls to the next valid day (the plan draft stayed same-day); behavior locked by `features/sending/schedule.test.ts`.

### Phase 5 — Sequences + replies
- Followup steps fire via Inngest delays (`step.sleep` / `step.waitForEvent("lead.replied", timeout: delayDays)`).
- Reply detection (Gmail watch + Pub/Sub, or polling) -> mark `CampaignLead.status = REPLIED`, stop sequence.
- Bounce + unsubscribe handling -> auto-add to `Suppression`. Unsubscribe link + sender identity (RODO).

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
