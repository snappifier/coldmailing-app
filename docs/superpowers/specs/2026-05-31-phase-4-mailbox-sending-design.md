# Cold Mailing Tool — Phase 4: Mailbox + Sending (Design)

- Date: 2026-05-31
- Phase: 4 (Mailbox + sending)
- Depends on: Phase 0 (Inngest wired, Auth, org scoping), Phase 1 (Lead, Suppression), Phase 3 (Campaign, SequenceStep, CampaignLead, Template, `renderTemplate`)
- Status: Design approved in brainstorm; pending written-spec review

## 1. Purpose & scope

Phase 4 makes the tool actually send. It connects a real Google mailbox over
OAuth, sends the **first sequence step** of an `ACTIVE` campaign to every enrolled
`CampaignLead`, paced like a human (per-mailbox daily limit, send window,
randomized gaps), checks suppression before every send, and logs each email as a
`Message`. The engine is the event-per-lead Inngest pattern ("each email is its
own durable job"), chosen because Phase 5 followups and stop-on-reply bolt onto
it cleanly.

**Definition of done**
- Prisma schema migrated on Neon (`EmailAccount`, `Message`, enums, `Campaign`/`CampaignLead` additions).
- A real Google mailbox connects via OAuth; tokens stored **encrypted**; status `CONNECTED`; access token auto-refreshes.
- Activating the existing test campaign (1 step, 1 lead) with `SEND_OVERRIDE_TO` set delivers a real email to the test inbox; `Message` logged `SENT` with Gmail ids; `CampaignLead` → `DONE`; daily limit + send window + suppression all honored.
- `npx tsc --noEmit` clean, `npx vitest run` green (incl. new pure-logic tests), production `next build` green.

## 2. Decisions locked (from brainstorm)

- **Real Gmail from the start**, guarded by `SEND_OVERRIDE_TO`: every outbound is rerouted to one test address regardless of the lead's email until the env var is removed. Nothing can reach a real school during development.
- **Engine = Approach A** (one durable Inngest job per lead, paced via a precomputed `nextSendAt`; `concurrency` keyed by mailbox as a safety belt).
- **Pacing lives on `EmailAccount`** (mailbox-level daily limit / window / gaps), not per-campaign. `Campaign` only points at the sending mailbox. Per-campaign schedule overrides are deferred.
- **Body is `text/plain`** in v1 (best deliverability, simplest MIME). Light HTML is a later refinement.
- **Minimal Gmail scope: `gmail.send` only.** Read scope (for reply detection) is added in Phase 5, not now.
- **Mailbox OAuth is a dedicated flow**, separate from the Auth.js login flow, so the sending mailbox is decoupled from the login identity.

## 3. Schema changes (`prisma/schema.prisma`)

New enums:

```prisma
enum EmailProvider {
	GOOGLE
}

enum EmailAccountStatus {
	CONNECTED
	ERROR
	DISCONNECTED
}

enum MessageDirection {
	OUTBOUND
	INBOUND
}

enum MessageStatus {
	QUEUED
	SENT
	FAILED
	BOUNCED
}
```

New `EmailAccount` model (org-scoped, encrypted tokens, pacing config):

```prisma
model EmailAccount {
	id                 String             @id @default(cuid())
	organizationId     String
	provider           EmailProvider      @default(GOOGLE)
	email              String
	displayName        String?
	accessTokenEnc     String             // AES-256-GCM ciphertext
	refreshTokenEnc    String             // AES-256-GCM ciphertext
	tokenExpiresAt     DateTime?
	scope              String?
	dailyLimit         Int                @default(40)
	sendWindowStartMin Int                @default(480)  // 08:00 local
	sendWindowEndMin   Int                @default(960)  // 16:00 local
	sendDays           Int                @default(31)   // bitmask, bit0=Mon..bit6=Sun; 31 = Mon-Fri
	timezone           String             @default("Europe/Warsaw")
	minGapSec          Int                @default(180)
	maxGapSec          Int                @default(600)
	status             EmailAccountStatus @default(CONNECTED)
	createdAt          DateTime           @default(now())
	updatedAt          DateTime           @updatedAt

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	messages     Message[]
	campaigns    Campaign[]

	@@unique([organizationId, email])
}
```

New `Message` model (one row per actual email):

```prisma
model Message {
	id             String           @id @default(cuid())
	organizationId String
	campaignLeadId String
	emailAccountId String
	direction      MessageDirection @default(OUTBOUND)
	subject        String
	body           String
	intendedTo     String           // the lead's real email (audit trail)
	actualTo       String           // address actually sent to (== SEND_OVERRIDE_TO when set)
	gmailMessageId String?
	gmailThreadId  String?
	status         MessageStatus    @default(QUEUED)
	error          String?
	sentAt         DateTime?
	createdAt      DateTime         @default(now())

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	campaignLead CampaignLead @relation(fields: [campaignLeadId], references: [id], onDelete: Cascade)
	emailAccount EmailAccount @relation(fields: [emailAccountId], references: [id], onDelete: Cascade)

	@@index([emailAccountId, sentAt])
	@@index([campaignLeadId])
}
```

Edits to existing models:
- `Campaign`: add `sendingEmailAccountId String?` + `sendingEmailAccount EmailAccount? @relation(...)`.
- `CampaignLead`: add `lastError String?`; reuse existing `status`, `currentStep`, `nextSendAt`; add `messages Message[]` back-relation.
- `CampaignLeadStatus`: add `SKIPPED` (suppressed / no email) and `FAILED` (send permanently failed) to the existing `PENDING ACTIVE REPLIED BOUNCED UNSUBSCRIBED DONE`.
- `Organization`: add `emailAccounts EmailAccount[]` and `messages Message[]` back-relations.

Migration: `npx prisma migrate dev` (additive; no destructive change to existing rows).

## 4. Mailbox connect (OAuth, dedicated flow)

Separate from Auth.js login. Two Next 16 route handlers:
- `app/api/mailbox/google/connect/route.ts` (GET): build the Google consent URL via `google-auth-library` `OAuth2Client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/gmail.send"] })`, set a signed `state`, redirect.
- `app/api/mailbox/google/callback/route.ts` (GET): verify `state`, exchange `code` for tokens, read the mailbox address (Gmail `users.getProfile` / userinfo), `upsert` `EmailAccount` with **encrypted** tokens (`@@unique([organizationId, email])`), redirect back to the mailbox page.

Env (dedicated OAuth client; may be the same GCP client as login but kept as its own vars for clarity):
- `GOOGLE_MAILBOX_CLIENT_ID`, `GOOGLE_MAILBOX_CLIENT_SECRET`, `GOOGLE_MAILBOX_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY` (base64, 32 bytes) for AES-256-GCM
- `SEND_OVERRIDE_TO` (dev safety guard)

Token encryption — `lib/crypto.ts`:
- `encryptSecret(plain: string): string` and `decryptSecret(enc: string): string`, Node `crypto` AES-256-GCM, stored as `iv:authTag:ciphertext` (base64 parts). Key from `TOKEN_ENCRYPTION_KEY`.
- Tokens are decrypted only in memory at send time. On refresh, persist the re-encrypted access token + new `tokenExpiresAt`.

Minimal UI (raw Tailwind, under the `(app)` group, e.g. `app/(app)/skrzynki/page.tsx`):
- "Połącz skrzynkę Google" button → `/api/mailbox/google/connect`.
- List of connected mailboxes with `status` and a disconnect action (server action that deletes / marks `DISCONNECTED`).
- Campaign edit gains a "sending mailbox" select (`sendingEmailAccountId`).

## 5. Sending one email

`features/sending/` (pure, testable units behind a thin Gmail boundary):
- `mime.ts` — `buildRawMessage({ from, to, subject, text }): string` → RFC 2822, base64url. Pure, unit-tested.
- `gmail.ts` — `sendEmail(account, { to, subject, text }): Promise<{ gmailMessageId, gmailThreadId }>`. Builds an `OAuth2Client` from the decrypted tokens (auto-refresh; persist refreshed token), calls Gmail `users.messages.send`. This is the only impure boundary.
- Recipient guard: `resolveRecipient(leadEmail)` returns `SEND_OVERRIDE_TO` when set, else `leadEmail`. `Message.intendedTo` always records the lead's real address; `Message.actualTo` records where it went.
- Suppression gate: before send, if the lead's email is in `Suppression` (org-scoped) → no send; `CampaignLead` → `SKIPPED`; no `Message` row is written (Messages represent real emails only).
- Body resolution: reuse `features/templates/render.ts` `renderTemplate` against the lead to resolve `{{tokens}}` for subject and body.

## 6. Inngest sending engine (Approach A)

Activation — `features/campaigns/sending-actions.ts` `activateCampaign(campaignId)` (server action, org-scoped via `requireOrg()`):
1. Validate: campaign has `sendingEmailAccountId`, at least one `SequenceStep` at `order = 0`, and ≥1 enrolled `CampaignLead` in `PENDING`.
2. Set `Campaign.status = ACTIVE`.
3. Compute a schedule: `planSchedule(...)` assigns each enrolled lead a `nextSendAt` spread across the mailbox send window, under `dailyLimit`/day, separated by a random gap in `[minGapSec, maxGapSec]`, rolling to the next valid day when a day fills or falls outside the window. Persist `nextSendAt`, set lead `status = ACTIVE`, `currentStep = 0`.
4. Emit one Inngest event per lead: `inngest.send({ name: "campaign/lead.send", data: { campaignLeadId, emailAccountId } })` (the `emailAccountId` is needed for the `concurrency` key).

Pure pacing — `features/sending/schedule.ts`:
- `planSchedule({ leadIds, now, window, dailyLimit, gapRange, sentTodayCount, timezone, rng }): { leadId, nextSendAt }[]`. Deterministic given an injected `now` and seeded `rng` → fully unit-testable. No Date.now / Math.random inside; both injected.

Worker — `lib/inngest/sending.ts`, registered in `app/api/inngest/route.ts`:

```ts
// lib/inngest/sending.ts
export const sendCampaignEmail = inngest.createFunction(
	{
		id: "send-campaign-email",
		triggers: {event: "campaign/lead.send"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
	},
	async ({event, step}) => {
		// 1. load CampaignLead (+ lead, campaign, account); exit if campaign !ACTIVE or lead !ACTIVE
		// 2. step.sleepUntil("wait-turn", nextSendAt)
		// 3. re-check window now; if outside -> recompute next slot, sleepUntil
		// 4. re-check daily limit (count today's SENT Messages for the account); if hit -> sleepUntil tomorrow's window
		// 5. suppression check; if suppressed -> mark SKIPPED, return
		// 6. render subject/body
		// 7. step.run("gmail-send", () => sendEmail(...)) -> ids
		// 8. create Message(SENT); update CampaignLead currentStep=1, status=DONE
	},
)
```

Notes:
- `concurrency.key` serializes a mailbox to one in-flight send; the precomputed `nextSendAt` does the actual spacing. (Exact `concurrency`/`sleepUntil`/`sendEvent` shapes verified against installed Inngest v4 docs before coding.)
- **Pause** = `Campaign.status = PAUSED`; in-flight jobs wake from sleep, see ≠`ACTIVE`, and exit. **Resume** re-runs activation for leads still `ACTIVE`/`PENDING` that have no `SENT` Message yet.
- Daily-limit count is derived from `Message` rows (status `SENT`, `sentAt` within the local day), not a counter field — no drift.

## 7. Error handling

- Gmail send throws → Inngest retries (default policy). On final failure: `Message.status = FAILED` + `error`, `CampaignLead.status = FAILED` + `lastError`. Other leads are unaffected (independent jobs — the Approach A payoff).
- Token refresh fails / revoked → `EmailAccount.status = ERROR`, surfaced in the mailbox UI; the worker exits early for that account.
- Bounces require reading the inbox → **Phase 5**. Phase 4 handles only synchronous send errors.

## 8. Security & deliverability

- OAuth tokens encrypted at rest (`TOKEN_ENCRYPTION_KEY`), decrypted only in memory.
- Minimal scope `gmail.send`. App access already restricted to invited org members (Phase 0).
- `SEND_OVERRIDE_TO` guard during all development/testing.
- Suppression honored before every send.
- Deferred to later phases: warmup ramp, open/click tracking (off by default), SPF/DKIM/DMARC checklist, unsubscribe footer / sender identity (lands with Phase 5 reply+unsub handling).

## 9. Testing strategy

- **Unit (vitest, pure):** `planSchedule` (window + daily limit + gaps + day-rollover, injected clock + seeded rng), `buildRawMessage` (MIME structure / base64url), `encryptSecret`/`decryptSecret` round-trip, suppression gate, `resolveRecipient` override.
- **Manual e2e:** connect a real test Gmail; set `SEND_OVERRIDE_TO`=test inbox; activate the existing seeded campaign (1 step, 1 lead); confirm the email arrives, `Message` is `SENT` with Gmail ids, `CampaignLead` is `DONE`. Then verify window/limit by enrolling a few leads and watching spacing.
- Gates before "done": `tsc` 0, `vitest` green, `next build` green.

## 10. New / changed files (proposed)

```
prisma/schema.prisma                                  # enums + EmailAccount + Message + edits
lib/crypto.ts                                         # AES-256-GCM encrypt/decrypt
app/api/mailbox/google/connect/route.ts               # OAuth start
app/api/mailbox/google/callback/route.ts              # OAuth callback -> EmailAccount
app/(app)/skrzynki/page.tsx                           # mailbox list + connect button (raw UI)
features/email-accounts/actions.ts                    # connect/disconnect, requireOrg-scoped
features/email-accounts/queries.ts
features/sending/mime.ts                              # pure MIME builder
features/sending/schedule.ts                          # pure pacing (planSchedule)
features/sending/gmail.ts                             # Gmail send boundary (OAuth2 + refresh)
features/sending/recipient.ts                         # resolveRecipient (override guard)
features/campaigns/sending-actions.ts                 # activateCampaign / pause / resume
lib/inngest/sending.ts                                # sendCampaignEmail function
app/api/inngest/route.ts                              # register sendCampaignEmail
*.test.ts                                             # alongside each pure module
```

## 11. Verification gates (read official docs before coding — standing rule)

- **Inngest v4**: `createFunction` `concurrency` / `throttle`, `step.sleepUntil`, `step.run`, `step.sendEvent` / `inngest.send`, event-data typing, serve registration. Confirm against the installed version.
- **Gmail API**: `users.messages.send` (raw base64url), `users.getProfile`. Decide `googleapis` (official client) vs REST + token; verify installed/latest.
- **google-auth-library**: `OAuth2Client` `generateAuthUrl`, `getToken`, `setCredentials`, refresh handling.
- **Next.js 16**: route-handler GET + `redirect()` / `NextResponse`, reading search params — read `node_modules/next/dist/docs/`.
- **Prisma 7.8**: `migrate dev` for the additive change.
- Node `crypto` AES-256-GCM is stable (no version risk).

## 12. Out of scope (explicit)

- Followup steps / multi-step sequences / delays beyond step 0 → **Phase 5**.
- Reply detection + stop-on-reply → **Phase 5**.
- Bounce / unsubscribe auto-suppression → **Phase 5**.
- Warmup ramp, open/click tracking, deliverability DNS UI → **Phase 7 / launch**.
- Multiple sending mailboxes / rotation, Microsoft 365 / generic SMTP → later (behind `EmailAccount.provider`).
