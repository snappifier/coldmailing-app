# deliverability-settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give each connected mailbox an editable send-pacing config UI on `/skrzynki` (daily limit, send window, send days, random gap, timezone) backed by a new `updateEmailAccountSettings` action.

**Architecture:** Pure conversion + validation helpers first (TDD), then the org-scoped action + query expansion, then a client settings form rendered per-mailbox card. No DB migration — all seven fields already exist on `EmailAccount` and map 1:1 to the engine's `PacingAccount`. Spec: `docs/superpowers/specs/2026-06-09-phase-7-deliverability-settings-design.md`.

**Tech Stack:** Next 16 (server actions), React 19 (`useActionState`), Prisma 7, Vitest 4, TypeScript 6. Design-foundation primitives (`Field`/`Input`/`Select`/`Button`).

**Conventions:** tabs, no semicolons, `"use client"` line 1 then path comment line 2, `className` first, `import {x}` no inner spaces, NO emoji.

---

## Task 1: Pure conversion + validation logic (TDD)

**Files:**
- Create: `features/email-accounts/settings.ts`
- Test: `features/email-accounts/settings.test.ts`

- [ ] **Step 1: Write the failing test** (`features/email-accounts/settings.test.ts`):

```ts
// features/email-accounts/settings.test.ts
import {describe, it, expect} from "vitest"
import {parseTime, formatTime, maskToDays, daysToMask, isValidTimezone, validateEmailAccountSettings} from "@/features/email-accounts/settings"

describe("parseTime / formatTime", () => {
	it("parses HH:MM to minutes and back", () => {
		expect(parseTime("08:00")).toBe(480)
		expect(parseTime("23:59")).toBe(1439)
		expect(parseTime("00:00")).toBe(0)
		expect(formatTime(480)).toBe("08:00")
		expect(formatTime(1439)).toBe("23:59")
	})
	it("rejects invalid times", () => {
		expect(parseTime("24:00")).toBeNull()
		expect(parseTime("8:60")).toBeNull()
		expect(parseTime("abc")).toBeNull()
		expect(parseTime("")).toBeNull()
	})
})

describe("maskToDays / daysToMask", () => {
	it("round-trips the Mon..Sun bitmask (bit0=Mon)", () => {
		expect(maskToDays(31)).toEqual([true, true, true, true, true, false, false])
		expect(daysToMask([true, true, true, true, true, false, false])).toBe(31)
		expect(maskToDays(127)).toEqual([true, true, true, true, true, true, true])
		expect(daysToMask([false, false, false, false, false, false, false])).toBe(0)
	})
})

describe("isValidTimezone", () => {
	it("accepts real IANA zones, rejects junk", () => {
		expect(isValidTimezone("Europe/Warsaw")).toBe(true)
		expect(isValidTimezone("UTC")).toBe(true)
		expect(isValidTimezone("Mars/Phobos")).toBe(false)
		expect(isValidTimezone("")).toBe(false)
	})
})

describe("validateEmailAccountSettings", () => {
	const ok = {dailyLimit: 40, windowStartMin: 480, windowEndMin: 960, sendDays: 31, minGapSec: 180, maxGapSec: 600, timezone: "Europe/Warsaw"}
	it("returns the update payload on valid input", () => {
		const r = validateEmailAccountSettings(ok)
		expect(r).toEqual({ok: true, value: {dailyLimit: 40, sendWindowStartMin: 480, sendWindowEndMin: 960, sendDays: 31, minGapSec: 180, maxGapSec: 600, timezone: "Europe/Warsaw"}})
	})
	it("rejects bad daily limit", () => {
		expect(validateEmailAccountSettings({...ok, dailyLimit: 0}).ok).toBe(false)
		expect(validateEmailAccountSettings({...ok, dailyLimit: 1001}).ok).toBe(false)
	})
	it("rejects start >= end or unparsed window", () => {
		expect(validateEmailAccountSettings({...ok, windowStartMin: 960, windowEndMin: 480}).ok).toBe(false)
		expect(validateEmailAccountSettings({...ok, windowStartMin: null}).ok).toBe(false)
	})
	it("rejects maxGap < minGap", () => {
		expect(validateEmailAccountSettings({...ok, minGapSec: 600, maxGapSec: 180}).ok).toBe(false)
	})
	it("rejects zero send days", () => {
		expect(validateEmailAccountSettings({...ok, sendDays: 0}).ok).toBe(false)
	})
	it("rejects an invalid timezone", () => {
		expect(validateEmailAccountSettings({...ok, timezone: "Nope/Nope"}).ok).toBe(false)
	})
})
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run features/email-accounts/settings.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `features/email-accounts/settings.ts`:

```ts
// features/email-accounts/settings.ts
export const TIMEZONES = [
	"Europe/Warsaw",
	"Europe/London",
	"Europe/Berlin",
	"Europe/Paris",
	"Europe/Kyiv",
	"UTC",
	"America/New_York",
	"America/Los_Angeles",
]

export function parseTime(hhmm: string): number | null {
	const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim())
	if (!m) return null
	return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function formatTime(min: number): string {
	const h = Math.floor(min / 60)
	const m = min % 60
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function maskToDays(mask: number): boolean[] {
	return Array.from({length: 7}, (_, i) => ((mask >> i) & 1) === 1)
}

export function daysToMask(days: boolean[]): number {
	return days.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0)
}

export function isValidTimezone(tz: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, {timeZone: tz})
		return true
	} catch {
		return false
	}
}

export interface SettingsInput {
	dailyLimit: number
	windowStartMin: number | null
	windowEndMin: number | null
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export interface SettingsFields {
	dailyLimit: number
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export function validateEmailAccountSettings(input: SettingsInput): {ok: true; value: SettingsFields} | {ok: false; error: string} {
	const {dailyLimit, windowStartMin, windowEndMin, sendDays, minGapSec, maxGapSec, timezone} = input
	if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) {
		return {ok: false, error: "Dzienny limit musi być z zakresu 1-1000"}
	}
	if (windowStartMin === null || windowEndMin === null || windowStartMin < 0 || windowEndMin > 1440 || windowStartMin >= windowEndMin) {
		return {ok: false, error: "Okno wysyłki: początek musi być wcześniejszy niż koniec"}
	}
	if (!Number.isInteger(minGapSec) || !Number.isInteger(maxGapSec) || minGapSec < 0 || maxGapSec < minGapSec || maxGapSec > 86400) {
		return {ok: false, error: "Odstęp: min i maks z zakresu 0-86400 s, min nie większy niż maks"}
	}
	if (!Number.isInteger(sendDays) || sendDays < 1 || sendDays > 127) {
		return {ok: false, error: "Wybierz co najmniej jeden dzień wysyłki"}
	}
	if (!isValidTimezone(timezone)) {
		return {ok: false, error: "Nieprawidłowa strefa czasowa"}
	}
	return {ok: true, value: {dailyLimit, sendWindowStartMin: windowStartMin, sendWindowEndMin: windowEndMin, sendDays, minGapSec, maxGapSec, timezone}}
}
```

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx vitest run features/email-accounts/settings.test.ts` — Expected: PASS. Then `npx tsc --noEmit` — Expected: 0.

- [ ] **Step 5: Commit.**

```bash
git add features/email-accounts/settings.ts features/email-accounts/settings.test.ts
git commit -m "feat(phase7): pure mailbox-settings helpers + validation (TDD)"
```

---

## Task 2: Action + query

**Files:**
- Modify: `features/email-accounts/actions.ts`
- Modify: `features/email-accounts/queries.ts`

- [ ] **Step 1: Add the action.** Append to `features/email-accounts/actions.ts` and add the import at the top (the file already imports `revalidatePath`, `prisma`, `requireOrg`):

```ts
import {validateEmailAccountSettings, daysToMask, parseTime} from "@/features/email-accounts/settings"

export type EmailAccountSettingsResult = {ok: true} | {ok: false; error: string}

export async function updateEmailAccountSettings(_prev: EmailAccountSettingsResult | null, formData: FormData): Promise<EmailAccountSettingsResult> {
	const {orgId} = await requireOrg()
	const id = String(formData.get("id") ?? "")
	if (!id) return {ok: false, error: "Brak id"}

	const days = Array.from({length: 7}, (_, i) => formData.get(`day_${i}`) === "on")
	const result = validateEmailAccountSettings({
		dailyLimit: Number(formData.get("dailyLimit")),
		windowStartMin: parseTime(String(formData.get("windowStart") ?? "")),
		windowEndMin: parseTime(String(formData.get("windowEnd") ?? "")),
		sendDays: daysToMask(days),
		minGapSec: Number(formData.get("gapMin")),
		maxGapSec: Number(formData.get("gapMax")),
		timezone: String(formData.get("timezone") ?? ""),
	})
	if (!result.ok) return result

	const res = await prisma.emailAccount.updateMany({where: {id, organizationId: orgId}, data: result.value})
	if (res.count === 0) return {ok: false, error: "Nie znaleziono skrzynki"}
	revalidatePath("/skrzynki")
	return {ok: true}
}
```

- [ ] **Step 2: Expand the query.** In `features/email-accounts/queries.ts`, extend the `select` in `listEmailAccounts`:

```ts
		select: {id: true, email: true, displayName: true, status: true, dailyLimit: true, sendWindowStartMin: true, sendWindowEndMin: true, sendDays: true, minGapSec: true, maxGapSec: true, timezone: true, scope: true, createdAt: true},
```

- [ ] **Step 3: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0.
- [ ] **Step 4: Commit.**

```bash
git add features/email-accounts/actions.ts features/email-accounts/queries.ts
git commit -m "feat(phase7): updateEmailAccountSettings action + expanded mailbox query"
```

---

## Task 3: Settings form + /skrzynki cards

**Files:**
- Create: `app/(app)/skrzynki/mailbox-settings-form.tsx`
- Modify: `app/(app)/skrzynki/page.tsx`

- [ ] **Step 1: Create the form component** `app/(app)/skrzynki/mailbox-settings-form.tsx`:

```tsx
"use client"
// app/(app)/skrzynki/mailbox-settings-form.tsx
import {useActionState, useEffect} from "react"
import {updateEmailAccountSettings, type EmailAccountSettingsResult} from "@/features/email-accounts/actions"
import {formatTime, maskToDays} from "@/features/email-accounts/settings"
import {Field} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

const DAY_LABELS = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]

interface Account {
	id: string
	dailyLimit: number
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export function MailboxSettingsForm({account, timezones}: {account: Account; timezones: string[]}) {
	const [state, action, pending] = useActionState<EmailAccountSettingsResult | null, FormData>(updateEmailAccountSettings, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano ustawienia skrzynki") }, [state, toast])
	const days = maskToDays(account.sendDays)
	const tzOptions = timezones.includes(account.timezone) ? timezones : [account.timezone, ...timezones]

	return (
		<form className="flex flex-col gap-3 border-t border-border pt-3" action={action}>
			<input type="hidden" name="id" value={account.id} />
			<div className="flex flex-wrap gap-4">
				<Field label="Dzienny limit">
					<div className="w-28"><Input type="number" name="dailyLimit" min={1} max={1000} defaultValue={account.dailyLimit} /></div>
				</Field>
				<Field label="Okno wysyłki">
					<div className="flex items-center gap-2">
						<div className="w-28"><Input type="time" name="windowStart" defaultValue={formatTime(account.sendWindowStartMin)} /></div>
						<span className="text-fg-faint">–</span>
						<div className="w-28"><Input type="time" name="windowEnd" defaultValue={formatTime(account.sendWindowEndMin)} /></div>
					</div>
				</Field>
				<Field label="Strefa czasowa">
					<Select className="w-48" name="timezone" defaultValue={account.timezone}>
						{tzOptions.map((tz) => (
							<option key={tz} value={tz}>{tz}</option>
						))}
					</Select>
				</Field>
			</div>
			<Field label="Dni wysyłki">
				<div className="flex gap-1.5">
					{DAY_LABELS.map((label, i) => (
						<label className="cursor-pointer" key={label}>
							<input className="peer sr-only" type="checkbox" name={`day_${i}`} defaultChecked={days[i]} />
							<span className="grid h-8 w-9 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-fg-faint peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent">{label}</span>
						</label>
					))}
				</div>
			</Field>
			<Field label="Odstęp między mailami" hint="Losowy odstęp (sekundy) między kolejnymi mailami.">
				<div className="flex items-center gap-2">
					<div className="w-24"><Input type="number" name="gapMin" min={0} max={86400} defaultValue={account.minGapSec} /></div>
					<span className="text-fg-faint">–</span>
					<div className="w-24"><Input type="number" name="gapMax" min={0} max={86400} defaultValue={account.maxGapSec} /></div>
					<span className="text-xs text-fg-faint">s</span>
				</div>
			</Field>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
			<Button className="w-fit" type="submit" variant="primary" disabled={pending}>Zapisz ustawienia</Button>
		</form>
	)
}
```

- [ ] **Step 2: Rewrite `app/(app)/skrzynki/page.tsx`** to render mailbox cards with the form. Replace the whole file:

```tsx
// app/(app)/skrzynki/page.tsx
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {disconnectEmailAccount} from "@/features/email-accounts/actions"
import {TIMEZONES} from "@/features/email-accounts/settings"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {MailboxSettingsForm} from "./mailbox-settings-form"

export default async function SkrzynkiPage({searchParams}: {searchParams: Promise<{connected?: string; error?: string}>}) {
	const {orgId} = await requireOrg()
	const [accounts, sp] = await Promise.all([listEmailAccounts(orgId), searchParams])

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Skrzynki wysyłkowe</h1>
			{sp.connected ? <p className="text-sm text-success">Skrzynka połączona.</p> : null}
			{sp.error === "oauth" ? <p className="text-sm text-danger">Połączenie odrzucone lub nieprawidłowy stan.</p> : null}
			{sp.error === "exchange" ? <p className="text-sm text-danger">Nie udało się dokończyć połączenia. Spróbuj ponownie.</p> : null}
			<div>
				<a className="inline-block rounded bg-primary px-3 py-1.5 text-sm text-primary-fg" href="/api/mailbox/google/connect">
					Połącz skrzynkę Google
				</a>
			</div>
			<ul className="flex flex-col gap-3">
				{accounts.map((a) => (
					<li className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4" key={a.id}>
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-sm font-semibold">{a.email}</span>
							<span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{a.status}</span>
							{a.scope?.includes("gmail.readonly") ? (
								<span className="rounded-full bg-accent-quiet px-2 py-0.5 text-xs text-accent">odpowiedzi: on</span>
							) : (
								<span className="rounded-full bg-warning-quiet px-2 py-0.5 text-xs text-warning">odpowiedzi: off (przepnij skrzynkę)</span>
							)}
							<span className="flex-1" />
							<ConfirmButton action={disconnectEmailAccount.bind(null, a.id)} confirm={{title: "Odłączyć skrzynkę?", body: "Odłączenie usuwa też historię wiadomości tej skrzynki i wyłącza wykrywanie odpowiedzi. Tej operacji nie można cofnąć.", confirmLabel: "Odłącz", danger: true}} toast="Odłączono skrzynkę">
								Odłącz
							</ConfirmButton>
						</div>
						<MailboxSettingsForm account={a} timezones={TIMEZONES} />
					</li>
				))}
				{accounts.length === 0 ? <li className="text-sm text-fg-muted">Brak połączonych skrzynek.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 3: Typecheck + lint.** Run: `npx tsc --noEmit` (Expected: 0) and `npx eslint "app/(app)/skrzynki"` (Expected: clean).
- [ ] **Step 4: Commit.**

```bash
git add "app/(app)/skrzynki/mailbox-settings-form.tsx" "app/(app)/skrzynki/page.tsx"
git commit -m "feat(phase7): editable per-mailbox send-config form on /skrzynki"
```

---

## Task 4: Gates + roadmap + graph

- [ ] **Step 1: Full gates** (dev server OFF for the build):
  - `npx tsc --noEmit` — 0.
  - `npx vitest run` — all pass (expect ~224: prior 212 + ~12 new settings cases).
  - `npx eslint "app/(app)" features components` — clean.
  - `npm run build` — green.
- [ ] **Step 2: Update `docs/superpowers/ROADMAP.md`:** mark `deliverability-settings` DONE + verified (code/test/build); note the editable per-mailbox send config + `updateEmailAccountSettings`; note SPF/DKIM/DMARC guidance + mailbox-health were scoped OUT (config-only by user choice) and could be a later add; set the next sub-project to `dashboards`. Update the Phase 7 table row + the NEXT TASK line + the recommended-order list + the How-to-resume line.
- [ ] **Step 3:** `graphify update .` (AST-only, no API cost).
- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark deliverability-settings DONE + refresh graph"
```

---

## Self-review

**Spec coverage:** pure helpers + validation (Task 1, TDD) ✓; `updateEmailAccountSettings` action + query expansion (Task 2) ✓; per-mailbox settings form + `/skrzynki` cards (Task 3) ✓; curated timezone select with the saved-value-preserved fallback (Task 3, `tzOptions`) ✓; config-only scope — no health section / no DNS guidance ✓; gates/roadmap/graph (Task 4) ✓. No migration (spec says none).

**Placeholder scan:** every step has complete code; tests are concrete with expected values. No TBD.

**Type consistency:** `SettingsInput`/`SettingsFields` used identically in Task 1 (defs), Task 2 (action builds `SettingsInput`, writes `value: SettingsFields`), and Task 3 (`Account` matches the engine field names `sendWindowStartMin`/`sendWindowEndMin`/`sendDays`/`minGapSec`/`maxGapSec`/`timezone`). Form field names (`dailyLimit`/`windowStart`/`windowEnd`/`day_0..6`/`gapMin`/`gapMax`/`timezone`/`id`) match exactly what `updateEmailAccountSettings` reads. `EmailAccountSettingsResult` shared by action + form.

**Notes:** Task 1 lands the unit-tested core; Tasks 2-3 build on it. The form is mostly uncontrolled (defaults from the account) — only `useActionState` for pending/result + a toast. `<input type="time">` emits "HH:MM" matching `parseTime`. The `validateEmailAccountSettings` bounds prevent the worst pacing footguns (zero days, start>=end, maxGap<minGap).
