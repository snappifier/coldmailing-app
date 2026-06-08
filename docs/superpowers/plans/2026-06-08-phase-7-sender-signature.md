# Per-org sender signature ({{podpisNadawcy}}) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each org one editable sender signature that feeds `{{podpisNadawcy}}` from a single source in both the template preview and the live send, falling back to the mailbox display name (flagged) when unset.

**Architecture:** Add `Organization.senderSignature` (additive migration). A new pure `resolveSenderName({signature, fallback})` becomes the only place `senderName` is computed; both the send worker and the editor page call it. The editor and settings surface a flag when the signature is empty. `render.ts` is untouched (`{{podpisNadawcy}}` already reads `ctx.senderName`).

**Tech Stack:** Next 16, Prisma 7.8, Zod-free (plain FormData), Vitest 4, TypeScript 6, Tailwind v4 (existing raw style — this is not the visual pass).

---

## File structure

- `prisma/schema.prisma` — `Organization.senderSignature` (migration `phase7_sender_signature`).
- `features/templates/sender.ts` (new, pure) + `features/templates/sender.test.ts` — `resolveSenderName`, `sanitizeSignature`.
- `features/templates/render.test.ts` — add `{{podpisNadawcy}}` characterization cases (no `render.ts` change).
- `lib/inngest/sending.ts` — load org signature once; feed `senderName` via `resolveSenderName`.
- `lib/inngest/sending.test.ts` — add an `organization.findUnique` stub so the new read doesn't break existing cases.
- `features/org/settings.ts` — `getOrgSettings` returns `senderSignature`; new `setSenderSignature` action.
- `app/(app)/ustawienia/sender-signature-form.tsx` (new client) + `app/(app)/ustawienia/page.tsx` — settings UI.
- `app/(app)/szablony/page.tsx` + `app/(app)/szablony/template-editor.tsx` — preview source + flag note.

---

## Task 1: Migration — `Organization.senderSignature`

**Files:**
- Modify: `prisma/schema.prisma:111-118` (model `Organization`)
- Create: `prisma/migrations/<ts>_phase7_sender_signature/migration.sql` (generated)

- [ ] **Step 1: Add the field to the schema**

In `model Organization`, add `senderSignature` after the opt-out fields:

```prisma
	optOutMode     OptOutMode     @default(OFF)
	optOutDetector OptOutDetector @default(KEYWORD)
	senderSignature String        @default("")
```

- [ ] **Step 2: Create the migration WITHOUT applying or seeding (protects Neon data)**

Run: `npx prisma migrate dev --name phase7_sender_signature --create-only`
Expected: a new `prisma/migrations/<ts>_phase7_sender_signature/migration.sql` is created; the DB is NOT touched.

- [ ] **Step 3: Verify the generated SQL is a single additive column**

Read `prisma/migrations/<ts>_phase7_sender_signature/migration.sql`.
Expected exactly (modulo formatting):

```sql
ALTER TABLE "Organization" ADD COLUMN "senderSignature" TEXT NOT NULL DEFAULT '';
```

If it contains anything destructive, STOP and investigate.

- [ ] **Step 4: Apply the migration + regenerate the client**

Run: `npx prisma migrate deploy`
Expected: `1 migration applied` (`phase7_sender_signature`).
Run: `npx prisma generate`
Expected: client regenerated with `senderSignature` on `Organization`.

- [ ] **Step 5: Typecheck (no code uses the field yet)**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase7): add Organization.senderSignature (migration phase7_sender_signature)"
```

---

## Task 2: Pure sender-name resolution (`sender.ts`)

**Files:**
- Create: `features/templates/sender.ts`
- Test: `features/templates/sender.test.ts`

- [ ] **Step 1: Write the failing test**

Create `features/templates/sender.test.ts`:

```typescript
// features/templates/sender.test.ts
import {describe, it, expect} from "vitest"
import {resolveSenderName, sanitizeSignature, MAX_SIGNATURE_LEN} from "@/features/templates/sender"

describe("resolveSenderName", () => {
	it("uses the signature (trimmed) when set", () => {
		expect(resolveSenderName({signature: "  Pozdrawiam,\nJan  ", fallback: "Mailbox"})).toBe("Pozdrawiam,\nJan")
	})

	it("falls back to the mailbox name (trimmed) when the signature is empty", () => {
		expect(resolveSenderName({signature: "", fallback: "  Acme Mailbox  "})).toBe("Acme Mailbox")
	})

	it("falls back when the signature is whitespace-only", () => {
		expect(resolveSenderName({signature: "   \n  ", fallback: "Acme Mailbox"})).toBe("Acme Mailbox")
	})

	it("returns empty string when both are empty/null", () => {
		expect(resolveSenderName({signature: "", fallback: ""})).toBe("")
		expect(resolveSenderName({signature: null, fallback: null})).toBe("")
	})
})

describe("sanitizeSignature", () => {
	it("trims", () => {
		expect(sanitizeSignature("  hi  ")).toBe("hi")
	})

	it("caps length at MAX_SIGNATURE_LEN", () => {
		const long = "x".repeat(MAX_SIGNATURE_LEN + 50)
		expect(sanitizeSignature(long).length).toBe(MAX_SIGNATURE_LEN)
	})
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run features/templates/sender.test.ts`
Expected: FAIL — cannot resolve `@/features/templates/sender`.

- [ ] **Step 3: Write the minimal implementation**

Create `features/templates/sender.ts`:

```typescript
// features/templates/sender.ts

export const MAX_SIGNATURE_LEN = 2000

// Single source of truth for the {{podpisNadawcy}} value: the org signature if set,
// otherwise the sending mailbox name, otherwise empty (renders as [brak: podpisNadawcy]).
export function resolveSenderName(opts: {signature: string | null; fallback: string | null}): string {
	return (opts.signature ?? "").trim() || (opts.fallback ?? "").trim() || ""
}

export function sanitizeSignature(input: string): string {
	return input.trim().slice(0, MAX_SIGNATURE_LEN)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run features/templates/sender.test.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Commit**

```bash
git add features/templates/sender.ts features/templates/sender.test.ts
git commit -m "feat(phase7): resolveSenderName + sanitizeSignature (single source for {{podpisNadawcy}})"
```

---

## Task 3: Characterization tests for `{{podpisNadawcy}}`

`render.ts` already resolves `{{podpisNadawcy}}` from `ctx.senderName`; these tests lock that behavior (no production change). They PASS on first run.

**Files:**
- Test: `features/templates/render.test.ts`

- [ ] **Step 1: Add the test cases**

In `features/templates/render.test.ts`, add inside the `describe("renderTemplate", ...)` block (the `ctx()` helper already sets `senderName: "Krystian"`):

```typescript
	it("resolves {{podpisNadawcy}} from senderName", () => {
		expect(renderTemplate("{{podpisNadawcy}}", ctx()).rendered).toBe("Krystian")
		expect(renderTemplate("{{podpisNadawcy}}", ctx({senderName: "Pozdrawiam,\nZespół Acme"})).rendered).toBe("Pozdrawiam,\nZespół Acme")
	})

	it("flags {{podpisNadawcy}} as missing when senderName is empty", () => {
		const r = renderTemplate("{{podpisNadawcy}}", ctx({senderName: ""}))
		expect(r.rendered).toBe("[brak: podpisNadawcy]")
		expect(r.missing).toEqual(["podpisNadawcy"])
	})
```

- [ ] **Step 2: Run the tests (expect PASS — existing behavior)**

Run: `npx vitest run features/templates/render.test.ts`
Expected: PASS (existing cases + the 2 new ones).

- [ ] **Step 3: Commit**

```bash
git add features/templates/render.test.ts
git commit -m "test(phase7): characterize {{podpisNadawcy}} resolution + empty -> [brak]"
```

---

## Task 4: Send path uses the org signature

**Files:**
- Modify: `lib/inngest/sending.ts` (imports ~8; placeholder load ~45-48; render ctx ~111)
- Test: `lib/inngest/sending.test.ts` (prisma mock)

- [ ] **Step 1: Add the `organization` stub to the prisma mock so the new read is safe**

In `lib/inngest/sending.test.ts`, inside the `vi.mock("@/lib/prisma", ...)` prisma object, add an `organization` model next to `suppression`/`leadDraft`:

```typescript
		suppression: {findUnique: vi.fn(async () => null)},
		leadDraft: {findUnique: vi.fn(async () => h.draft)},
		organization: {findUnique: vi.fn(async () => ({senderSignature: ""}))},
```

- [ ] **Step 2: Run the sending suite to confirm it's green BEFORE the worker change**

Run: `npx vitest run lib/inngest/sending.test.ts`
Expected: PASS (13 cases) — the stub is inert until the worker reads it.

- [ ] **Step 3: Import `resolveSenderName` in the worker**

In `lib/inngest/sending.ts`, after the `resolveDraftDecision` import (line ~9):

```typescript
import {resolveSenderName} from "@/features/templates/sender"
```

- [ ] **Step 4: Load the org signature once (next to the placeholder load)**

In `lib/inngest/sending.ts`, just after the `placeholders` query (currently lines 45-48), add:

```typescript
	const org = await prisma.organization.findUnique({
		where: {id: base.campaign.organizationId},
		select: {senderSignature: true},
	})
	const senderSignature = org?.senderSignature ?? ""
```

- [ ] **Step 5: Feed `senderName` from `resolveSenderName`**

In `lib/inngest/sending.ts`, in the render context (currently `const ctx = {lead: renderLead, senderName: account.displayName ?? "", placeholders}`), replace the `senderName` source:

```typescript
				const ctx = {lead: renderLead, senderName: resolveSenderName({signature: senderSignature, fallback: account.displayName ?? ""}), placeholders}
```

(`account` is loaded per-iteration; `senderSignature` is loaded once above. The draft branch bypasses `renderTemplate`, so it's unaffected.)

- [ ] **Step 6: Run the sending suite + typecheck**

Run: `npx vitest run lib/inngest/sending.test.ts`
Expected: PASS (13 cases — `renderTemplate` is mocked to identity, so the senderName source change is inert here; the behavior is covered by `sender.test.ts`).
Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add lib/inngest/sending.ts lib/inngest/sending.test.ts
git commit -m "feat(phase7): send path resolves {{podpisNadawcy}} from org signature (mailbox-name fallback)"
```

---

## Task 5: Settings — edit the signature

**Files:**
- Modify: `features/org/settings.ts` (`getOrgSettings` ~12-16; add `setSenderSignature`)
- Create: `app/(app)/ustawienia/sender-signature-form.tsx`
- Modify: `app/(app)/ustawienia/page.tsx`

- [ ] **Step 1: Return `senderSignature` from `getOrgSettings` + add the save action**

In `features/org/settings.ts`, add the import and change `getOrgSettings`, then append `setSenderSignature`:

```typescript
import {sanitizeSignature} from "@/features/templates/sender"
```

```typescript
export async function getOrgSettings() {
	const {orgId} = await requireOrg()
	const org = await prisma.organization.findUnique({where: {id: orgId}, select: {optOutMode: true, optOutDetector: true, senderSignature: true}})
	return {optOutMode: org?.optOutMode ?? "OFF", optOutDetector: org?.optOutDetector ?? "KEYWORD", senderSignature: org?.senderSignature ?? ""}
}
```

```typescript
export async function setSenderSignature(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireOrg()
	const senderSignature = sanitizeSignature(String(formData.get("senderSignature") ?? ""))
	await prisma.organization.update({where: {id: orgId}, data: {senderSignature}})
	revalidatePath("/ustawienia")
	return {ok: true}
}
```

- [ ] **Step 2: Create the settings form (client)**

Create `app/(app)/ustawienia/sender-signature-form.tsx`:

```tsx
"use client"
// app/(app)/ustawienia/sender-signature-form.tsx

import {useActionState, useState} from "react"
import {setSenderSignature} from "@/features/org/settings"

interface Props {
	signature: string
}

export function SenderSignatureForm({signature}: Props) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setSenderSignature, null)
	const [value, setValue] = useState(signature)
	const empty = value.trim() === ""
	return (
		<form className="flex flex-col gap-2 text-sm" action={action}>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Podpis nadawcy (token {"{{podpisNadawcy}}"})</span>
				<textarea
					className="h-28 w-full max-w-lg rounded border border-zinc-300 p-2"
					name="senderSignature"
					placeholder="Pozdrawiam,&#10;Jan Kowalski&#10;Acme Sp. z o.o."
					value={value}
					onChange={(e) => setValue(e.target.value)}
				/>
			</label>
			{empty ? <span className="text-xs text-amber-700">Nieustawiony — przy wysyłce zostanie użyta nazwa skrzynki.</span> : null}
			<button className="w-32 rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state?.ok === true ? <span className="text-green-700">Zapisano.</span> : null}
			{state?.ok === false ? <span className="text-red-700">Nie udało się zapisać.</span> : null}
		</form>
	)
}
```

- [ ] **Step 3: Render the form on the settings page**

In `app/(app)/ustawienia/page.tsx`, import and render `SenderSignatureForm` below the existing `SettingsForm`:

```tsx
// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsForm} from "./settings-form"
import {SenderSignatureForm} from "./sender-signature-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	return (
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Ustawienia</h1>
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Wykrywanie rezygnacji</h2>
				<SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />
			</div>
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Podpis nadawcy</h2>
				<SenderSignatureForm signature={s.senderSignature} />
			</div>
		</section>
	)
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add features/org/settings.ts "app/(app)/ustawienia/sender-signature-form.tsx" "app/(app)/ustawienia/page.tsx"
git commit -m "feat(phase7): /ustawienia sender-signature editor + setSenderSignature action"
```

---

## Task 6: Editor preview uses the org signature + flag

**Files:**
- Modify: `app/(app)/szablony/page.tsx`
- Modify: `app/(app)/szablony/template-editor.tsx`

- [ ] **Step 1: Feed the preview `senderName` from the org signature + mailbox fallback**

In `app/(app)/szablony/page.tsx`: remove the `auth` import and the `session` line (only used for `senderName`), add `resolveSenderName`, fetch the org signature + first connected mailbox, and pass the flag props.

Replace the imports block top section — delete `import {auth} from "@/lib/auth"` and add:

```tsx
import {resolveSenderName} from "@/features/templates/sender"
```

Replace the function body up to the `Promise.all` so `session` is gone and two queries are added:

```tsx
export default async function TemplatesPage() {
	const {orgId} = await requireOrg()

	const [templates, offeringLines, placeholders, lead, org, mailbox] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}, include: {offeringLine: {select: {name: true}}, _count: {select: {sequenceSteps: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}}),
		prisma.lead.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}, take: 1}),
		prisma.organization.findUnique({where: {id: orgId}, select: {senderSignature: true}}),
		prisma.emailAccount.findFirst({where: {organizationId: orgId, status: "CONNECTED"}, orderBy: {createdAt: "asc"}, select: {displayName: true}}),
	])

	const senderSignature = org?.senderSignature ?? ""
	const previewMailboxName = mailbox?.displayName ?? null
	const senderName = resolveSenderName({signature: senderSignature, fallback: previewMailboxName})
```

Then change the `<TemplateEditor .../>` props (replace the `senderName={...}` line and add two props):

```tsx
			<TemplateEditor
				offeringLines={offeringLines}
				customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
				customKeys={placeholders.map((p) => p.key)}
				sampleLead={sampleLead}
				senderName={senderName}
				signatureSet={senderSignature.trim() !== ""}
				previewMailboxName={previewMailboxName}
			/>
```

- [ ] **Step 2: Add the flag props + note to the editor**

In `app/(app)/szablony/template-editor.tsx`, extend `Props` and the destructure, and render the note in the preview column.

Change the interface:

```tsx
interface Props {
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
	signatureSet: boolean
	previewMailboxName: string | null
}
```

Change the destructure:

```tsx
export function TemplateEditor({offeringLines, customPlaceholders, customKeys, sampleLead, senderName, signatureSet, previewMailboxName}: Props) {
```

In the preview column, add the note right after the `<h2>Podgląd ...</h2>` line:

```tsx
				<h2 className="text-sm font-semibold text-zinc-700">Podgląd {sampleLead ? `(${sampleLead.organizationName})` : "(brak leadów)"}</h2>
				{!signatureSet ? (
					<p className="text-xs text-amber-700">
						Podpis nadawcy nieustawiony w Ustawieniach — podgląd i wysyłka użyją nazwy skrzynki ({previewMailboxName ?? "—"}). Ustaw podpis, aby był spójny.
					</p>
				) : null}
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit`
Expected: 0 errors.
Run: `npx vitest run`
Expected: PASS (190 prior + 8 new: sender 6, render 2 = 198).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/szablony/page.tsx" "app/(app)/szablony/template-editor.tsx"
git commit -m "feat(phase7): template preview resolves {{podpisNadawcy}} from org signature + unset flag"
```

---

## Task 7: Final gates + roadmap

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: PASS, 198 tests (190 + 8 new).

- [ ] **Step 3: Lint the changed production files**

Run: `npx eslint features/templates/sender.ts lib/inngest/sending.ts features/org/settings.ts "app/(app)/ustawienia/sender-signature-form.tsx" "app/(app)/ustawienia/page.tsx" "app/(app)/szablony/page.tsx" "app/(app)/szablony/template-editor.tsx"`
Expected: clean (exit 0).

- [ ] **Step 4: Production build (dev server OFF)**

Run: `npm run build`
Expected: green; `/ustawienia` and `/szablony` in the route list.

- [ ] **Step 5: Update the roadmap**

In `docs/superpowers/ROADMAP.md`: under Phase 7, mark `sender-signature` DONE + verified (code/test/build), note it fixes the verified preview-vs-send `{{podpisNadawcy}}` divergence, uses `Organization.senderSignature` with a flagged mailbox-name fallback, and update the test count (198). Keep `design-foundation` (user wants to steer the look) as the next Phase 7 item.

- [ ] **Step 6: Refresh the knowledge graph (AST-only)**

Run: `graphify update .`
Expected: graph updated, no API cost.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark sender-signature DONE (code/test/build) + refresh graph"
```

---

## Self-review

**Spec coverage:**
- `Organization.senderSignature` migration -> Task 1. ✓
- Pure `resolveSenderName` + `sanitizeSignature` single source -> Task 2. ✓
- `render.ts` unchanged; `{{podpisNadawcy}}` characterized -> Task 3. ✓
- Send path feeds `senderName` from org signature + `account.displayName` fallback -> Task 4. ✓
- Settings: `getOrgSettings += senderSignature`, `setSenderSignature`, form on `/ustawienia`, empty flag -> Task 5. ✓
- Preview: org-signature source + first-connected-mailbox fallback + editor flag note; drop `auth()` -> Task 6. ✓
- Empty-signature fallback = mailbox name, flagged in settings + editor -> Tasks 4/5/6. ✓
- Tests: `sender.test.ts`, `render.test.ts`, sending-mock stub, full suite -> Tasks 2/3/4/6. ✓
- Gates tsc/vitest/lint/build + roadmap + graph -> Task 7. ✓

**Placeholder scan:** no TBD/TODO; every code step shows exact code. ✓

**Type consistency:** `resolveSenderName({signature, fallback})` and `sanitizeSignature(input)` defined in Task 2 and called identically in Tasks 4/5/6. `signatureSet: boolean` + `previewMailboxName: string | null` defined (Task 6 Step 2) match the props passed (Task 6 Step 1). `getOrgSettings` returns `senderSignature` (Task 5) consumed by the page (Task 5 Step 3). ✓

**Notes / risks (from spec):**
- Behavior change: until the signature is set, preview shows the connected mailbox name (flagged) and send uses the mailbox name (unchanged from today). After it's set once, preview == send.
- Multiple mailboxes + unset signature: preview uses the first connected mailbox; the flag states the caveat.
- No live run needed (pure code/data + UI); verified by tsc/vitest/build.
- The `sending.test.ts` integration test mocks `renderTemplate`, so the senderName source change is inert there — the behavior is guaranteed by `sender.test.ts` + tsc; the mock stub only prevents the new org read from throwing.
