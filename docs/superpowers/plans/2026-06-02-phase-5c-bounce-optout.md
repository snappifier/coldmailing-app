# Phase 5c — Smarter inbound (bounce + opt-out + RODO) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify every inbound message (REPLY / BOUNCE / AUTO_REPLY / OPT_OUT_SUSPECT) and act per type: bounce -> BOUNCED + flag (manual suppress), out-of-office ignored, opt-out detected via a pluggable keyword|LLM detector gated by a per-org OFF/SUGGEST/AUTO mode, plus a manual "Nie kontaktowac" button.

**Architecture:** Pure `classifyInbound` (deterministic, from headers) + a pluggable `OptOutDetector` (keyword default, LLM optional) feed a rewritten branch in the 5a poller (`pollMailboxReplies`) that replaces the unconditional `recordReply`. Per-org settings (`optOutMode`, `optOutDetector`) live on `Organization`; inbound classification is stored on `Message.inboundKind` with the snippet in `Message.body`. A minimal leads/replies list on the campaign page shows the snippet + a kind badge + a "Nie kontaktowac" action that upserts `Suppression`.

**Tech Stack:** Next 16 / React 19 / TypeScript 6, Prisma 7.8 (`@/generated/prisma/client`), Inngest v4.5.0, googleapis 173, `@anthropic-ai/sdk` (NEW, LLM detector), Vitest 4, Zod 4. Spec: `docs/superpowers/specs/2026-06-02-phase-5c-bounce-optout-design.md`.

---

## File structure (decomposition)

- `prisma/schema.prisma` (MODIFY) — enums `OptOutMode`/`OptOutDetector`/`InboundKind`; `Organization.optOutMode`/`optOutDetector`; `Message.inboundKind` (+ migration).
- `features/replies/classify.ts` (NEW, pure) — `classifyInbound(facts) -> "REPLY"|"BOUNCE"|"AUTO_REPLY"`. Test: `classify.test.ts`.
- `features/replies/optout/types.ts` (NEW) — `OptOutResult`, `OptOutDetector` (no imports; breaks cycles).
- `features/replies/optout/keyword.ts` (NEW, pure) — `keywordDetector`. Test: `keyword.test.ts`.
- `features/replies/optout/llm.ts` (NEW, boundary) — `llmDetector` (Anthropic). Test: `llm.test.ts` (mocked).
- `features/replies/optout/index.ts` (NEW) — `getDetector(kind)` + re-export types.
- `features/replies/match.ts` (MODIFY) — `AddedMessage` gains `snippet` + `autoSubmitted`/`precedence`/`failedRecipients`.
- `features/replies/gmail-history.ts` (MODIFY) — fetch snippet + the new headers.
- `features/replies/queries.ts` (MODIFY) — `recordInbound` (kind + snippet, per-type writes) replacing the reply-only `recordReply`.
- `lib/inngest/replies.ts` (MODIFY) — classify + per-type branch in `pollMailboxReplies`.
- `features/org/settings.ts` (NEW) — `getOrgSettings`, `setOrgInboundSettings`.
- `features/suppression/actions.ts` (MODIFY) — `markDoNotContact(campaignLeadId)`.
- `app/(app)/ustawienia/page.tsx` + `settings-form.tsx` (NEW) — two selects.
- `app/(app)/layout.tsx` (MODIFY) — nav link to `/ustawienia`.
- `app/(app)/kampanie/[id]/lead-inbox.tsx` (NEW) + `page.tsx` (MODIFY) — leads/replies list with badge + button.

Order is value-first: Tasks 1-2-5-6 (classification + bounce/OOO fix) land an MVP; 3-4-7 add opt-out detection + settings; 8 adds the manual button + UI.

---

## Task 0: Verification notes (no code)

- [ ] **Step 1: Confirm library facts (AGENTS.md: verify before coding)**
  - **Anthropic SDK is NOT installed** (`node_modules/@anthropic-ai` absent; not in `package.json`). Task 4 runs `npm install @anthropic-ai/sdk`. Before writing `llm.ts`, **invoke the `claude-api` skill** (or read the installed SDK README) to confirm: the current cheap model id, the `client.messages.create({model, max_tokens, system, messages})` shape, and the prompt-caching idiom (`system` as `[{type:"text", text, cache_control:{type:"ephemeral"}}]`). The id `claude-haiku-4-5` in Task 4 is a starting point to confirm/replace.
  - **Gmail `users.messages.get`**: confirm `format:"metadata"` returns `data.snippet`. If it does not, use `format:"full"` (snippet is always on the message resource). Confirm `metadataHeaders` accepts `Auto-Submitted`/`Precedence`/`X-Failed-Recipients`.
  - **`runLeadSequence` `HARD_STOP`** already includes `BOUNCED` + `UNSUBSCRIBED` (`lib/inngest/sending.ts:10`), so suppressing/bouncing a lead self-stops its in-flight followup — no orchestrator change needed.

No commit (notes only).

---

## Task 1: Migration — settings + inbound classification

**Files:** Modify `prisma/schema.prisma`; generate a migration.

- [ ] **Step 1: Add enums (after the existing `MessageStatus` enum block)**

```prisma
enum OptOutMode {
	OFF
	SUGGEST
	AUTO
}

enum OptOutDetector {
	KEYWORD
	LLM
}

enum InboundKind {
	REPLY
	BOUNCE
	AUTO_REPLY
	OPT_OUT_SUSPECT
}
```

- [ ] **Step 2: Add the two fields to `model Organization` (after `updatedAt`)**

```prisma
	optOutMode     OptOutMode     @default(OFF)
	optOutDetector OptOutDetector @default(KEYWORD)
```

- [ ] **Step 3: Add the field to `model Message` (after `direction`)**

```prisma
	inboundKind InboundKind?
```

- [ ] **Step 4: Create the migration (dev server OFF)**

Run: `npx prisma migrate dev --name phase5c_inbound_classification`
Expected: migration created + applied; `generated/prisma` regenerated; no errors.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add prisma/schema.prisma prisma/migrations generated/prisma
git commit -m "$(printf 'feat: schema for phase 5c (org opt-out settings + Message.inboundKind)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 2: Pure inbound classifier — `features/replies/classify.ts`

**Files:** Create `features/replies/classify.ts`; Test `features/replies/classify.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// features/replies/classify.test.ts
import {describe, it, expect} from "vitest"
import {classifyInbound, type InboundFacts} from "@/features/replies/classify"

const base: InboundFacts = {from: "lead@example.com", subject: "Re: oferta", labelIds: [], autoSubmitted: null, precedence: null, failedRecipients: null}

describe("classifyInbound", () => {
	it("BOUNCE from mailer-daemon", () => {
		expect(classifyInbound({...base, from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>"})).toBe("BOUNCE")
	})
	it("BOUNCE via X-Failed-Recipients", () => {
		expect(classifyInbound({...base, failedRecipients: "dead@nope.com"})).toBe("BOUNCE")
	})
	it("BOUNCE via subject", () => {
		expect(classifyInbound({...base, subject: "Delivery Status Notification (Failure)"})).toBe("BOUNCE")
	})
	it("AUTO_REPLY via Auto-Submitted", () => {
		expect(classifyInbound({...base, autoSubmitted: "auto-replied"})).toBe("AUTO_REPLY")
	})
	it("AUTO_REPLY via Precedence bulk", () => {
		expect(classifyInbound({...base, precedence: "bulk"})).toBe("AUTO_REPLY")
	})
	it("AUTO_REPLY via subject (Polish OOO)", () => {
		expect(classifyInbound({...base, subject: "Automatyczna odpowiedz: jestem nieobecny"})).toBe("AUTO_REPLY")
	})
	it("REPLY otherwise", () => {
		expect(classifyInbound(base)).toBe("REPLY")
	})
	it("Auto-Submitted 'no' is still a REPLY", () => {
		expect(classifyInbound({...base, autoSubmitted: "no"})).toBe("REPLY")
	})
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run features/replies/classify.test.ts`
Expected: FAIL — cannot resolve `@/features/replies/classify`.

- [ ] **Step 3: Implement**

```ts
// features/replies/classify.ts
export type DeterministicKind = "REPLY" | "BOUNCE" | "AUTO_REPLY"

export interface InboundFacts {
	from: string
	subject: string
	labelIds: string[]
	autoSubmitted: string | null
	precedence: string | null
	failedRecipients: string | null
}

const BOUNCE_FROM = /mailer-daemon|postmaster/i
const BOUNCE_SUBJECT = /delivery status notification|undelivered|delivery failed|delivery has failed|failure notice|returned mail|nie dostarczono/i
const AUTO_SUBJECT = /out of office|automatyczna odpowied|autoreply|auto-reply|nieobecno/i
const AUTO_PRECEDENCE = /auto_reply|bulk|junk/i

// Deterministic, header-based classification. OPT_OUT is a later refinement of REPLY (the detector).
export function classifyInbound(f: InboundFacts): DeterministicKind {
	if (BOUNCE_FROM.test(f.from) || f.failedRecipients || BOUNCE_SUBJECT.test(f.subject)) return "BOUNCE"
	const auto = f.autoSubmitted ? f.autoSubmitted.toLowerCase() : ""
	if ((auto !== "" && auto !== "no") || (f.precedence !== null && AUTO_PRECEDENCE.test(f.precedence)) || AUTO_SUBJECT.test(f.subject)) {
		return "AUTO_REPLY"
	}
	return "REPLY"
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run features/replies/classify.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add features/replies/classify.ts features/replies/classify.test.ts
git commit -m "$(printf 'feat: pure inbound classifier (bounce/auto-reply/reply)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 3: Opt-out detector types + keyword detector

**Files:** Create `features/replies/optout/types.ts`, `features/replies/optout/keyword.ts`; Test `features/replies/optout/keyword.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// features/replies/optout/keyword.test.ts
import {describe, it, expect} from "vitest"
import {keywordDetector} from "@/features/replies/optout/keyword"

describe("keywordDetector", () => {
	it("detects an explicit opt-out (diacritics + caps)", async () => {
		expect((await keywordDetector.detect("Nie jestem zainteresowany, dziekuje")).optOut).toBe(true)
	})
	it("detects 'prosze usunac' with Polish letters", async () => {
		expect((await keywordDetector.detect("Proszę usunąć mnie z listy")).optOut).toBe(true)
	})
	it("detects 'rezygnuje' (stem match)", async () => {
		expect((await keywordDetector.detect("Rezygnuję z oferty")).optOut).toBe(true)
	})
	it("does not flag an interested reply", async () => {
		expect((await keywordDetector.detect("Bardzo interesująca oferta, porozmawiajmy")).optOut).toBe(false)
	})
	it("score is 1 on hit, 0 on miss", async () => {
		expect((await keywordDetector.detect("wypisz")).score).toBe(1)
		expect((await keywordDetector.detect("dzien dobry")).score).toBe(0)
	})
})
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run features/replies/optout/keyword.test.ts`
Expected: FAIL — cannot resolve `@/features/replies/optout/keyword`.

- [ ] **Step 3: Implement the types + the detector**

```ts
// features/replies/optout/types.ts
export interface OptOutResult {
	optOut: boolean
	score: number
}

export interface OptOutDetector {
	detect(text: string): Promise<OptOutResult>
}
```

```ts
// features/replies/optout/keyword.ts
import type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

// All entries are pre-normalized (lowercase, no diacritics, l for the Polish stroked-l).
const PHRASES = [
	"nie jestem zainteresowany",
	"nie jestesmy zainteresowani",
	"nie zainteresowany",
	"prosze nie wysylac",
	"prosze o niekontaktowanie",
	"nie piszcie",
	"nie pisac",
	"rezygnuj",
	"prosze usunac",
	"usuncie mnie",
	"wypisz",
	"odczepcie sie",
	"unsubscribe",
]

// Lowercase, strip combining diacritics, and map the Polish stroked-l (not decomposed by NFD).
function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/ł/g, "l")
}

export const keywordDetector: OptOutDetector = {
	async detect(text: string): Promise<OptOutResult> {
		const n = normalize(text)
		const optOut = PHRASES.some((p) => n.includes(p))
		return {optOut, score: optOut ? 1 : 0}
	},
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run features/replies/optout/keyword.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add features/replies/optout/types.ts features/replies/optout/keyword.ts features/replies/optout/keyword.test.ts
git commit -m "$(printf 'feat: opt-out detector interface + keyword detector\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 4: LLM detector + getDetector

**Files:** Install `@anthropic-ai/sdk`; Create `features/replies/optout/llm.ts`, `features/replies/optout/index.ts`; Test `features/replies/optout/llm.test.ts`.

- [ ] **Step 1: Install the SDK and verify the API**

Run: `npm install @anthropic-ai/sdk`
Then **invoke the `claude-api` skill** (or read `node_modules/@anthropic-ai/sdk/README.md`) and confirm: the current cheap model id, `client.messages.create` shape, and `system` prompt-caching. Adjust the model id in Step 3 if needed.

- [ ] **Step 2: Write the failing test (mocked SDK)**

```ts
// features/replies/optout/llm.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"

const {create} = vi.hoisted(() => ({create: vi.fn()}))
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = {create}
	},
}))

import {llmDetector} from "@/features/replies/optout/llm"

beforeEach(() => {
	create.mockReset()
	process.env.ANTHROPIC_API_KEY = "test-key"
})

describe("llmDetector", () => {
	it("parses the model JSON into a result", async () => {
		create.mockResolvedValue({content: [{type: "text", text: '{"optOut": true, "score": 0.9}'}]})
		expect(await llmDetector.detect("nie dla nas, dzieki")).toEqual({optOut: true, score: 0.9})
	})
	it("fails safe to not-opt-out without an API key", async () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(await llmDetector.detect("cokolwiek")).toEqual({optOut: false, score: 0})
		expect(create).not.toHaveBeenCalled()
	})
	it("fails safe on an API error", async () => {
		create.mockRejectedValue(new Error("boom"))
		expect(await llmDetector.detect("cokolwiek")).toEqual({optOut: false, score: 0})
	})
})
```

- [ ] **Step 3: Run the test (fails), then implement**

Run: `npx vitest run features/replies/optout/llm.test.ts`
Expected: FAIL — cannot resolve `@/features/replies/optout/llm`.

```ts
// features/replies/optout/llm.ts
import Anthropic from "@anthropic-ai/sdk"
import type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

const SYSTEM =
	"Jestes klasyfikatorem odpowiedzi na cold-mail B2B po polsku. Oceniasz, czy nadawca prosi o zaprzestanie kontaktu lub jednoznacznie nie jest zainteresowany. Odpowiadasz WYLACZNIE jednym obiektem JSON: {\"optOut\": boolean, \"score\": number od 0 do 1}."

export const llmDetector: OptOutDetector = {
	async detect(text: string): Promise<OptOutResult> {
		if (!process.env.ANTHROPIC_API_KEY) return {optOut: false, score: 0}
		try {
			const client = new Anthropic()
			const res = await client.messages.create({
				model: "claude-haiku-4-5",
				max_tokens: 64,
				system: SYSTEM,
				messages: [{role: "user", content: text.slice(0, 4000)}],
			})
			const block = res.content.find((b) => b.type === "text")
			const raw = block && block.type === "text" ? block.text : "{}"
			const parsed = JSON.parse(raw) as {optOut?: boolean; score?: number}
			const optOut = Boolean(parsed.optOut)
			return {optOut, score: typeof parsed.score === "number" ? parsed.score : optOut ? 1 : 0}
		} catch {
			return {optOut: false, score: 0}
		}
	},
}
```

```ts
// features/replies/optout/index.ts
import type {OptOutDetector} from "@/features/replies/optout/types"
import {keywordDetector} from "@/features/replies/optout/keyword"
import {llmDetector} from "@/features/replies/optout/llm"

export type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

export function getDetector(kind: "KEYWORD" | "LLM"): OptOutDetector {
	return kind === "LLM" ? llmDetector : keywordDetector
}
```

- [ ] **Step 4: Run the test + typecheck**

Run: `npx vitest run features/replies/optout/llm.test.ts`
Expected: PASS (3 cases).
Run: `npx tsc --noEmit`
Expected: 0 errors. (If the SDK types reject `system` as an array or `cache_control`, fix per the SDK version confirmed in Step 1 — keep the fail-safe try/catch.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json features/replies/optout/llm.ts features/replies/optout/index.ts features/replies/optout/llm.test.ts
git commit -m "$(printf 'feat: LLM opt-out detector (Anthropic) + getDetector switch\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 5: Fetch snippet + classification headers

**Files:** Modify `features/replies/match.ts` (the `AddedMessage` interface) and `features/replies/gmail-history.ts`; update `features/replies/gmail-history.test.ts`.

- [ ] **Step 1: Extend `AddedMessage` in `features/replies/match.ts`**

Replace the `AddedMessage` interface with:

```ts
export interface AddedMessage {
	gmailMessageId: string
	threadId: string
	from: string
	labelIds: string[]
	snippet: string
	autoSubmitted: string | null
	precedence: string | null
	failedRecipients: string | null
}
```

(Do not change `matchReplies` — it still uses `from`/`labelIds`/`threadId`/`gmailMessageId`.)

- [ ] **Step 2: Update `gmail-history.ts` to fetch the snippet + headers**

In `features/replies/gmail-history.ts`, replace the body of the inner `for (const m of h.messagesAdded ...)` loop's fetch + push with:

```ts
						const meta = await gmail.users.messages.get({
							userId: "me",
							id,
							format: "metadata",
							metadataHeaders: ["From", "Subject", "Auto-Submitted", "Precedence", "X-Failed-Recipients"],
						})
						const headers = meta.data.payload?.headers ?? []
						const hv = (name: string) => headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? null
						added.push({
							gmailMessageId: id,
							threadId,
							from: hv("From") ?? "",
							subject: hv("Subject") ?? "",
							labelIds: meta.data.labelIds ?? [],
							snippet: meta.data.snippet ?? "",
							autoSubmitted: hv("Auto-Submitted"),
							precedence: hv("Precedence"),
							failedRecipients: hv("X-Failed-Recipients"),
						})
```

(If Step-0 verification finds `format:"metadata"` omits `snippet`, change `format` to `"full"`.)

- [ ] **Step 3: Update the existing mocked test**

In `features/replies/gmail-history.test.ts`, update the mocked `messages.get` return to include `snippet` and ensure the asserted `added[...]` objects include the new fields (`snippet`, `autoSubmitted: null`, `precedence: null`, `failedRecipients: null` for a plain reply). Run it:

Run: `npx vitest run features/replies/gmail-history.test.ts`
Expected: PASS after updating the fixture/assertions.

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/replies/match.ts features/replies/gmail-history.ts features/replies/gmail-history.test.ts
git commit -m "$(printf 'feat: fetch inbound snippet + classification headers\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 6: Poller branching — classify + act per type

**Files:** Modify `features/replies/queries.ts` (add `recordInbound`) and `lib/inngest/replies.ts` (`pollMailboxReplies`). No worker unit test (repo convention; covered by the pure tests + tsc + live e2e).

- [ ] **Step 1: Add `recordInbound` to `features/replies/queries.ts`**

Add (keep the existing `getTrackedThreads`; you may remove `recordReply` once the poller no longer calls it):

```ts
import type {InboundKind, Prisma} from "@/generated/prisma/client"

export interface RecordInboundInput {
	organizationId: string
	campaignLeadId: string
	emailAccountId: string
	mailboxEmail: string
	gmailMessageId: string
	gmailThreadId: string
	kind: InboundKind
	subject: string
	snippet: string
	autoSuppress: boolean // AUTO mode + OPT_OUT_SUSPECT
	leadEmail: string | null
}

// Persist the inbound message with its classification and apply the per-type side effects atomically.
export async function recordInbound(input: RecordInboundInput): Promise<void> {
	const ops: Prisma.PrismaPromise<unknown>[] = [
		prisma.message.create({
			data: {
				organizationId: input.organizationId,
				campaignLeadId: input.campaignLeadId,
				emailAccountId: input.emailAccountId,
				direction: "INBOUND",
				inboundKind: input.kind,
				subject: input.subject,
				body: input.snippet,
				intendedTo: input.mailboxEmail,
				actualTo: input.mailboxEmail,
				gmailMessageId: input.gmailMessageId,
				gmailThreadId: input.gmailThreadId,
			},
		}),
	]
	if (input.kind === "BOUNCE") {
		ops.push(prisma.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "BOUNCED"}}))
	} else if (input.kind === "REPLY" || input.kind === "OPT_OUT_SUSPECT") {
		ops.push(prisma.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "REPLIED", repliedAt: new Date()}}))
	}
	// AUTO_REPLY: record only, no status change.
	if (input.autoSuppress && input.leadEmail) {
		ops.push(
			prisma.suppression.upsert({
				where: {organizationId_email: {organizationId: input.organizationId, email: input.leadEmail}},
				update: {},
				create: {organizationId: input.organizationId, email: input.leadEmail, reason: "UNSUBSCRIBED"},
			}),
			prisma.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "UNSUBSCRIBED"}}),
		)
	}
	await prisma.$transaction(ops)
}
```

- [ ] **Step 2: Rewrite the match loop in `lib/inngest/replies.ts` `pollMailboxReplies`**

Replace the imports + the `for (const match of matches)` block. New imports at the top:

```ts
import {getTrackedThreads, recordInbound} from "@/features/replies/queries"
import {matchReplies} from "@/features/replies/match"
import {classifyInbound} from "@/features/replies/classify"
import {getDetector} from "@/features/replies/optout"
```

Replace the per-match loop with:

```ts
		const org = await prisma.organization.findUnique({where: {id: account.organizationId}, select: {optOutMode: true, optOutDetector: true}})
		const mode = org?.optOutMode ?? "OFF"
		const detector = getDetector(org?.optOutDetector ?? "KEYWORD")

		for (const match of matches) {
			const msg = result.added.find((a) => a.gmailMessageId === match.gmailMessageId)
			if (!msg) continue
			const base = classifyInbound({
				from: msg.from,
				subject: msg.subject,
				labelIds: msg.labelIds,
				autoSubmitted: msg.autoSubmitted,
				precedence: msg.precedence,
				failedRecipients: msg.failedRecipients,
			})
			let kind: "REPLY" | "BOUNCE" | "AUTO_REPLY" | "OPT_OUT_SUSPECT" = base
			let autoSuppress = false
			if (base === "REPLY" && mode !== "OFF") {
				const verdict = await step.run(`detect-${match.campaignLeadId}`, () => detector.detect(msg.snippet))
				if (verdict.optOut) {
					kind = "OPT_OUT_SUSPECT"
					autoSuppress = mode === "AUTO"
				}
			}
			const lead = await prisma.campaignLead.findUnique({where: {id: match.campaignLeadId}, include: {lead: {select: {email: true}}}})
			await step.run(`record-${match.campaignLeadId}`, () =>
				recordInbound({
					organizationId: account.organizationId,
					campaignLeadId: match.campaignLeadId,
					emailAccountId: account.id,
					mailboxEmail: account.email,
					gmailMessageId: match.gmailMessageId,
					gmailThreadId: match.threadId,
					kind,
					subject: msg.subject,
					snippet: msg.snippet,
					autoSuppress,
					leadEmail: lead?.lead.email ?? null,
				}),
			)
			if (kind === "REPLY" || kind === "OPT_OUT_SUSPECT") {
				await step.sendEvent(`replied-${match.campaignLeadId}`, {name: "campaign/lead.replied", data: {campaignLeadId: match.campaignLeadId}})
			}
		}
```

(`FetchedMessage` already carries `subject`; `match.threadId` is the thread. BOUNCE/AUTO_REPLY do not emit `campaign/lead.replied` — that is the bug fix.)

- [ ] **Step 3: Typecheck + run the full suite**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npx vitest run`
Expected: all green (existing + Tasks 2-5). If `gmail-history.test.ts` or `match.test.ts` reference the old `AddedMessage` shape, update their fixtures to include the new fields.

- [ ] **Step 4: Commit**

```bash
git add features/replies/queries.ts lib/inngest/replies.ts
git commit -m "$(printf 'feat: classify inbound + act per type in the poller\n\nBounce -> BOUNCED (not a reply); OOO ignored; reply runs the opt-out\ndetector per org mode (OFF/SUGGEST/AUTO).\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 7: Per-org settings + /ustawienia page

**Files:** Create `features/org/settings.ts`, `app/(app)/ustawienia/page.tsx`, `app/(app)/ustawienia/settings-form.tsx`; Modify `app/(app)/layout.tsx`.

- [ ] **Step 1: Settings module `features/org/settings.ts`**

```ts
"use server"
// features/org/settings.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import type {OptOutMode, OptOutDetector} from "@/generated/prisma/client"

const MODES = ["OFF", "SUGGEST", "AUTO"]
const DETECTORS = ["KEYWORD", "LLM"]

export async function getOrgSettings() {
	const {orgId} = await requireOrg()
	const org = await prisma.organization.findUnique({where: {id: orgId}, select: {optOutMode: true, optOutDetector: true}})
	return {optOutMode: org?.optOutMode ?? "OFF", optOutDetector: org?.optOutDetector ?? "KEYWORD"}
}

export async function setOrgInboundSettings(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireOrg()
	const mode = String(formData.get("optOutMode"))
	const detector = String(formData.get("optOutDetector"))
	if (!MODES.includes(mode) || !DETECTORS.includes(detector)) return {ok: false}
	await prisma.organization.update({
		where: {id: orgId},
		data: {optOutMode: mode as OptOutMode, optOutDetector: detector as OptOutDetector},
	})
	revalidatePath("/ustawienia")
	return {ok: true}
}
```

- [ ] **Step 2: The form (client) `app/(app)/ustawienia/settings-form.tsx`**

```tsx
"use client"
// app/(app)/ustawienia/settings-form.tsx

import {useActionState} from "react"
import {setOrgInboundSettings} from "@/features/org/settings"

interface Props {
	optOutMode: string
	optOutDetector: string
}

export function SettingsForm({optOutMode, optOutDetector}: Props) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgInboundSettings, null)
	return (
		<form className="flex flex-col gap-3 text-sm" action={action}>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Wykrywanie rezygnacji</span>
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="optOutMode" defaultValue={optOutMode}>
					<option value="OFF">OFF — nie wykrywaj</option>
					<option value="SUGGEST">SUGGEST — flaguj, klikam ręcznie</option>
					<option value="AUTO">AUTO — sam suppresuj</option>
				</select>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Metoda</span>
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="optOutDetector" defaultValue={optOutDetector}>
					<option value="KEYWORD">Lista fraz</option>
					<option value="LLM">LLM (wymaga ANTHROPIC_API_KEY)</option>
				</select>
			</label>
			<button className="w-32 rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state?.ok ? <span className="text-green-700">Zapisano.</span> : null}
		</form>
	)
}
```

- [ ] **Step 3: The page `app/(app)/ustawienia/page.tsx`**

```tsx
// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsForm} from "./settings-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Ustawienia</h1>
			<SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />
		</section>
	)
}
```

- [ ] **Step 4: Add the nav link in `app/(app)/layout.tsx`**

After the `<Link href="/suppression">Suppression</Link>` line, add:

```tsx
						<Link href="/ustawienia">Ustawienia</Link>
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/org/settings.ts "app/(app)/ustawienia" "app/(app)/layout.tsx"
git commit -m "$(printf 'feat: per-org inbound settings + /ustawienia page\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 8: Manual "Nie kontaktować" + leads/replies list

**Files:** Modify `features/suppression/actions.ts`; Create `app/(app)/kampanie/[id]/lead-inbox.tsx`; Modify `app/(app)/kampanie/[id]/page.tsx`.

- [ ] **Step 1: Add `markDoNotContact` to `features/suppression/actions.ts`**

Append (keep the existing imports + `addSuppression`/`removeSuppression`):

```ts
export async function markDoNotContact(campaignLeadId: string): Promise<void> {
	const {orgId} = await requireOrg()
	const cl = await prisma.campaignLead.findFirst({
		where: {id: campaignLeadId, campaign: {organizationId: orgId}},
		include: {lead: {select: {email: true}}, messages: {where: {direction: "INBOUND"}, orderBy: {createdAt: "desc"}, take: 1, select: {inboundKind: true}}},
	})
	if (!cl) return
	const isBounce = cl.messages[0]?.inboundKind === "BOUNCE"
	if (cl.lead.email) {
		await prisma.suppression.upsert({
			where: {organizationId_email: {organizationId: orgId, email: cl.lead.email}},
			update: {},
			create: {organizationId: orgId, email: cl.lead.email, reason: isBounce ? "BOUNCED" : "UNSUBSCRIBED"},
		})
	}
	await prisma.campaignLead.update({where: {id: cl.id}, data: {status: isBounce ? "BOUNCED" : "UNSUBSCRIBED"}})
	revalidatePath(`/kampanie/${cl.campaignId}`)
}
```

- [ ] **Step 2: The leads/replies list `app/(app)/kampanie/[id]/lead-inbox.tsx`**

```tsx
"use client"
// app/(app)/kampanie/[id]/lead-inbox.tsx

import {markDoNotContact} from "@/features/suppression/actions"

interface Row {
	id: string
	org: string
	status: string
	inboundKind: string | null
	snippet: string | null
}

const BADGE: Record<string, string> = {
	REPLY: "odpowiedź",
	BOUNCE: "odbicie",
	AUTO_REPLY: "auto",
	OPT_OUT_SUSPECT: "możliwa rezygnacja",
}

export function LeadInbox({rows}: {rows: Row[]}) {
	if (rows.length === 0) return <p className="text-sm text-zinc-500">Brak leadów z przychodzącą wiadomością.</p>
	return (
		<ul className="flex flex-col gap-1 text-sm">
			{rows.map((r) => (
				<li className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1" key={r.id}>
					<span className="min-w-0">
						<span className="font-medium">{r.org}</span> · {r.status}
						{r.inboundKind ? <span className="ml-1 rounded bg-zinc-100 px-1 text-xs text-zinc-700">{BADGE[r.inboundKind] ?? r.inboundKind}</span> : null}
						{r.snippet ? <span className="ml-2 truncate text-zinc-500">{r.snippet}</span> : null}
					</span>
					<form action={markDoNotContact.bind(null, r.id)}>
						<button className="shrink-0 text-red-600" type="submit">
							Nie kontaktować
						</button>
					</form>
				</li>
			))}
		</ul>
	)
}
```

- [ ] **Step 3: Load leads + render the list in `app/(app)/kampanie/[id]/page.tsx`**

After the campaign `findFirst` (and before `return`), add a query for leads that have an inbound message:

```ts
	const leads = await prisma.campaignLead.findMany({
		where: {campaignId: id, messages: {some: {direction: "INBOUND"}}},
		select: {
			id: true,
			status: true,
			lead: {select: {organizationName: true}},
			messages: {where: {direction: "INBOUND"}, orderBy: {createdAt: "desc"}, take: 1, select: {inboundKind: true, body: true}},
		},
		orderBy: {createdAt: "asc"},
	})
```

Add the import at the top: `import {LeadInbox} from "./lead-inbox"`. Then render it after `<SequenceAndLeads ... />`:

```tsx
				<div>
					<h2 className="mb-2 text-sm font-semibold text-zinc-700">Przychodzące</h2>
					<LeadInbox
						rows={leads.map((l) => ({
							id: l.id,
							org: l.lead.organizationName,
							status: l.status,
							inboundKind: l.messages[0]?.inboundKind ?? null,
							snippet: l.messages[0]?.body ?? null,
						}))}
					/>
				</div>
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/suppression/actions.ts "app/(app)/kampanie/[id]/lead-inbox.tsx" "app/(app)/kampanie/[id]/page.tsx"
git commit -m "$(printf 'feat: leads/replies list + manual Nie kontaktowac action\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Task 9: Full gates, live e2e, housekeeping

- [ ] **Step 1: Full suite + types + build**

Run: `npx vitest run` → all green (prior 75 + classify(8) + keyword(5) + llm(3) = 91, minus none).
Run: `npx tsc --noEmit` → 0 errors.
Run: `npm run build` (dev server OFF) → exit 0.

- [ ] **Step 2: Live e2e (user-run; dev + inngest-cli; use the `scripts/` helpers)**

  - **Bounce:** seed a lead with a guaranteed-dead address (e.g. `npx prisma studio` → set the test lead's `Lead.email` to `bounce-test@nonexistent.invalid`, or add a second lead), activate, let it send; Gmail returns a bounce; Invoke `scan-mailboxes-for-replies`. Verify: `CampaignLead` `BOUNCED`, inbound `Message.inboundKind=BOUNCE`, **no** `campaign/lead.replied`, badge "odbicie" on the campaign page.
  - **Opt-out SUGGEST:** `/ustawienia` → mode SUGGEST, detector Lista fraz. Reset (`scripts/seed-test-campaign.ts`), activate, reply "nie jestem zainteresowany", Invoke poller. Verify: lead `REPLIED` + badge "możliwa rezygnacja"; click "Nie kontaktować" → email in `Suppression` (`/suppression`), lead `UNSUBSCRIBED`.
  - **Opt-out AUTO:** mode AUTO, repeat; verify it auto-suppresses without the click.
  - **OOO:** reply with an "Automatyczna odpowiedź" subject (or rely on a real autoresponder); verify the sequence is NOT marked replied.

- [ ] **Step 3: Housekeeping**

  - Update `docs/superpowers/ROADMAP.md`: 5c DONE (+ what shipped, deltas, gates); set NEXT = Phase 6 (or the deferred 5c items: unsubscribe link, bounce auto-suppress, custom model).
  - `graphify update .` (AST). Commit roadmap + graphify-out.

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "$(printf 'docs: phase 5c done; refresh knowledge graph\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-review notes (spec coverage)

- Classify every inbound → Task 2 (`classifyInbound`) + Task 6 (poller). Bounce → BOUNCED, not reply → Task 6 `recordInbound`. OOO ignored → Task 6 (record only). Opt-out detector (keyword|LLM, switchable) → Tasks 3-4 + `getDetector`. Per-org mode OFF/SUGGEST/AUTO → Task 1 (schema) + Task 6 (branch) + Task 7 (UI). Snippet/headers → Task 5. Manual "Nie kontaktować" → Task 8. Sender identity → none (spec §9). Migration → Task 1. Gates/e2e → Task 9.
- **Accepted (spec §10/§14):** late bounce flips a DONE lead to BOUNCED; LLM fail-safe to not-opt-out without a key; keyword negation gap; unsubscribe link / bounce auto-suppress / custom model deferred; visual polish in a later session.
- **Type consistency:** `OptOutResult`/`OptOutDetector` in `optout/types.ts` are imported by `keyword.ts`/`llm.ts`/`index.ts` (no cycle). `classifyInbound` returns the 3-value `DeterministicKind`; the poller widens to the 4-value Prisma `InboundKind` (adds `OPT_OUT_SUSPECT`) before `recordInbound`. `AddedMessage` (Task 5) carries the fields `classifyInbound`/`recordInbound` consume.
