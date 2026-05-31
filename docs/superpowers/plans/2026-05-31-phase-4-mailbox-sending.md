# Phase 4: Mailbox + Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect a real Google mailbox over OAuth and send the first sequence step of an ACTIVE campaign to every enrolled lead, paced like a human (daily limit, send window, randomized gaps), suppression-checked, each email logged.

**Architecture:** Event-per-lead Inngest engine ("each email is its own durable job"). Activation precomputes a `nextSendAt` per lead and emits one `campaign/lead.send` event each; a single Inngest function sleeps until that time, re-checks window/limit/suppression, sends via Gmail API, logs a `Message`. Pure logic (crypto, MIME, recipient guard, pacing, OAuth state) lives in `features/sending/*` + `features/email-accounts/*` and is unit-tested; Gmail/OAuth/Inngest are thin impure boundaries.

**Tech Stack:** Next 16.2.6 route handlers, Prisma 7.8 (Neon), Inngest 4.5.0, googleapis 173.x (bundles google-auth-library 10.x → `google.auth.OAuth2`), Node `crypto` AES-256-GCM, Zod 4, Vitest 4.

---

## Verified facts (checked against installed packages / official docs on 2026-05-31)

- **Inngest 4.5.0**: function config takes `triggers: {event: "..."}`, `concurrency?: number | {limit: number; key?: string; scope?: "env"|"fn"|"account"}` (confirmed in `node_modules/inngest/types.d.ts:1549`), `throttle?: {key?; limit; period}` where **`limit` is static config-time** (so it cannot express a per-mailbox configurable daily limit — we count `Message` rows at runtime instead). Steps: `step.sleepUntil(id, Date)`, `step.run(id, fn)`, `step.sendEvent(id, payload)` / `inngest.send({name, data})`. Client already at `lib/inngest/client.ts`, serve at `app/api/inngest/route.ts`.
- **Next 16.2.6**: route handlers are `export async function GET(request: Request)`, not cached by default; redirect with `NextResponse.redirect(new URL("/path", request.url))`; read query via `new URL(request.url).searchParams`. (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.)
- **googleapis 173.0.0** (bundles google-auth-library 10.6.2): `new google.auth.OAuth2(id, secret, redirectUri)`, `.generateAuthUrl({access_type:"offline", prompt:"consent", scope:["https://www.googleapis.com/auth/gmail.send"]})`, `.getToken(code)` → `{tokens}`, `.setCredentials(tokens)`, auto-refresh + `.on("tokens", cb)` to persist; `google.gmail({version:"v1", auth}).users.messages.send({userId:"me", requestBody:{raw}})` where `raw` is base64url RFC 2822. **Caveat**: an OAuth consent screen in "Testing" mode expires refresh tokens after 7 days — for sustained use publish the app (Internal if Workspace) or re-consent.
- **Repo conventions** (enforced): tabs, no semicolons, file-path comment on line 1 (or line 2 after a `"use server"`/`"use client"` directive), `className` first, `import {x}` no inner spaces, **no emoji**. Actions return `{ok: true; ...} | {ok: false; error: string}`; `requireOrg()` → `{userId, orgId, role}`; `prisma` from `@/lib/prisma`; generated client `@/generated/prisma/client`; Polish UI strings + route slugs (`/kampanie`, `/suppression`, new `/skrzynki`).
- Every commit ends with the trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (repo convention; no emoji). The USER pushes — never `git push`.

---

## File structure

```
prisma/schema.prisma                              # MODIFY: enums + EmailAccount + Message + edits
.env.example                                      # MODIFY: new env keys
lib/crypto.ts                                     # NEW: AES-256-GCM encrypt/decrypt   (+ crypto.test.ts)
features/sending/recipient.ts                     # NEW: resolveRecipient guard        (+ recipient.test.ts)
features/sending/mime.ts                          # NEW: buildRawMessage (base64url)   (+ mime.test.ts)
features/sending/schedule.ts                      # NEW: pure pacing + window helpers  (+ schedule.test.ts)
features/sending/gmail.ts                         # NEW: Gmail send boundary           (+ gmail.test.ts)
features/email-accounts/google-oauth.ts           # NEW: consent URL, code exchange, state sign  (+ google-oauth.test.ts)
features/email-accounts/queries.ts                # NEW: listEmailAccounts
features/email-accounts/actions.ts                # NEW: disconnectEmailAccount
features/campaigns/sending-actions.ts             # NEW: activateCampaign / pause / resume + validateActivation (+ sending-actions.test.ts)
app/api/mailbox/google/connect/route.ts           # NEW: OAuth start
app/api/mailbox/google/callback/route.ts          # NEW: OAuth callback -> EmailAccount
app/(app)/skrzynki/page.tsx                        # NEW: mailbox list + connect (raw UI)
app/(app)/kampanie/[id]/page.tsx                   # MODIFY: mailbox select + activate/pause buttons
lib/inngest/sending.ts                            # NEW: sendCampaignEmail function
app/api/inngest/route.ts                          # MODIFY: register sendCampaignEmail
```

Note: confirm the exact campaign-detail page path before editing (`revalidatePath("/kampanie/${id}")` in `features/campaigns/actions.ts` implies `app/(app)/kampanie/[id]/page.tsx`). If the route group differs, adjust paths but keep the slugs.

---

## Task 0: Dependencies + env scaffolding

**Files:**
- Modify: `package.json` (via npm)
- Modify: `.env.example`

- [ ] **Step 1: Install googleapis**

Run (dev server must be OFF to avoid file locks):
```bash
npm install googleapis@^173
```
Expected: `googleapis` added to `dependencies`; `npm ls googleapis` shows `173.x`.

- [ ] **Step 2: Add env keys to `.env.example`**

Append:
```
# Mailbox OAuth (Gmail send). Create a GCP OAuth client (Web), enable Gmail API, add yourself as a test user.
GOOGLE_MAILBOX_CLIENT_ID=
GOOGLE_MAILBOX_CLIENT_SECRET=
GOOGLE_MAILBOX_REDIRECT_URI=http://localhost:3000/api/mailbox/google/callback
# 32 random bytes, base64. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
TOKEN_ENCRYPTION_KEY=
# Dev safety guard: every outbound is rerouted to this address regardless of the lead's email. Leave set until launch.
SEND_OVERRIDE_TO=
```

- [ ] **Step 3: Set the local `.env`** (not committed)

Add the same keys to `.env` with a real `TOKEN_ENCRYPTION_KEY` (run the node one-liner above) and `SEND_OVERRIDE_TO=<your test inbox>`. GCP client id/secret are filled when you create the OAuth client (Task 7 verification).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add googleapis dep and phase-4 env scaffolding"
```

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums** (after the existing enums)
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

- [ ] **Step 2: Extend `CampaignLeadStatus`** — add `SKIPPED` and `FAILED`:
```prisma
enum CampaignLeadStatus {
	PENDING
	ACTIVE
	REPLIED
	BOUNCED
	UNSUBSCRIBED
	SKIPPED
	FAILED
	DONE
}
```

- [ ] **Step 3: Add `EmailAccount` and `Message` models**
```prisma
model EmailAccount {
	id                 String             @id @default(cuid())
	organizationId     String
	provider           EmailProvider      @default(GOOGLE)
	email              String
	displayName        String?
	accessTokenEnc     String
	refreshTokenEnc    String
	tokenExpiresAt     DateTime?
	scope              String?
	dailyLimit         Int                @default(40)
	sendWindowStartMin Int                @default(480)
	sendWindowEndMin   Int                @default(960)
	sendDays           Int                @default(31)
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

model Message {
	id             String           @id @default(cuid())
	organizationId String
	campaignLeadId String
	emailAccountId String
	direction      MessageDirection @default(OUTBOUND)
	subject        String
	body           String
	intendedTo     String
	actualTo       String
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

- [ ] **Step 4: Edit existing models**

`Organization` — add back-relations:
```prisma
	emailAccounts EmailAccount[]
	messages      Message[]
```
`Campaign` — add field + relation:
```prisma
	sendingEmailAccountId String?
	sendingEmailAccount   EmailAccount? @relation(fields: [sendingEmailAccountId], references: [id], onDelete: SetNull)
```
`CampaignLead` — add:
```prisma
	lastError String?
	messages  Message[]
```

- [ ] **Step 5: Migrate + generate**

Run (dev OFF):
```bash
npx prisma migrate dev --name phase4_mailbox_sending
npx prisma generate
```
Expected: migration created under `prisma/migrations/`, applied to Neon, client regenerated, no errors.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes (new models available on `@/generated/prisma/client`).

- [ ] **Step 7: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schema for email accounts, messages and campaign sending fields"
```

---

## Task 2: `lib/crypto.ts` — token encryption (TDD)

**Files:**
- Create: `lib/crypto.ts`
- Test: `lib/crypto.test.ts`

- [ ] **Step 1: Write failing test**
```ts
// lib/crypto.test.ts
import {describe, it, expect, beforeAll} from "vitest"
import {encryptSecret, decryptSecret} from "@/lib/crypto"

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
})

describe("crypto", () => {
	it("round-trips a secret", () => {
		const enc = encryptSecret("ya29.some-token")
		expect(enc).not.toContain("ya29")
		expect(decryptSecret(enc)).toBe("ya29.some-token")
	})

	it("produces different ciphertext each call (random iv)", () => {
		expect(encryptSecret("x")).not.toBe(encryptSecret("x"))
	})

	it("throws on tampered ciphertext", () => {
		const enc = encryptSecret("secret")
		const parts = enc.split(":")
		parts[2] = Buffer.from("tampered").toString("base64")
		expect(() => decryptSecret(parts.join(":"))).toThrow()
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run lib/crypto.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// lib/crypto.ts
import {randomBytes, createCipheriv, createDecipheriv} from "node:crypto"

function key(): Buffer {
	const raw = process.env.TOKEN_ENCRYPTION_KEY
	if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set")
	const buf = Buffer.from(raw, "base64")
	if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)")
	return buf
}

// Format: ivBase64:authTagBase64:ciphertextBase64
export function encryptSecret(plain: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv("aes-256-gcm", key(), iv)
	const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
	const tag = cipher.getAuthTag()
	return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":")
}

export function decryptSecret(enc: string): string {
	const [ivB64, tagB64, ctB64] = enc.split(":")
	if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed ciphertext")
	const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"))
	decipher.setAuthTag(Buffer.from(tagB64, "base64"))
	return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8")
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run lib/crypto.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git add lib/crypto.ts lib/crypto.test.ts
git commit -m "feat: AES-256-GCM secret encryption for stored OAuth tokens"
```

---

## Task 3: `features/sending/recipient.ts` — override guard (TDD)

**Files:**
- Create: `features/sending/recipient.ts`
- Test: `features/sending/recipient.test.ts`

- [ ] **Step 1: Write failing test**
```ts
// features/sending/recipient.test.ts
import {describe, it, expect} from "vitest"
import {resolveRecipient} from "@/features/sending/recipient"

describe("resolveRecipient", () => {
	it("uses the override when set", () => {
		expect(resolveRecipient("lead@school.pl", "me@test.pl")).toEqual({to: "me@test.pl", overridden: true})
	})
	it("uses the lead email when override is empty/undefined", () => {
		expect(resolveRecipient("lead@school.pl", "")).toEqual({to: "lead@school.pl", overridden: false})
		expect(resolveRecipient("lead@school.pl", null)).toEqual({to: "lead@school.pl", overridden: false})
		expect(resolveRecipient("lead@school.pl", undefined)).toEqual({to: "lead@school.pl", overridden: false})
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/sending/recipient.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// features/sending/recipient.ts
export interface ResolvedRecipient {
	to: string
	overridden: boolean
}

// When SEND_OVERRIDE_TO is set, every email is rerouted to it (dev safety guard).
export function resolveRecipient(leadEmail: string, overrideTo: string | null | undefined): ResolvedRecipient {
	const override = (overrideTo ?? "").trim()
	if (override) return {to: override, overridden: true}
	return {to: leadEmail, overridden: false}
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/sending/recipient.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**
```bash
git add features/sending/recipient.ts features/sending/recipient.test.ts
git commit -m "feat: recipient override guard for safe send testing"
```

---

## Task 4: `features/sending/mime.ts` — base64url RFC 2822 builder (TDD)

Builds a UTF-8-safe message: Subject encoded as RFC 2047 when non-ASCII (Polish diacritics), body sent as base64 UTF-8. Output is base64url (Gmail `raw`).

**Files:**
- Create: `features/sending/mime.ts`
- Test: `features/sending/mime.test.ts`

- [ ] **Step 1: Write failing test**
```ts
// features/sending/mime.test.ts
import {describe, it, expect} from "vitest"
import {buildRawMessage} from "@/features/sending/mime"

function fromBase64Url(s: string): string {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
	return Buffer.from(b64, "base64").toString("utf8")
}

describe("buildRawMessage", () => {
	it("is base64url (no +, /, =)", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Hi", text: "Hello"})
		expect(raw).not.toMatch(/[+/=]/)
	})

	it("includes the headers and the decoded body round-trips", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Oferta", text: "Dzień dobry, Pani Anno"})
		const msg = fromBase64Url(raw)
		expect(msg).toContain("From: a@b.pl")
		expect(msg).toContain("To: c@d.pl")
		expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"')
		// body is base64-encoded UTF-8 -> find it after the blank line and decode
		const body = msg.split("\r\n\r\n")[1].trim()
		expect(Buffer.from(body, "base64").toString("utf8")).toBe("Dzień dobry, Pani Anno")
	})

	it("RFC 2047-encodes a non-ASCII subject", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Zapytanie ąęó", text: "x"})
		const msg = fromBase64Url(raw)
		expect(msg).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/)
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/sending/mime.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// features/sending/mime.ts
export interface MailInput {
	from: string
	to: string
	subject: string
	text: string
}

function toBase64Url(buf: Buffer): string {
	return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const NON_ASCII = /[^\x00-\x7F]/

function encodeHeaderWord(value: string): string {
	if (!NON_ASCII.test(value)) return value
	return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

// Wrap base64 body at 76 chars per line (RFC 2045).
function chunk76(s: string): string {
	return s.replace(/(.{76})/g, "$1\r\n")
}

export function buildRawMessage(input: MailInput): string {
	const bodyB64 = chunk76(Buffer.from(input.text, "utf8").toString("base64"))
	const headers = [
		`From: ${input.from}`,
		`To: ${input.to}`,
		`Subject: ${encodeHeaderWord(input.subject)}`,
		"MIME-Version: 1.0",
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
	].join("\r\n")
	const message = `${headers}\r\n\r\n${bodyB64}`
	return toBase64Url(Buffer.from(message, "utf8"))
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/sending/mime.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git add features/sending/mime.ts features/sending/mime.test.ts
git commit -m "feat: UTF-8 base64url MIME builder for Gmail send"
```

---

## Task 5: `features/sending/schedule.ts` — pure pacing + window helpers (TDD)

Timezone math via `Intl.DateTimeFormat` (no date library needed). `sendDays` is a bitmask, bit0=Mon..bit6=Sun (31 = Mon-Fri). DST caveat: minute-shifting within a day ignores the rare 02:00-03:00 transition, which is outside the 08:00-16:00 window — acceptable for v1.

**Files:**
- Create: `features/sending/schedule.ts`
- Test: `features/sending/schedule.test.ts`

- [ ] **Step 1: Write failing test**

(Test instants are summer 2026, Europe/Warsaw = UTC+2. `2026-06-01T06:00:00Z` = Mon 08:00 local.)
```ts
// features/sending/schedule.test.ts
import {describe, it, expect} from "vitest"
import {localParts, isWithinWindow, nextWindowOpen, planSchedule} from "@/features/sending/schedule"

const TZ = "Europe/Warsaw"
const acct = {timezone: TZ, sendWindowStartMin: 480, sendWindowEndMin: 960, sendDays: 31, dailyLimit: 3, minGapSec: 300, maxGapSec: 300}

describe("localParts", () => {
	it("reads local weekday and minutes (UTC+2 summer)", () => {
		const p = localParts(new Date("2026-06-01T06:00:00Z"), TZ) // Mon 08:00 local
		expect(p).toEqual({weekdayIso: 1, minutes: 480})
	})
})

describe("isWithinWindow", () => {
	it("true inside Mon-Fri 08-16", () => {
		expect(isWithinWindow(new Date("2026-06-01T07:00:00Z"), TZ, 480, 960, 31)).toBe(true) // Mon 09:00
	})
	it("false before open", () => {
		expect(isWithinWindow(new Date("2026-06-01T05:00:00Z"), TZ, 480, 960, 31)).toBe(false) // Mon 07:00
	})
	it("false on Saturday", () => {
		expect(isWithinWindow(new Date("2026-06-06T09:00:00Z"), TZ, 480, 960, 31)).toBe(false) // Sat
	})
})

describe("nextWindowOpen", () => {
	it("returns now when already open", () => {
		const now = new Date("2026-06-01T07:00:00Z") // Mon 09:00 local
		expect(nextWindowOpen(now, TZ, 480, 960, 31).toISOString()).toBe(now.toISOString())
	})
	it("jumps to today's open when before open", () => {
		const now = new Date("2026-06-01T04:00:00Z") // Mon 06:00 local
		expect(nextWindowOpen(now, TZ, 480, 960, 31).toISOString()).toBe("2026-06-01T06:00:00.000Z") // Mon 08:00 local
	})
	it("skips the weekend", () => {
		const now = new Date("2026-06-06T09:00:00Z") // Sat
		const open = nextWindowOpen(now, TZ, 480, 960, 31)
		expect(localParts(open, TZ)).toEqual({weekdayIso: 1, minutes: 480}) // Mon 08:00
	})
})

describe("planSchedule", () => {
	const rng = () => 0 // gap = minGapSec exactly (300s)

	it("spaces sends by the gap within the window", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const plan = planSchedule({leadIds: ["a", "b"], now, account: acct, sentTodayCount: 0, rng})
		expect(plan[0].nextSendAt.toISOString()).toBe("2026-06-01T06:00:00.000Z")
		expect(plan[1].nextSendAt.toISOString()).toBe("2026-06-01T06:05:00.000Z") // +300s
	})

	it("rolls to the next day when the daily limit is hit", () => {
		const now = new Date("2026-06-01T06:00:00Z")
		const plan = planSchedule({leadIds: ["a", "b", "c", "d"], now, account: acct, sentTodayCount: 0, rng})
		// dailyLimit 3 -> 4th lead is next day at 08:00 local
		expect(localParts(plan[3].nextSendAt, TZ)).toEqual({weekdayIso: 2, minutes: 480})
	})

	it("accounts for sends already made today", () => {
		const now = new Date("2026-06-01T06:00:00Z")
		const plan = planSchedule({leadIds: ["a", "b"], now, account: acct, sentTodayCount: 2, rng})
		// only 1 slot left today (limit 3 - 2) -> 2nd lead rolls to next day
		expect(localParts(plan[1].nextSendAt, TZ)).toEqual({weekdayIso: 2, minutes: 480})
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/sending/schedule.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// features/sending/schedule.ts
export interface LocalParts {
	weekdayIso: number // 1=Mon..7=Sun
	minutes: number // minutes into the local day
}

export interface PacingAccount {
	timezone: string
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number // bitmask bit0=Mon..bit6=Sun
	dailyLimit: number
	minGapSec: number
	maxGapSec: number
}

const WD: Record<string, number> = {Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7}

export function localParts(date: Date, timeZone: string): LocalParts {
	const fmt = new Intl.DateTimeFormat("en-US", {timeZone, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit"})
	const parts = fmt.formatToParts(date)
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
	let hour = parseInt(get("hour"), 10)
	if (hour === 24) hour = 0 // some ICU builds emit 24 at midnight under hour12:false
	return {weekdayIso: WD[get("weekday")] ?? 1, minutes: hour * 60 + parseInt(get("minute"), 10)}
}

function isSendDay(weekdayIso: number, mask: number): boolean {
	return ((mask >> (weekdayIso - 1)) & 1) === 1
}

export function isWithinWindow(date: Date, tz: string, startMin: number, endMin: number, mask: number): boolean {
	const p = localParts(date, tz)
	return isSendDay(p.weekdayIso, mask) && p.minutes >= startMin && p.minutes < endMin
}

function shiftMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000)
}

// Next instant at/after `from` where the window is open. Approximate (minute-shift), DST-naive.
export function nextWindowOpen(from: Date, tz: string, startMin: number, endMin: number, mask: number): Date {
	let cursor = from
	for (let i = 0; i < 14; i++) {
		const p = localParts(cursor, tz)
		if (isSendDay(p.weekdayIso, mask) && p.minutes < endMin) {
			if (p.minutes < startMin) return shiftMinutes(cursor, startMin - p.minutes)
			return cursor // already within the window
		}
		// move to the next local day's open time
		cursor = shiftMinutes(cursor, 1440 - p.minutes + startMin)
	}
	return cursor
}

function localDayKey(date: Date, tz: string): string {
	return new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).format(date)
}

export interface PlanInput {
	leadIds: string[]
	now: Date
	account: PacingAccount
	sentTodayCount: number
	rng: () => number // [0,1)
}

export interface PlannedSend {
	leadId: string
	nextSendAt: Date
}

export function planSchedule(input: PlanInput): PlannedSend[] {
	const {leadIds, now, account, sentTodayCount, rng} = input
	const {timezone: tz, sendWindowStartMin: start, sendWindowEndMin: end, sendDays: mask, dailyLimit, minGapSec, maxGapSec} = account
	const out: PlannedSend[] = []

	let cursor = nextWindowOpen(now, tz, start, end, mask)
	const firstDayIsToday = localDayKey(cursor, tz) === localDayKey(now, tz)
	let remaining = dailyLimit - (firstDayIsToday ? sentTodayCount : 0)
	if (remaining < 0) remaining = 0

	for (const leadId of leadIds) {
		if (remaining <= 0 || !isWithinWindow(cursor, tz, start, end, mask)) {
			cursor = nextWindowOpen(shiftMinutes(cursor, 1), tz, start, end, mask)
			remaining = dailyLimit
		}
		out.push({leadId, nextSendAt: new Date(cursor.getTime())})
		remaining -= 1
		const gapSec = minGapSec + Math.floor(rng() * (maxGapSec - minGapSec + 1))
		cursor = new Date(cursor.getTime() + gapSec * 1000)
	}
	return out
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/sending/schedule.test.ts`
Expected: all passed. If a window/limit edge test fails, fix the implementation (not the test) — these encode the intended behavior.

- [ ] **Step 5: Commit**
```bash
git add features/sending/schedule.ts features/sending/schedule.test.ts
git commit -m "feat: pure send pacing (window, daily limit, randomized gaps)"
```

---

## Task 6: `features/sending/gmail.ts` — Gmail send boundary (mocked test)

**Files:**
- Create: `features/sending/gmail.ts`
- Test: `features/sending/gmail.test.ts`

- [ ] **Step 1: Write failing test** (mock `googleapis`; assert wiring)
```ts
// features/sending/gmail.test.ts
import {describe, it, expect, vi, beforeAll} from "vitest"

const sendMock = vi.fn(async () => ({data: {id: "gmail-1", threadId: "thread-1"}}))
const setCredentials = vi.fn()
const on = vi.fn()

vi.mock("googleapis", () => ({
	google: {
		auth: {OAuth2: vi.fn(() => ({setCredentials, on}))},
		gmail: vi.fn(() => ({users: {messages: {send: sendMock}}})),
	},
}))

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
	process.env.GOOGLE_MAILBOX_CLIENT_ID = "id"
	process.env.GOOGLE_MAILBOX_CLIENT_SECRET = "secret"
	process.env.GOOGLE_MAILBOX_REDIRECT_URI = "http://localhost/cb"
})

describe("sendEmail", () => {
	it("sends base64url raw to userId 'me' and maps ids", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {sendEmail} = await import("@/features/sending/gmail")
		const account = {
			email: "mailbox@me.pl",
			displayName: "Salon",
			accessTokenEnc: encryptSecret("access"),
			refreshTokenEnc: encryptSecret("refresh"),
			tokenExpiresAt: null,
		}
		const res = await sendEmail(account as never, {to: "c@d.pl", subject: "Hi", text: "Hello"})
		expect(res).toEqual({gmailMessageId: "gmail-1", gmailThreadId: "thread-1"})
		const arg = sendMock.mock.calls[0][0]
		expect(arg.userId).toBe("me")
		expect(arg.requestBody.raw).not.toMatch(/[+/=]/)
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/sending/gmail.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
// features/sending/gmail.ts
import {google} from "googleapis"
import {prisma} from "@/lib/prisma"
import {encryptSecret, decryptSecret} from "@/lib/crypto"
import {buildRawMessage} from "@/features/sending/mime"

export interface SendableAccount {
	id?: string
	email: string
	displayName: string | null
	accessTokenEnc: string
	refreshTokenEnc: string
	tokenExpiresAt: Date | null
}

export interface SendInput {
	to: string
	subject: string
	text: string
}

export function oauthClientFor(account: SendableAccount) {
	const client = new google.auth.OAuth2(
		process.env.GOOGLE_MAILBOX_CLIENT_ID,
		process.env.GOOGLE_MAILBOX_CLIENT_SECRET,
		process.env.GOOGLE_MAILBOX_REDIRECT_URI,
	)
	client.setCredentials({
		access_token: decryptSecret(account.accessTokenEnc),
		refresh_token: decryptSecret(account.refreshTokenEnc),
		expiry_date: account.tokenExpiresAt ? account.tokenExpiresAt.getTime() : undefined,
	})
	// Persist refreshed tokens (refresh_token only returned on first consent).
	client.on("tokens", (tokens) => {
		if (!account.id) return
		const data: Record<string, unknown> = {}
		if (tokens.access_token) data.accessTokenEnc = encryptSecret(tokens.access_token)
		if (tokens.refresh_token) data.refreshTokenEnc = encryptSecret(tokens.refresh_token)
		if (tokens.expiry_date) data.tokenExpiresAt = new Date(tokens.expiry_date)
		if (Object.keys(data).length > 0) {
			void prisma.emailAccount.update({where: {id: account.id}, data}).catch(() => {})
		}
	})
	return client
}

export async function sendEmail(account: SendableAccount, input: SendInput): Promise<{gmailMessageId: string; gmailThreadId: string}> {
	const auth = oauthClientFor(account)
	const gmail = google.gmail({version: "v1", auth})
	const raw = buildRawMessage({
		from: account.displayName ? `${account.displayName} <${account.email}>` : account.email,
		to: input.to,
		subject: input.subject,
		text: input.text,
	})
	const res = await gmail.users.messages.send({userId: "me", requestBody: {raw}})
	return {gmailMessageId: res.data.id ?? "", gmailThreadId: res.data.threadId ?? ""}
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/sending/gmail.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**
```bash
git add features/sending/gmail.ts features/sending/gmail.test.ts
git commit -m "feat: Gmail send boundary with token refresh persistence"
```

---

## Task 7: `features/email-accounts/*` — OAuth helpers, queries, actions

**Files:**
- Create: `features/email-accounts/google-oauth.ts`
- Create: `features/email-accounts/google-oauth.test.ts`
- Create: `features/email-accounts/queries.ts`
- Create: `features/email-accounts/actions.ts`

- [ ] **Step 1: Write failing test for the pure state signer**
```ts
// features/email-accounts/google-oauth.test.ts
import {describe, it, expect, beforeAll} from "vitest"
import {signState, verifyState} from "@/features/email-accounts/google-oauth"

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
})

describe("oauth state", () => {
	it("round-trips the orgId", () => {
		const s = signState("org-123")
		expect(verifyState(s)).toBe("org-123")
	})
	it("rejects a tampered state", () => {
		const s = signState("org-123")
		expect(verifyState(s.slice(0, -2) + "xx")).toBeNull()
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/email-accounts/google-oauth.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `google-oauth.ts`**
```ts
// features/email-accounts/google-oauth.ts
import {createHmac, timingSafeEqual} from "node:crypto"
import {google} from "googleapis"
import {encryptSecret} from "@/lib/crypto"

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"

function hmac(payload: string): string {
	const key = process.env.TOKEN_ENCRYPTION_KEY
	if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not set")
	return createHmac("sha256", Buffer.from(key, "base64")).update(payload).digest("base64url")
}

// state = base64url(orgId).signature  — signed so the callback can trust the org.
export function signState(orgId: string): string {
	const payload = Buffer.from(orgId, "utf8").toString("base64url")
	return `${payload}.${hmac(payload)}`
}

export function verifyState(state: string): string | null {
	const [payload, sig] = state.split(".")
	if (!payload || !sig) return null
	const expected = hmac(payload)
	const a = Buffer.from(sig)
	const b = Buffer.from(expected)
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null
	return Buffer.from(payload, "base64url").toString("utf8")
}

function client() {
	return new google.auth.OAuth2(
		process.env.GOOGLE_MAILBOX_CLIENT_ID,
		process.env.GOOGLE_MAILBOX_CLIENT_SECRET,
		process.env.GOOGLE_MAILBOX_REDIRECT_URI,
	)
}

export function buildConsentUrl(state: string): string {
	return client().generateAuthUrl({access_type: "offline", prompt: "consent", scope: [GMAIL_SEND_SCOPE], state})
}

export interface ExchangedMailbox {
	email: string
	accessTokenEnc: string
	refreshTokenEnc: string
	tokenExpiresAt: Date | null
	scope: string | null
}

// Exchange the code, read the mailbox address, return encrypted, DB-ready fields.
export async function exchangeCodeToMailbox(code: string): Promise<ExchangedMailbox> {
	const c = client()
	const {tokens} = await c.getToken(code)
	c.setCredentials(tokens)
	const oauth2 = google.oauth2({version: "v2", auth: c})
	const profile = await oauth2.userinfo.get()
	const email = profile.data.email
	if (!email) throw new Error("Could not read mailbox email")
	if (!tokens.access_token || !tokens.refresh_token) throw new Error("Missing tokens (re-consent with prompt=consent)")
	return {
		email,
		accessTokenEnc: encryptSecret(tokens.access_token),
		refreshTokenEnc: encryptSecret(tokens.refresh_token),
		tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
		scope: tokens.scope ?? null,
	}
}
```

Note: `google.oauth2(...).userinfo.get()` needs the `userinfo.email` scope; add `"https://www.googleapis.com/auth/userinfo.email"` to the scope array if the email comes back empty, OR use `google.gmail({version:"v1",auth:c}).users.getProfile({userId:"me"})` which returns `emailAddress` under the `gmail.send`-adjacent profile. Verify which works with the `gmail.send`-only consent during Task 7 manual check; prefer `getProfile` if it avoids an extra scope.

- [ ] **Step 4: Run pure test — expect PASS**

Run: `npx vitest run features/email-accounts/google-oauth.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Implement `queries.ts`**
```ts
// features/email-accounts/queries.ts
import {prisma} from "@/lib/prisma"

export async function listEmailAccounts(orgId: string) {
	return prisma.emailAccount.findMany({
		where: {organizationId: orgId},
		select: {id: true, email: true, displayName: true, status: true, dailyLimit: true, createdAt: true},
		orderBy: {createdAt: "desc"},
	})
}
```

- [ ] **Step 6: Implement `actions.ts`**
```ts
"use server"
// features/email-accounts/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"

export async function disconnectEmailAccount(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.emailAccount.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/skrzynki")
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: passes)
```bash
git add features/email-accounts
git commit -m "feat: email-account OAuth helpers, queries and disconnect action"
```

---

## Task 8: OAuth route handlers

**Files:**
- Create: `app/api/mailbox/google/connect/route.ts`
- Create: `app/api/mailbox/google/callback/route.ts`

- [ ] **Step 1: Implement connect handler**
```ts
// app/api/mailbox/google/connect/route.ts
import {NextResponse} from "next/server"
import {requireOrg} from "@/lib/org"
import {buildConsentUrl, signState} from "@/features/email-accounts/google-oauth"

export async function GET() {
	const {orgId} = await requireOrg()
	const url = buildConsentUrl(signState(orgId))
	return NextResponse.redirect(url)
}
```

- [ ] **Step 2: Implement callback handler**
```ts
// app/api/mailbox/google/callback/route.ts
import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import {exchangeCodeToMailbox, verifyState} from "@/features/email-accounts/google-oauth"

export async function GET(request: Request) {
	const params = new URL(request.url).searchParams
	const code = params.get("code")
	const state = params.get("state")
	const orgId = state ? verifyState(state) : null
	if (!code || !orgId) {
		return NextResponse.redirect(new URL("/skrzynki?error=oauth", request.url))
	}
	try {
		const mailbox = await exchangeCodeToMailbox(code)
		await prisma.emailAccount.upsert({
			where: {organizationId_email: {organizationId: orgId, email: mailbox.email}},
			update: {
				accessTokenEnc: mailbox.accessTokenEnc,
				refreshTokenEnc: mailbox.refreshTokenEnc,
				tokenExpiresAt: mailbox.tokenExpiresAt,
				scope: mailbox.scope,
				status: "CONNECTED",
			},
			create: {
				organizationId: orgId,
				email: mailbox.email,
				displayName: mailbox.email,
				accessTokenEnc: mailbox.accessTokenEnc,
				refreshTokenEnc: mailbox.refreshTokenEnc,
				tokenExpiresAt: mailbox.tokenExpiresAt,
				scope: mailbox.scope,
			},
		})
		return NextResponse.redirect(new URL("/skrzynki?connected=1", request.url))
	} catch {
		return NextResponse.redirect(new URL("/skrzynki?error=exchange", request.url))
	}
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: passes)
```bash
git add app/api/mailbox
git commit -m "feat: Google mailbox OAuth connect and callback routes"
```

(Real end-to-end verification of these routes happens in Task 12 once the GCP client exists.)

---

## Task 9: `features/campaigns/sending-actions.ts` — activate / pause / resume

**Files:**
- Create: `features/campaigns/sending-actions.ts`
- Test: `features/campaigns/sending-actions.test.ts`

- [ ] **Step 1: Write failing test for `validateActivation` (pure)**
```ts
// features/campaigns/sending-actions.test.ts
import {describe, it, expect} from "vitest"
import {validateActivation} from "@/features/campaigns/sending-actions"

describe("validateActivation", () => {
	it("ok when mailbox, step 0 and a pending lead exist", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 3})).toEqual({ok: true})
	})
	it("fails without a sending mailbox", () => {
		expect(validateActivation({sendingEmailAccountId: null, hasStepZero: true, pendingLeadCount: 3}))
			.toEqual({ok: false, error: "Wybierz skrzynkę wysyłkową"})
	})
	it("fails without a first step", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: false, pendingLeadCount: 3}))
			.toEqual({ok: false, error: "Dodaj pierwszy krok sekwencji"})
	})
	it("fails without pending leads", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 0}))
			.toEqual({ok: false, error: "Brak leadów do wysłania"})
	})
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run features/campaigns/sending-actions.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**
```ts
"use server"
// features/campaigns/sending-actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {planSchedule} from "@/features/sending/schedule"

export type ActivateResult = {ok: true} | {ok: false; error: string}

export interface ActivationFacts {
	sendingEmailAccountId: string | null
	hasStepZero: boolean
	pendingLeadCount: number
}

// Pure precondition check (unit-tested).
export function validateActivation(f: ActivationFacts): ActivateResult {
	if (!f.sendingEmailAccountId) return {ok: false, error: "Wybierz skrzynkę wysyłkową"}
	if (!f.hasStepZero) return {ok: false, error: "Dodaj pierwszy krok sekwencji"}
	if (f.pendingLeadCount <= 0) return {ok: false, error: "Brak leadów do wysłania"}
	return {ok: true}
}

function startOfLocalDayUTC(now: Date, tz: string): Date {
	const key = new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).format(now)
	// midnight of the local day, expressed as an instant we can compare sentAt against
	return new Date(`${key}T00:00:00`)
}

export async function activateCampaign(campaignId: string): Promise<ActivateResult> {
	const {orgId} = await requireOrg()
	const campaign = await prisma.campaign.findFirst({
		where: {id: campaignId, organizationId: orgId},
		select: {id: true, sendingEmailAccountId: true},
	})
	if (!campaign) return {ok: false, error: "Kampania nie istnieje"}

	const stepZero = await prisma.sequenceStep.findFirst({where: {campaignId, order: 0}, select: {id: true}})
	const pendingLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: "PENDING"},
		select: {id: true},
		orderBy: {createdAt: "asc"},
	})

	const check = validateActivation({
		sendingEmailAccountId: campaign.sendingEmailAccountId,
		hasStepZero: Boolean(stepZero),
		pendingLeadCount: pendingLeads.length,
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

	const plan = planSchedule({
		leadIds: pendingLeads.map((l) => l.id),
		now,
		account,
		sentTodayCount,
		rng: Math.random,
	})

	await prisma.$transaction([
		prisma.campaign.update({where: {id: campaignId}, data: {status: "ACTIVE"}}),
		...plan.map((p) =>
			prisma.campaignLead.update({where: {id: p.leadId}, data: {status: "ACTIVE", currentStep: 0, nextSendAt: p.nextSendAt}}),
		),
	])

	await inngest.send(
		plan.map((p) => ({name: "campaign/lead.send", data: {campaignLeadId: p.leadId, emailAccountId: account.id}})),
	)

	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}

export async function pauseCampaign(campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.updateMany({where: {id: campaignId, organizationId: orgId}, data: {status: "PAUSED"}})
	revalidatePath(`/kampanie/${campaignId}`)
}
```

Note: `resumeCampaign` = re-run `activateCampaign` (it re-plans the remaining `PENDING`/`ACTIVE`-without-SENT leads). For v1, resuming is "Aktywuj" again; a dedicated resume that filters already-sent leads can be added in Phase 5 alongside followups. Document this in the campaign UI copy.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run features/campaigns/sending-actions.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: passes; `campaign/lead.send` event is referenced before the function exists — that is fine, `inngest.send` is untyped here).
```bash
git add features/campaigns/sending-actions.ts features/campaigns/sending-actions.test.ts
git commit -m "feat: campaign activation that plans and enqueues sends"
```

---

## Task 10: `lib/inngest/sending.ts` — the send worker + registration

**Files:**
- Create: `lib/inngest/sending.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Implement the function**
```ts
// lib/inngest/sending.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {sendEmail} from "@/features/sending/gmail"
import {renderTemplate, type RenderLead} from "@/features/templates/render"
import {resolveRecipient} from "@/features/sending/recipient"
import {isWithinWindow, nextWindowOpen} from "@/features/sending/schedule"

export const sendCampaignEmail = inngest.createFunction(
	{
		id: "send-campaign-email",
		triggers: {event: "campaign/lead.send"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
		retries: 3,
	},
	async ({event, step}) => {
		const {campaignLeadId} = event.data as {campaignLeadId: string; emailAccountId: string}

		const cl = await prisma.campaignLead.findUnique({
			where: {id: campaignLeadId},
			include: {campaign: true, lead: true},
		})
		if (!cl || cl.status !== "ACTIVE" || cl.campaign.status !== "ACTIVE") return {skipped: "not-active"}

		const account = cl.campaign.sendingEmailAccountId
			? await prisma.emailAccount.findUnique({where: {id: cl.campaign.sendingEmailAccountId}})
			: null
		if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

		// Wait for the planned slot.
		if (cl.nextSendAt) await step.sleepUntil("wait-slot", cl.nextSendAt)

		// Re-check the window now; if closed, defer to the next open slot and stop (a fresh event is not needed —
		// reschedule by sleeping again).
		const now = new Date()
		if (!isWithinWindow(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)) {
			const open = nextWindowOpen(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)
			await step.sleepUntil("wait-window", open)
		}

		// Daily limit (count this local day's SENT messages).
		const dayStart = new Date(
			new Intl.DateTimeFormat("en-CA", {timeZone: account.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date()) + "T00:00:00",
		)
		const sentToday = await prisma.message.count({where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: dayStart}}})
		if (sentToday >= account.dailyLimit) {
			const open = nextWindowOpen(new Date(Date.now() + 60_000), account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)
			await step.sleepUntil("wait-daily-limit", open)
		}

		// Suppression gate.
		if (cl.lead.email) {
			const sup = await prisma.suppression.findUnique({
				where: {organizationId_email: {organizationId: cl.campaign.organizationId, email: cl.lead.email}},
			})
			if (sup) {
				await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
				return {skipped: "suppressed"}
			}
		}
		if (!cl.lead.email) {
			await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
			return {skipped: "no-email"}
		}

		// Resolve the template for step 0 and render subject + body.
		const stepZero = await prisma.sequenceStep.findFirst({
			where: {campaignId: cl.campaignId, order: 0},
			include: {template: true},
		})
		if (!stepZero) return {skipped: "no-step"}
		const placeholders = await prisma.placeholder.findMany({
			where: {organizationId: cl.campaign.organizationId},
			select: {key: true, source: true, fallback: true},
		})
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
		const subject = renderTemplate(stepZero.template.subject, ctx).rendered
		const body = renderTemplate(stepZero.template.body, ctx).rendered

		const {to} = resolveRecipient(cl.lead.email, process.env.SEND_OVERRIDE_TO)

		try {
			const ids = await step.run("gmail-send", () => sendEmail(account, {to, subject, text: body}))
			await step.run("log-success", async () => {
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
				await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "DONE", currentStep: 1}})
			})
			return {sent: ids.gmailMessageId}
		} catch (err) {
			await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "FAILED", lastError: String(err).slice(0, 500)}})
			throw err // let Inngest record the failure after retries
		}
	},
)
```

Note: confirm `retries` is a valid top-level function-config key in the installed Inngest types before relying on it; if the typecheck rejects it, remove it (the SDK default already retries). Verify against `node_modules/inngest/components/InngestFunction.d.ts`.

- [ ] **Step 2: Register the function**

In `app/api/inngest/route.ts`, import and add `sendCampaignEmail` to the `functions` array passed to `serve`.
```ts
// app/api/inngest/route.ts  (add import + array entry)
import {sendCampaignEmail} from "@/lib/inngest/sending"
// ...serve({client: inngest, functions: [helloWorld, sendCampaignEmail]})
```
(Match the existing `serve(...)` call shape in that file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. Fix any type mismatch against the generated Prisma types / Inngest config (e.g. remove `retries` if unsupported).

- [ ] **Step 4: Commit**
```bash
git add lib/inngest/sending.ts app/api/inngest/route.ts
git commit -m "feat: Inngest send worker (window, daily limit, suppression, log)"
```

---

## Task 11: Minimal UI — mailbox page + campaign controls

**Files:**
- Create: `app/(app)/skrzynki/page.tsx`
- Modify: `app/(app)/kampanie/[id]/page.tsx` (confirm exact path first)

- [ ] **Step 1: Mailbox page** (raw Tailwind, server component)
```tsx
// app/(app)/skrzynki/page.tsx
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"

export default async function SkrzynkiPage() {
	const {orgId} = await requireOrg()
	const accounts = await listEmailAccounts(orgId)
	return (
		<div className="mx-auto max-w-2xl p-6">
			<h1 className="text-xl font-semibold">Skrzynki wysyłkowe</h1>
			<a className="mt-4 inline-block rounded bg-black px-3 py-2 text-white" href="/api/mailbox/google/connect">
				Połącz skrzynkę Google
			</a>
			<ul className="mt-6 space-y-2">
				{accounts.map((a) => (
					<li className="flex items-center justify-between rounded border p-3" key={a.id}>
						<span>
							{a.email} <span className="text-sm text-gray-500">({a.status})</span>
						</span>
						<form
							action={async () => {
								"use server"
								await disconnectEmailAccount(a.id)
							}}
						>
							<button className="text-sm text-red-600" type="submit">
								Odłącz
							</button>
						</form>
					</li>
				))}
				{accounts.length === 0 && <li className="text-sm text-gray-500">Brak połączonych skrzynek.</li>}
			</ul>
		</div>
	)
}
```

- [ ] **Step 2: Campaign controls** — on the campaign detail page add:
  - a `<select name="sendingEmailAccountId">` populated from `listEmailAccounts(orgId)`, submitted by a small server action that does `prisma.campaign.update({where:{id,organizationId:orgId}, data:{sendingEmailAccountId}})` + `revalidatePath`.
  - an "Aktywuj wysyłkę" button whose form action calls `activateCampaign(id)` and surfaces the returned `error` if `!ok`.
  - a "Pauza" button calling `pauseCampaign(id)`.

Add the setter action to `features/campaigns/sending-actions.ts`:
```ts
export async function setSendingMailbox(campaignId: string, emailAccountId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.updateMany({where: {id: campaignId, organizationId: orgId}, data: {sendingEmailAccountId: emailAccountId || null}})
	revalidatePath(`/kampanie/${campaignId}`)
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expected: passes)
```bash
git add "app/(app)/skrzynki" "app/(app)/kampanie" features/campaigns/sending-actions.ts
git commit -m "feat: mailbox page and campaign sending controls"
```

---

## Task 12: Full verification + manual end-to-end

- [ ] **Step 1: Static gates** (dev server OFF for build)
```bash
npx tsc --noEmit
npx vitest run
npm run build
```
Expected: tsc clean; all vitest suites green; production build succeeds.

- [ ] **Step 2: GCP setup** (one-time, USER)
  - Create an OAuth client (type: Web) in a GCP project; enable the Gmail API.
  - Authorized redirect URI: `http://localhost:3000/api/mailbox/google/callback`.
  - Add your Google account as a Test user (OAuth consent screen).
  - Put `GOOGLE_MAILBOX_CLIENT_ID` / `GOOGLE_MAILBOX_CLIENT_SECRET` into `.env`. Confirm `GOOGLE_MAILBOX_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `SEND_OVERRIDE_TO` are set.

- [ ] **Step 3: Connect a mailbox**
  - `npm run dev`, log in, open `/skrzynki`, click "Połącz skrzynkę Google", consent.
  - Expect a row with your address and status `CONNECTED`; in DB the token columns are ciphertext (`iv:tag:ct`), not plaintext.

- [ ] **Step 4: Send the seeded campaign** (Inngest dev server running: `npx inngest-cli dev` if used locally)
  - Open the seeded campaign (Kampania LO Q2 — 1 step, 1 lead), select the connected mailbox, click "Aktywuj wysyłkę".
  - Expect: an email arrives at `SEND_OVERRIDE_TO`; a `Message` row `status=SENT` with `gmailMessageId`/`gmailThreadId`, `intendedTo`=lead email, `actualTo`=override; the `CampaignLead` is `DONE`.

- [ ] **Step 5: Spot-check pacing/suppression**
  - Enroll a few leads; confirm `nextSendAt` values are spaced and within the window; add a lead's email to Suppression and confirm that lead becomes `SKIPPED` with no `Message`.

- [ ] **Step 6: Update the knowledge graph + roadmap**
  - `graphify update .` (AST-only, free) after code; then once for the docs: `graphify . --obsidian` (has API cost — run once).
  - Mark Phase 4 DONE in `docs/superpowers/ROADMAP.md`.
```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs: mark phase 4 done; refresh knowledge graph"
```

---

## Self-review

**Spec coverage:** schema (Task 1) ✓; OAuth connect + encryption (Tasks 2, 7, 8) ✓; Gmail send + MIME + override guard (Tasks 3, 4, 6) ✓; Inngest engine Approach A with pacing/window/limit/suppression (Tasks 5, 9, 10) ✓; error handling FAILED/SKIPPED (Tasks 9, 10) ✓; UI (Task 11) ✓; testing + manual e2e (Task 12) ✓; out-of-scope items (followups, replies, bounces, warmup, tracking) intentionally absent ✓.

**Placeholder scan:** no "TBD"/"add error handling"-style gaps; every code step carries full code; the two "confirm path/option" notes (campaign page path; Inngest `retries` key) are explicit verification instructions, not missing content.

**Type consistency:** `EmailAccount` pacing fields match `PacingAccount` in `schedule.ts`; `planSchedule` input/output (`leadIds`, `{leadId, nextSendAt}`) consistent across Tasks 5 and 9; event name `campaign/lead.send` with `{campaignLeadId, emailAccountId}` consistent across Tasks 9 and 10; `sendEmail(account, {to, subject, text})` signature consistent across Tasks 6 and 10; `renderTemplate(text, ctx)` used per its real signature (Task 10). `resolveRecipient` returns `{to, overridden}` used in Task 10.

Known risk: Task 5 timezone/pacing edge cases and Task 10 orchestration are the highest-risk; their behavior is locked by unit tests (Task 5) and manual e2e (Task 12).
