# Phase 5a: Reply detection + stop-on-reply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when a lead replies to a sent email (Gmail History API polling, Inngest cron), mark `CampaignLead.status = REPLIED` with `repliedAt`, log an inbound `Message`, and emit `campaign/lead.replied` so the future followup engine stops sequences with zero rework.

**Architecture:** Event-per-mailbox polling, mirroring Phase 4. A 5-minute cron (`scanMailboxesForReplies`) fans out one `campaign/mailbox.poll` event per `CONNECTED` mailbox holding the `gmail.readonly` scope; a worker (`pollMailboxReplies`, concurrency keyed by mailbox) reads the Gmail history delta since the mailbox's stored `historyId`, matches new inbound messages to tracked outbound threads via a pure `matchReplies`, records replies, and advances the cursor. Pure logic lives in `features/replies/match.ts`; Gmail and Prisma are thin impure boundaries.

**Tech Stack:** Next 16.2.6, Prisma 7.8 (Neon), Inngest 4.5.0 (cron + event triggers), googleapis 173.x (Gmail `users.history.list` / `getProfile` / `messages.get`), Vitest 4.

---

## Verified facts (checked against installed packages on 2026-05-31)

- **Inngest 4.5.0**: cron trigger is `triggers: {cron: "*/5 * * * *"}` (confirmed `cron: string` in `node_modules/inngest/components/InngestFunction.d.ts:97` and `types.d.ts`); event trigger + `concurrency: {limit, key}` + `step.run` + `inngest.send(array)` as used in Phase 4 (`lib/inngest/sending.ts`).
- **googleapis 173.0.0**: `google.gmail({version:"v1", auth}).users.getProfile({userId:"me"})` returns `data.historyId`; `.users.history.list({userId:"me", startHistoryId, historyTypes:["messageAdded"], pageToken})` returns `data.history[].messagesAdded[].message.{id,threadId}`, `data.historyId`, `data.nextPageToken`; an expired `startHistoryId` rejects with HTTP 404. `.users.messages.get({userId:"me", id, format:"metadata", metadataHeaders:["From","Subject"]})` returns `data.labelIds` + `data.payload.headers`.
- **Phase 4 reuse**: `oauthClientFor(account)` and `SendableAccount` exported from `features/sending/gmail.ts`; `prisma` from `@/lib/prisma`; generated client `@/generated/prisma/client`; `inngest` from `@/lib/inngest/client`; serve registration in `app/api/inngest/route.ts`. `Message` has `direction` (`OUTBOUND|INBOUND`), `gmailThreadId`, `campaignLeadId`, `emailAccountId`, `intendedTo`, `actualTo`, `subject`, `body`. `EmailAccount` has `organizationId`, `email`, `status`, `scope`. `CampaignLeadStatus` includes `REPLIED`/`UNSUBSCRIBED`.
- **Repo conventions** (enforced): tabs, no semicolons, file-path comment line 1, `className` first, `import {x}` no inner spaces, no emoji. Commit trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. USER pushes; never `git push`. Dev server OFF for `migrate`/`build`.

---

## File structure

```
prisma/schema.prisma                       # MODIFY: EmailAccount.lastHistoryId, CampaignLead.repliedAt (+ migration)
features/email-accounts/google-oauth.ts     # MODIFY: add gmail.readonly to consent scopes
features/replies/match.ts                   # NEW: pure matchReplies            (+ match.test.ts)
features/replies/gmail-history.ts           # NEW: getProfileHistoryId + listAddedSince boundary (+ gmail-history.test.ts)
features/replies/queries.ts                 # NEW: getTrackedThreads + recordReply (Prisma)
lib/inngest/replies.ts                      # NEW: scanMailboxesForReplies (cron) + pollMailboxReplies
app/api/inngest/route.ts                    # MODIFY: register both functions
app/(app)/skrzynki/page.tsx                 # MODIFY: per-mailbox reply-detection on/off hint
```

---

## Task 0: Schema + migration

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add `lastHistoryId` to `EmailAccount`** (after the `scope` field)

```prisma
	scope              String?
	lastHistoryId      String?
```

- [ ] **Step 2: Add `repliedAt` to `CampaignLead`** (after the `lastError` field)

```prisma
	lastError   String?
	repliedAt   DateTime?
```

- [ ] **Step 3: Validate (no reformat) + migrate + generate** (dev server OFF)

Run:
```bash
npx prisma validate
npx prisma migrate dev --name phase5a_reply_detection
npx prisma generate
```
Expected: schema valid; migration created + applied to Neon; client regenerated. Do NOT run `prisma format` (it rewrites the repo's tab indentation to spaces).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schema for reply-detection history cursor and repliedAt" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1: Add `gmail.readonly` to the mailbox consent

**Files:** Modify `features/email-accounts/google-oauth.ts`

- [ ] **Step 1: Add the scope constant + include it in the consent URL**

Add the constant next to `USERINFO_EMAIL_SCOPE`:
```ts
// Read scope for reply detection (Phase 5a): read message metadata + history.
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
```
Change `buildConsentUrl` scope array to include it:
```ts
export function buildConsentUrl(state: string): string {
	return client().generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: [GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE, GMAIL_READONLY_SCOPE],
		state,
	})
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add features/email-accounts/google-oauth.ts
git commit -m "feat: request gmail.readonly scope for reply detection" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Note: existing connected mailboxes must be re-connected once to upgrade the granted scope.

---

## Task 2: `features/replies/match.ts` — pure reply matching (TDD)

**Files:** Create `features/replies/match.ts`, `features/replies/match.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/replies/match.test.ts
import {describe, it, expect} from "vitest"
import {matchReplies} from "@/features/replies/match"

const tracked = {"t-1": "lead-1", "t-2": "lead-2"}

describe("matchReplies", () => {
	it("matches an inbound message on a tracked thread", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [{gmailMessageId: "m1", threadId: "t-1", from: "Dyrektor <dyr@szkola.pl>", labelIds: ["INBOX"]}],
			trackedThreads: tracked,
		})
		expect(out).toEqual([{campaignLeadId: "lead-1", gmailMessageId: "m1", threadId: "t-1"}])
	})

	it("ignores our own sent messages (SENT label or self From)", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [
				{gmailMessageId: "s1", threadId: "t-1", from: "me@firma.pl", labelIds: ["SENT"]},
				{gmailMessageId: "s2", threadId: "t-2", from: "Me <me@firma.pl>", labelIds: ["INBOX"]},
			],
			trackedThreads: tracked,
		})
		expect(out).toEqual([])
	})

	it("ignores untracked threads", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [{gmailMessageId: "m9", threadId: "t-999", from: "x@y.pl", labelIds: ["INBOX"]}],
			trackedThreads: tracked,
		})
		expect(out).toEqual([])
	})

	it("dedups to the first reply per lead", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [
				{gmailMessageId: "m1", threadId: "t-1", from: "a@szkola.pl", labelIds: ["INBOX"]},
				{gmailMessageId: "m2", threadId: "t-1", from: "a@szkola.pl", labelIds: ["INBOX"]},
			],
			trackedThreads: tracked,
		})
		expect(out).toEqual([{campaignLeadId: "lead-1", gmailMessageId: "m1", threadId: "t-1"}])
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/replies/match.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// features/replies/match.ts
export interface AddedMessage {
	gmailMessageId: string
	threadId: string
	from: string
	labelIds: string[]
}

export interface MatchInput {
	mailboxEmail: string
	added: AddedMessage[]
	trackedThreads: Record<string, string> // threadId -> campaignLeadId
}

export interface ReplyMatch {
	campaignLeadId: string
	gmailMessageId: string
	threadId: string
}

// Pure: pick inbound messages on tracked threads, excluding our own sends, one per lead.
export function matchReplies(input: MatchInput): ReplyMatch[] {
	const mailbox = input.mailboxEmail.toLowerCase()
	const seen = new Set<string>()
	const out: ReplyMatch[] = []
	for (const m of input.added) {
		if (m.labelIds.includes("SENT")) continue
		if (m.from.toLowerCase().includes(mailbox)) continue
		const campaignLeadId = input.trackedThreads[m.threadId]
		if (!campaignLeadId || seen.has(campaignLeadId)) continue
		seen.add(campaignLeadId)
		out.push({campaignLeadId, gmailMessageId: m.gmailMessageId, threadId: m.threadId})
	}
	return out
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/replies/match.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add features/replies/match.ts features/replies/match.test.ts
git commit -m "feat: pure reply matching for tracked threads" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `features/replies/gmail-history.ts` — Gmail history boundary (mocked test)

**Files:** Create `features/replies/gmail-history.ts`, `features/replies/gmail-history.test.ts`

- [ ] **Step 1: Write the failing test** (mock `googleapis`)

```ts
// features/replies/gmail-history.test.ts
import {describe, it, expect, vi, beforeAll} from "vitest"

const getProfile = vi.fn(async () => ({data: {historyId: "1000"}}))
const historyList = vi.fn()
const messagesGet = vi.fn(async ({id}: {id: string}) => ({
	data: {labelIds: ["INBOX"], payload: {headers: [{name: "From", value: `s-${id}@szkola.pl`}, {name: "Subject", value: `Re ${id}`}]}},
}))
const setCredentials = vi.fn()
const on = vi.fn()

vi.mock("googleapis", () => {
	class OAuth2 {
		setCredentials = setCredentials
		on = on
	}
	return {
		google: {
			auth: {OAuth2},
			gmail: vi.fn(() => ({users: {getProfile, history: {list: historyList}, messages: {get: messagesGet}}})),
		},
	}
})

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
	process.env.GOOGLE_MAILBOX_CLIENT_ID = "id"
	process.env.GOOGLE_MAILBOX_CLIENT_SECRET = "secret"
	process.env.GOOGLE_MAILBOX_REDIRECT_URI = "http://localhost/cb"
})

const account = {email: "me@firma.pl", displayName: null, accessTokenEnc: "", refreshTokenEnc: "", tokenExpiresAt: null}

describe("getProfileHistoryId", () => {
	it("returns the profile historyId", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {getProfileHistoryId} = await import("@/features/replies/gmail-history")
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		expect(await getProfileHistoryId(acc as never)).toBe("1000")
	})
})

describe("listAddedSince", () => {
	it("paginates and maps added messages with metadata", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {listAddedSince} = await import("@/features/replies/gmail-history")
		historyList
			.mockResolvedValueOnce({data: {history: [{messagesAdded: [{message: {id: "m1", threadId: "t-1"}}]}], historyId: "1100", nextPageToken: "p2"}})
			.mockResolvedValueOnce({data: {history: [{messagesAdded: [{message: {id: "m2", threadId: "t-2"}}]}], historyId: "1200"}})
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		const res = await listAddedSince(acc as never, "1000")
		expect(res.expired).toBe(false)
		expect(res.newHistoryId).toBe("1200")
		expect(res.added).toEqual([
			{gmailMessageId: "m1", threadId: "t-1", from: "s-m1@szkola.pl", subject: "Re m1", labelIds: ["INBOX"]},
			{gmailMessageId: "m2", threadId: "t-2", from: "s-m2@szkola.pl", subject: "Re m2", labelIds: ["INBOX"]},
		])
	})

	it("reports expired on a 404 history error", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {listAddedSince} = await import("@/features/replies/gmail-history")
		historyList.mockRejectedValueOnce(Object.assign(new Error("Not Found"), {code: 404}))
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		const res = await listAddedSince(acc as never, "5")
		expect(res.expired).toBe(true)
		expect(res.added).toEqual([])
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/replies/gmail-history.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// features/replies/gmail-history.ts
import {google} from "googleapis"
import {oauthClientFor, type SendableAccount} from "@/features/sending/gmail"
import type {AddedMessage} from "@/features/replies/match"

export type FetchedMessage = AddedMessage & {subject: string}

export interface HistoryResult {
	added: FetchedMessage[]
	newHistoryId: string | null
	expired: boolean
}

function gmailFor(account: SendableAccount) {
	return google.gmail({version: "v1", auth: oauthClientFor(account)})
}

export async function getProfileHistoryId(account: SendableAccount): Promise<string | null> {
	const res = await gmailFor(account).users.getProfile({userId: "me"})
	return res.data.historyId ?? null
}

// Read the messageAdded delta since startHistoryId. expired=true when Gmail rejects a stale cursor (404).
export async function listAddedSince(account: SendableAccount, startHistoryId: string): Promise<HistoryResult> {
	const gmail = gmailFor(account)
	const added: FetchedMessage[] = []
	let newHistoryId: string | null = null
	let pageToken: string | undefined = undefined
	try {
		do {
			const res = await gmail.users.history.list({userId: "me", startHistoryId, historyTypes: ["messageAdded"], pageToken})
			newHistoryId = res.data.historyId ?? newHistoryId
			for (const h of res.data.history ?? []) {
				for (const m of h.messagesAdded ?? []) {
					const id = m.message?.id
					const threadId = m.message?.threadId
					if (!id || !threadId) continue
					const meta = await gmail.users.messages.get({userId: "me", id, format: "metadata", metadataHeaders: ["From", "Subject"]})
					const headers = meta.data.payload?.headers ?? []
					const from = headers.find((x) => x.name === "From")?.value ?? ""
					const subject = headers.find((x) => x.name === "Subject")?.value ?? ""
					added.push({gmailMessageId: id, threadId, from, subject, labelIds: meta.data.labelIds ?? []})
				}
			}
			pageToken = res.data.nextPageToken ?? undefined
		} while (pageToken)
		return {added, newHistoryId, expired: false}
	} catch (err: unknown) {
		if ((err as {code?: number}).code === 404) return {added, newHistoryId: null, expired: true}
		throw err
	}
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/replies/gmail-history.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add features/replies/gmail-history.ts features/replies/gmail-history.test.ts
git commit -m "feat: Gmail history delta boundary for reply polling" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `features/replies/queries.ts` — tracked threads + record reply

**Files:** Create `features/replies/queries.ts`

- [ ] **Step 1: Implement**

```ts
// features/replies/queries.ts
import {prisma} from "@/lib/prisma"

// threadId -> campaignLeadId for this mailbox's outbound messages whose lead has not replied/unsubscribed.
export async function getTrackedThreads(emailAccountId: string): Promise<Record<string, string>> {
	const rows = await prisma.message.findMany({
		where: {
			emailAccountId,
			direction: "OUTBOUND",
			gmailThreadId: {not: null},
			campaignLead: {status: {notIn: ["REPLIED", "UNSUBSCRIBED"]}},
		},
		select: {gmailThreadId: true, campaignLeadId: true},
	})
	const map: Record<string, string> = {}
	for (const r of rows) {
		if (r.gmailThreadId) map[r.gmailThreadId] = r.campaignLeadId
	}
	return map
}

export interface RecordReplyInput {
	organizationId: string
	campaignLeadId: string
	emailAccountId: string
	mailboxEmail: string
	gmailMessageId: string
	gmailThreadId: string
	from: string
	subject: string
}

// Log the inbound reply and flip the lead to REPLIED, atomically.
export async function recordReply(input: RecordReplyInput): Promise<void> {
	await prisma.$transaction([
		prisma.message.create({
			data: {
				organizationId: input.organizationId,
				campaignLeadId: input.campaignLeadId,
				emailAccountId: input.emailAccountId,
				direction: "INBOUND",
				subject: input.subject,
				body: input.from,
				intendedTo: input.mailboxEmail,
				actualTo: input.mailboxEmail,
				gmailMessageId: input.gmailMessageId,
				gmailThreadId: input.gmailThreadId,
			},
		}),
		prisma.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "REPLIED", repliedAt: new Date()}}),
	])
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: 0 errors)
```bash
git add features/replies/queries.ts
git commit -m "feat: tracked-thread query and reply recording" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/inngest/replies.ts` — cron scanner + per-mailbox poller + registration

**Files:** Create `lib/inngest/replies.ts`; Modify `app/api/inngest/route.ts`

- [ ] **Step 1: Implement the two functions**

```ts
// lib/inngest/replies.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {getProfileHistoryId, listAddedSince} from "@/features/replies/gmail-history"
import {getTrackedThreads, recordReply} from "@/features/replies/queries"
import {matchReplies} from "@/features/replies/match"

// Every 5 minutes: fan out one poll per connected mailbox that granted the read scope.
export const scanMailboxesForReplies = inngest.createFunction(
	{id: "scan-mailboxes-for-replies", triggers: {cron: "*/5 * * * *"}},
	async ({step}) => {
		const mailboxes = await step.run("list-mailboxes", () =>
			prisma.emailAccount.findMany({
				where: {status: "CONNECTED", scope: {contains: "gmail.readonly"}},
				select: {id: true},
			}),
		)
		if (mailboxes.length === 0) return {scanned: 0}
		await inngest.send(mailboxes.map((m) => ({name: "campaign/mailbox.poll", data: {emailAccountId: m.id}})))
		return {scanned: mailboxes.length}
	},
)

export const pollMailboxReplies = inngest.createFunction(
	{
		id: "poll-mailbox-replies",
		triggers: {event: "campaign/mailbox.poll"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
	},
	async ({event, step}) => {
		const {emailAccountId} = event.data as {emailAccountId: string}
		const account = await prisma.emailAccount.findUnique({where: {id: emailAccountId}})
		if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

		// First run for this mailbox: set the baseline cursor and stop (nothing to diff yet).
		if (!account.lastHistoryId) {
			const hid = await step.run("baseline", () => getProfileHistoryId(account))
			if (hid) await prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: hid}})
			return {baseline: hid}
		}

		const result = await step.run("list-history", () => listAddedSince(account, account.lastHistoryId!))
		if (result.expired) {
			const hid = await step.run("rebaseline", () => getProfileHistoryId(account))
			await prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: hid}})
			return {rebaselined: hid}
		}

		const trackedThreads = await getTrackedThreads(account.id)
		const matches = matchReplies({mailboxEmail: account.email, added: result.added, trackedThreads})

		for (const match of matches) {
			const msg = result.added.find((a) => a.gmailMessageId === match.gmailMessageId)
			await step.run(`record-${match.campaignLeadId}`, () =>
				recordReply({
					organizationId: account.organizationId,
					campaignLeadId: match.campaignLeadId,
					emailAccountId: account.id,
					mailboxEmail: account.email,
					gmailMessageId: match.gmailMessageId,
					gmailThreadId: match.threadId,
					from: msg?.from ?? "",
					subject: msg?.subject ?? "",
				}),
			)
			await inngest.send({name: "campaign/lead.replied", data: {campaignLeadId: match.campaignLeadId}})
		}

		if (result.newHistoryId) {
			await prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: result.newHistoryId}})
		}
		return {replies: matches.length}
	},
)
```

- [ ] **Step 2: Register both functions** in `app/api/inngest/route.ts`

```ts
// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"
import {sendCampaignEmail} from "@/lib/inngest/sending"
import {scanMailboxesForReplies, pollMailboxReplies} from "@/lib/inngest/replies"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, sendCampaignEmail, scanMailboxesForReplies, pollMailboxReplies]})
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors. (`account.lastHistoryId!` is safe after the null-guard; `event.data` cast matches the Phase 4 pattern.)

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/replies.ts app/api/inngest/route.ts
git commit -m "feat: Inngest reply-detection cron and per-mailbox poller" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `/skrzynki` reply-detection hint

**Files:** Modify `app/(app)/skrzynki/page.tsx`

- [ ] **Step 1: Select `scope` and show a per-mailbox hint**

In `features/email-accounts/queries.ts` `listEmailAccounts`, add `scope: true` to the `select`. Then in `app/(app)/skrzynki/page.tsx`, inside the mailbox `<li>` status span, append a reply-detection indicator:
```tsx
							{a.email} <span className="text-zinc-400">· {a.status} · limit {a.dailyLimit}/dzień · {a.scope?.includes("gmail.readonly") ? "odpowiedzi: on" : "odpowiedzi: off (przepnij skrzynkę)"}</span>
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: 0 errors)
```bash
git add "app/(app)/skrzynki" features/email-accounts/queries.ts
git commit -m "feat: show reply-detection status per mailbox" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification + manual e2e

- [ ] **Step 1: Static gates** (dev server OFF for build)

```bash
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: tsc 0; all vitest suites green (incl. `match` + `gmail-history`); production build succeeds with `/api/inngest` listing all four functions.

- [ ] **Step 2: Re-consent the mailbox** (USER)
  - `npm run dev` + Inngest dev server; open `/skrzynki`; the connected mailbox shows "odpowiedzi: off".
  - Click "Połącz skrzynkę Google" again; approve the added read permission. The mailbox now shows "odpowiedzi: on" and `scope` contains `gmail.readonly`.

- [ ] **Step 3: Reply detection e2e**
  - Ensure a `CampaignLead` has an outbound `Message` (run the Phase 4 send if needed). From the inbox that received it (the `SEND_OVERRIDE_TO` address), reply to that thread.
  - Within ~5 min (or trigger `scan-mailboxes-for-replies` from the Inngest dev panel): `campaign/mailbox.poll` runs, then a reply is detected.
  - Expect: `CampaignLead.status = REPLIED` with `repliedAt`; a `Message(direction=INBOUND)` row for the reply; `campaign/lead.replied` event in the panel; `EmailAccount.lastHistoryId` advanced.

- [ ] **Step 4: Update knowledge graph + roadmap**
  - `graphify update .` (AST, free) after code; then once `graphify . --obsidian` for the doc changes (API cost).
  - Mark Phase 5a DONE in `docs/superpowers/ROADMAP.md` (and note 5b followups is next).
```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs: mark phase 5a done; refresh knowledge graph" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:** schema cursor + repliedAt (Task 0) ✓; gmail.readonly consent + re-connect (Task 1, Task 7 step 2) ✓; polling via History API delta with baseline/expired handling (Tasks 3, 5) ✓; pure matching with own-message filtering + dedup (Task 2) ✓; mark REPLIED + inbound Message + emit `campaign/lead.replied` (Tasks 4, 5) ✓; event-per-mailbox cron+worker with per-mailbox concurrency (Task 5) ✓; `/skrzynki` on/off hint (Task 6) ✓; tests + manual e2e (Tasks 2, 3, 7) ✓; out-of-scope items (followups, bounce/auto-reply, unsub, push) absent ✓.

**Placeholder scan:** every code step carries full code + exact commands; no TBD/"add error handling" gaps; the expired-history and own-message rules are concrete.

**Type consistency:** `AddedMessage` defined in `match.ts` and reused by `gmail-history.ts` (`FetchedMessage = AddedMessage & {subject}`); `ReplyMatch` shape consistent (Tasks 2, 5); `RecordReplyInput` matches the worker call (Tasks 4, 5); event names `campaign/mailbox.poll` and `campaign/lead.replied` consistent (Task 5); `getTrackedThreads` returns `Record<threadId, campaignLeadId>` consumed by `matchReplies` (Tasks 4, 2, 5); `listEmailAccounts` gains `scope` used by the UI (Task 6).

Known risk: Gmail `history.list` pagination/expired-cursor behavior and the cron→fan-out wiring are the highest-risk; locked by the mocked `gmail-history` test (Task 3) and manual e2e (Task 7).
