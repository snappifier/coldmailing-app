# Cold Mailing Tool — Phase 5a: Reply detection + stop-on-reply (Design)

- Date: 2026-05-31
- Phase: 5a (first sub-phase of Phase 5 "Sequences + replies")
- Depends on: Phase 4 (EmailAccount + OAuth, Gmail send boundary, `Message` with `gmailThreadId`, Inngest engine, `CampaignLead.status`)
- Status: Design approved in brainstorm; pending written-spec review

## 0. Phase 5 decomposition (decided in brainstorm)

Phase 5 ("Sequences + replies") is split into three independent sub-phases, each with its own spec -> plan -> implementation cycle, built in this order:

- **5a — Reply detection + stop-on-reply** (this spec). Foundational: followups' `SEND_IF_NO_REPLY` condition and stop-on-reply both depend on knowing a lead replied.
- **5b — Followups / multi-step sequences** (steps 1..N via Inngest delays; `SEND_IF_NO_REPLY` consumes the `campaign/lead.replied` event from 5a).
- **5c — Bounce + unsubscribe + RODO** (auto-suppression, unsubscribe link, sender identity).

## 1. Purpose & scope

Detect when a lead replies to an email we sent, mark `CampaignLead.status = REPLIED`,
record the reply, and stop the sequence (no further sends). Detection is near-realtime
via an Inngest cron that polls the Gmail History API per connected mailbox (delta by
`historyId`) — no Gmail `watch`/Pub/Sub, no public webhook, no 7-day renewal, works on
localhost. On a match we also emit a `campaign/lead.replied` event so the followup engine
(5b) can stop sequences with zero rework.

**Definition of done**
- Prisma migrated on Neon (`EmailAccount.lastHistoryId`, `CampaignLead.repliedAt`).
- A connected mailbox re-consented with `gmail.readonly`; status stays `CONNECTED`.
- A real reply to a sent thread flips that `CampaignLead` to `REPLIED` (with `repliedAt`), logs an inbound `Message`, and emits `campaign/lead.replied` within one poll interval.
- `npx tsc --noEmit` clean, `npx vitest run` green (incl. new pure-logic tests), production `next build` green.

## 2. Decisions locked (from brainstorm)

- **Mechanism = polling via Gmail History API** (Inngest cron), not `watch`/Pub/Sub. Rationale: professional + "in a pinch" realtime + no 7-day renewal + runs on localhost. Push can be added later if deployed to a public URL and sub-minute latency is wanted.
- **Poll interval = 5 min** (configurable via the cron schedule). "Near-realtime" at minute granularity is acceptable.
- **Scope = `gmail.readonly`** added to the mailbox consent (alongside `gmail.send` + `userinfo.email`). Mailbox must be **re-connected once**. (`gmail.metadata` is narrower but constrains History API usage; `readonly` is the robust choice.)
- **Any inbound message in a tracked thread = REPLIED** in v1. Bounce / auto-reply classification is sub-phase 5c.
- **Log the inbound reply** as a `Message(direction = INBOUND)` (minimal fields) for the future activity timeline (Phase 6).
- **Forward-compat**: emit `campaign/lead.replied { campaignLeadId }` on every detected reply, even though nothing consumes it yet (5b will).
- **Engine shape = event-per-mailbox**, mirroring Phase 4: a cron fans out one poll event per connected mailbox; a worker polls that mailbox (concurrency keyed by mailbox).

## 3. Schema changes (`prisma/schema.prisma`)

- `EmailAccount.lastHistoryId String?` — delta cursor (last synced Gmail `historyId` for the mailbox).
- `CampaignLead.repliedAt DateTime?` — when the reply was detected (`status = REPLIED` already exists in `CampaignLeadStatus`).
- `Message` reuse: inbound replies are stored as `Message` rows with `direction = INBOUND`. For an inbound row, `intendedTo`/`actualTo` carry the mailbox address (the recipient of the reply); `subject`/`body` carry the reply subject/snippet; `status` is left at its default (`QUEUED`; not meaningful for inbound). `campaignLeadId`/`emailAccountId`/`gmailMessageId`/`gmailThreadId` link it.

Migration: `npx prisma migrate dev --name phase5a_reply_detection` (additive; dev server OFF).

## 4. OAuth scope change (`features/email-accounts/google-oauth.ts`)

- Add `GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"` to the `buildConsentUrl` scope array (now `[gmail.send, userinfo.email, gmail.readonly]`).
- The existing connect/callback flow is unchanged otherwise; re-running "Połącz skrzynkę Google" upgrades the stored tokens + `scope`. The mailbox list (`/skrzynki`) should surface whether a mailbox has the read scope (so the user knows to re-connect). Minimal: show `scope` or a "reply detection: on/off" hint derived from whether `scope` contains `gmail.readonly`.

## 5. Detection flow (Inngest)

Two functions in `lib/inngest/replies.ts`, registered in `app/api/inngest/route.ts`:

**`scanMailboxesForReplies`** — cron trigger (`triggers: {cron: "*/5 * * * *"}`):
- Load `EmailAccount` where `status = CONNECTED` and `scope` contains `gmail.readonly`.
- `inngest.send` one `campaign/mailbox.poll { emailAccountId }` per mailbox (fan-out).

**`pollMailboxReplies`** — event trigger (`campaign/mailbox.poll`), `concurrency: {limit: 1, key: "event.data.emailAccountId"}`:
1. Load the `EmailAccount`; build the Gmail client (existing `oauthClientFor`).
2. If `lastHistoryId` is null: baseline it from `users.getProfile().historyId`, persist, return (nothing to compare yet).
3. Else `users.history.list({ userId: "me", startHistoryId: lastHistoryId, historyTypes: ["messageAdded"] })`, following `nextPageToken`.
4. Collect added messages; for each, get minimal metadata (`users.messages.get` with `format: "metadata"`, headers `From`, `Subject`) → `{ gmailMessageId, threadId, from, subject, labelIds }`.
5. Build `trackedThreads`: map of `gmailThreadId -> campaignLeadId` for outbound `Message`s of this mailbox whose `CampaignLead` is not already in a terminal reply state (`REPLIED`/`UNSUBSCRIBED`).
6. `matchReplies(...)` (pure, sec. 6) -> list of `{ campaignLeadId, gmailMessageId, threadId }`, deduped to the first reply per lead. (The worker enriches each with the `from`/`subject` it fetched in step 4 when writing the inbound `Message`.)
7. For each match (in `step.run` for durability): create inbound `Message`, set `CampaignLead.status = REPLIED` + `repliedAt = now`, `inngest.send({ name: "campaign/lead.replied", data: { campaignLeadId } })`.
8. Persist the newest `historyId` to `EmailAccount.lastHistoryId`.

## 6. Pure logic (`features/replies/match.ts`)

```
interface AddedMessage { gmailMessageId: string; threadId: string; from: string; labelIds: string[] }
interface MatchInput { mailboxEmail: string; added: AddedMessage[]; trackedThreads: Record<string, string> } // threadId -> campaignLeadId
interface ReplyMatch { campaignLeadId: string; gmailMessageId: string; threadId: string }
function matchReplies(input: MatchInput): ReplyMatch[]
```

Rules (unit-tested):
- Skip our own outbound: `labelIds` includes `"SENT"`, or `from` equals `mailboxEmail` (case-insensitive).
- Keep only messages whose `threadId` is in `trackedThreads`.
- Dedup to one match per `campaignLeadId` (first occurrence).

This is the only logic with branching worth isolating; Gmail calls + Prisma are thin impure boundaries around it.

## 7. Error handling / edge cases

- **`historyId` expired** (Gmail 404 / `failedPrecondition`): re-baseline from `users.getProfile().historyId` and continue. Replies in the missed gap are not detected (acceptable v1; log a warning).
- **Token refresh fails / revoked**: existing pattern -> `EmailAccount.status = ERROR`; the cron skips ERROR mailboxes (only scans `CONNECTED`).
- **Auto-replies / bounce messages**: counted as REPLIED in v1 (5c refines). Documented.
- **Lead already REPLIED**: excluded from `trackedThreads`, so idempotent across polls.
- **Multiple leads sharing one thread**: not expected (one thread per lead send); if it happens, the thread maps to the single `CampaignLead` that owns that outbound `Message`.

## 8. Testing strategy

- **Unit (pure):** `matchReplies` — own-message filtering (SENT label, self From), thread matching, dedup per lead.
- **Boundary (mocked):** `pollMailboxReplies` happy path with mocked `googleapis` (`history.list`, `messages.get`, `getProfile`): baseline-on-first-run, then a tracked reply -> Message(INBOUND) + status REPLIED + event sent + `lastHistoryId` advanced.
- **Manual e2e:** re-consent the test mailbox (readonly); reply to the seeded send thread; within the interval the `CampaignLead` flips to `REPLIED` with `repliedAt`, an inbound `Message` is logged, and `campaign/lead.replied` fires (visible in the Inngest dev panel).
- Gates: `tsc` 0, `vitest` green, `next build` green.

## 9. Verification gates (read official docs before coding — standing rule)

- **Gmail API (googleapis 173.x):** `users.getProfile` (`historyId`), `users.history.list` (`startHistoryId`, `historyTypes`, pagination, expired-history error shape), `users.messages.get` `format: "metadata"` + `metadataHeaders`. Confirm against the installed client.
- **Inngest v4:** cron trigger shape (`triggers: {cron}`) and fan-out via `inngest.send` array; `concurrency` key; confirm against `node_modules/inngest`.
- **Prisma 7.8:** additive `migrate dev`.

## 10. New / changed files (proposed)

```
prisma/schema.prisma                         # EmailAccount.lastHistoryId, CampaignLead.repliedAt (+ migration)
features/email-accounts/google-oauth.ts      # MODIFY: add gmail.readonly to consent scopes
features/replies/match.ts                    # NEW: pure matchReplies            (+ match.test.ts)
features/replies/gmail-history.ts            # NEW: getProfile + history.list + metadata-get boundary
features/replies/queries.ts                  # NEW: trackedThreads for a mailbox; mark-replied write
lib/inngest/replies.ts                       # NEW: scanMailboxesForReplies (cron) + pollMailboxReplies  (+ mocked test)
app/api/inngest/route.ts                     # MODIFY: register both functions
app/(app)/skrzynki/page.tsx                  # MODIFY (optional): show reply-detection on/off per mailbox
```

## 11. Out of scope (explicit)

- Followups / multi-step sequences consuming `campaign/lead.replied` -> **5b**.
- Bounce / auto-reply classification, unsubscribe handling, RODO sender identity -> **5c**.
- Gmail `watch` + Pub/Sub push (sub-minute realtime) -> later, if deployed publicly.
- Reading/parsing reply bodies beyond a snippet; threading UI / conversation view -> Phase 6/7.
