# import-customfields-mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the CSV importer route any column to `Lead.customFields` (column->target wizard) instead of dropping unknown columns, and add a remove-row button to the lead-detail customFields editor.

**Architecture:** Pure logic first (`buildImportSpec` + an extended `mapRowsToLeads`, TDD), then wire the `importLeads` action to column-target form fields, then rewrite the wizard UI as one target dropdown per column, then add the remove-row button. No DB migration (`Lead.customFields Json?` already exists). Spec: `docs/superpowers/specs/2026-06-09-phase-7-import-customfields-mapping-design.md`.

**Tech Stack:** Next 16 (App Router, server actions), React 19 (controlled form state), Prisma 7 (`Json?`), Vitest 4, TypeScript 6.

**Conventions:** tabs, no semicolons, `"use client"` line 1 then path comment line 2, `className` first, `import {x}` no inner spaces, NO emoji.

---

## Task 1: Pure import logic (TDD)

**Files:**
- Modify: `features/leads/import.ts`
- Test: `features/leads/import.test.ts`

- [ ] **Step 1: Write the failing tests.** Append to `features/leads/import.test.ts` and add `buildImportSpec, defaultCustomKey` to the existing top import from `@/features/leads/import`:

```ts
describe("buildImportSpec", () => {
	it("maps known fields (last column wins) and collects custom columns", () => {
		const spec = buildImportSpec([
			{kind: "field", field: "organizationName"},
			{kind: "field", field: "email"},
			{kind: "custom", key: "liczba_uczniow"},
			{kind: "ignore"},
			{kind: "field", field: "email"},
		])
		expect(spec.mapping).toEqual({organizationName: 0, email: 4})
		expect(spec.customColumns).toEqual([{index: 2, key: "liczba_uczniow"}])
	})
	it("drops custom columns with an empty/whitespace key and trims keys", () => {
		const spec = buildImportSpec([{kind: "custom", key: "  "}, {kind: "custom", key: " patron "}])
		expect(spec.customColumns).toEqual([{index: 1, key: "patron"}])
	})
})

describe("mapRowsToLeads with customColumns", () => {
	const rows = [
		["Nazwa", "Email", "Liczba", "Patron"],
		["LO Rej", "a@b.pl", "612", "M. Rej"],
		["ZSP 3", "c@d.pl", "", ""],
	]
	it("builds customFields and skips empty cells", () => {
		const leads = mapRowsToLeads(rows, {organizationName: 0, email: 1}, {
			hasHeader: true,
			customColumns: [{index: 2, key: "liczba"}, {index: 3, key: "patron"}],
		})
		expect(leads[0].customFields).toEqual({liczba: "612", patron: "M. Rej"})
		expect(leads[1].customFields).toBeNull()
	})
	it("sets customFields null when no customColumns", () => {
		const leads = mapRowsToLeads(rows, {organizationName: 0}, {hasHeader: true})
		expect(leads[0].customFields).toBeNull()
	})
})

describe("defaultCustomKey", () => {
	it("uses the trimmed header, else kolumna_N", () => {
		expect(defaultCustomKey("  Liczba uczniów ", 3)).toBe("Liczba uczniów")
		expect(defaultCustomKey(null, 3)).toBe("kolumna_4")
		expect(defaultCustomKey("", 0)).toBe("kolumna_1")
	})
})
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run features/leads/import.test.ts` — Expected: FAIL (`buildImportSpec`/`defaultCustomKey` not exported; `customFields` undefined).

- [ ] **Step 3: Implement in `features/leads/import.ts`.** (a) Add `customFields` to `LeadImportInput`:

```ts
export interface LeadImportInput {
	organizationName: string
	website: string | null
	contactPersonName: string | null
	contactRole: string | null
	email: string | null
	phone: string | null
	city: string | null
	region: string | null
	schoolType: string | null
	honorific: Honorific | null
	customFields: Record<string, string> | null
}
```

(b) After the `ColumnMapping` type, add:

```ts
export type ColumnTarget =
	| {kind: "ignore"}
	| {kind: "field"; field: LeadFieldKey}
	| {kind: "custom"; key: string}

export interface ImportSpec {
	mapping: ColumnMapping
	customColumns: {index: number; key: string}[]
}

export function buildImportSpec(targets: ColumnTarget[]): ImportSpec {
	const mapping: ColumnMapping = {}
	const customColumns: {index: number; key: string}[] = []
	targets.forEach((target, index) => {
		if (target.kind === "field") {
			mapping[target.field] = index
		} else if (target.kind === "custom") {
			const key = target.key.trim()
			if (key) customColumns.push({index, key})
		}
	})
	return {mapping, customColumns}
}

export function defaultCustomKey(header: string | null, index: number): string {
	const h = header?.trim()
	return h ? h : `kolumna_${index + 1}`
}
```

(c) Replace the `mapRowsToLeads` function with the extended version:

```ts
export function mapRowsToLeads(
	rows: string[][],
	mapping: ColumnMapping,
	opts: {hasHeader: boolean; customColumns?: {index: number; key: string}[]},
): LeadImportInput[] {
	const dataRows = opts.hasHeader ? rows.slice(1) : rows
	const customColumns = opts.customColumns ?? []
	const leads: LeadImportInput[] = []
	for (const row of dataRows) {
		const organizationName = cell(row, mapping.organizationName)
		if (!organizationName) continue
		const cf: Record<string, string> = {}
		for (const {index, key} of customColumns) {
			const v = cell(row, index)
			if (v) cf[key] = v
		}
		leads.push({
			organizationName,
			website: normalizeWebsite(cell(row, mapping.website)),
			contactPersonName: cell(row, mapping.contactPersonName) || null,
			contactRole: cell(row, mapping.contactRole) || null,
			email: normalizeEmail(cell(row, mapping.email)),
			phone: cell(row, mapping.phone) || null,
			city: cell(row, mapping.city) || null,
			region: cell(row, mapping.region) || null,
			schoolType: cell(row, mapping.schoolType) || null,
			honorific: parseHonorific(cell(row, mapping.honorific)),
			customFields: Object.keys(cf).length ? cf : null,
		})
	}
	return leads
}
```

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx vitest run features/leads/import.test.ts` — Expected: PASS (all old + new cases). Then `npx tsc --noEmit` — Expected: 0 (note: `actions.ts` / `import-wizard.tsx` may now error on the changed `mapRowsToLeads` signature — that is expected and fixed in Tasks 2-3; if so, proceed).

- [ ] **Step 5: Commit.**

```bash
git add features/leads/import.ts features/leads/import.test.ts
git commit -m "feat(phase7): buildImportSpec + customFields in mapRowsToLeads (TDD)"
```

---

## Task 2: Wire `importLeads` to column targets

**Files:**
- Modify: `features/leads/actions.ts`

- [ ] **Step 1: Update the import statement** (line ~8) from `@/features/leads/import` to:

```ts
import {parseTable, mapRowsToLeads, buildImportSpec, type ColumnTarget, type LeadFieldKey} from "@/features/leads/import"
```

- [ ] **Step 2: Replace the mapping block** inside `importLeads` (the `const fields = [...] as const` loop through `const leads = mapRowsToLeads(rows, mapping, {hasHeader})`) with:

```ts
	const rows = parseTable(text)
	const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0)
	const targets: ColumnTarget[] = []
	for (let i = 0; i < columnCount; i++) {
		const raw = String(formData.get(`target_${i}`) ?? "")
		if (raw === "custom") {
			targets.push({kind: "custom", key: String(formData.get(`customkey_${i}`) ?? "")})
		} else if (raw.startsWith("field:")) {
			targets.push({kind: "field", field: raw.slice(6) as LeadFieldKey})
		} else {
			targets.push({kind: "ignore"})
		}
	}
	const {mapping, customColumns} = buildImportSpec(targets)
	if (mapping.organizationName === undefined) {
		return {ok: false, error: "Zmapuj kolumnę z nazwą placówki"}
	}

	const leads = mapRowsToLeads(rows, mapping, {hasHeader, customColumns})
	if (leads.length === 0) return {ok: false, error: "Brak wierszy z nazwą placówki"}
```

(The `createMany` block below is unchanged — `customFields` rides along via `{...l, organizationId, offeringLineId}`.)

- [ ] **Step 3: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0 (the wizard still references the old API until Task 3; if a wizard error remains, it is fixed in Task 3 — proceed).

- [ ] **Step 4: Commit.**

```bash
git add features/leads/actions.ts
git commit -m "feat(phase7): importLeads parses per-column targets (customFields)"
```

---

## Task 3: Column->target wizard

**Files:**
- Modify: `app/(app)/leady/import/import-wizard.tsx`

- [ ] **Step 1: Replace the whole file** with:

```tsx
"use client"
// app/(app)/leady/import/import-wizard.tsx

import {useMemo, useState, useActionState} from "react"
import {parseTable, defaultCustomKey, type LeadFieldKey} from "@/features/leads/import"
import {importLeads, type ImportResult} from "@/features/leads/actions"

const FIELDS: {key: LeadFieldKey; label: string}[] = [
	{key: "organizationName", label: "Nazwa placówki *"},
	{key: "email", label: "Email"},
	{key: "website", label: "WWW"},
	{key: "contactPersonName", label: "Osoba"},
	{key: "contactRole", label: "Rola"},
	{key: "phone", label: "Telefon"},
	{key: "city", label: "Miasto"},
	{key: "region", label: "Region"},
	{key: "schoolType", label: "Typ szkoły"},
	{key: "honorific", label: "Zwrot (Pan/Pani)"},
]

type Target = {kind: "ignore"} | {kind: "field"; field: LeadFieldKey} | {kind: "custom"; key: string}

export function ImportWizard({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [text, setText] = useState("")
	const [hasHeader, setHasHeader] = useState(true)
	const [targets, setTargets] = useState<Record<number, Target>>({})
	const [state, action, pending] = useActionState<ImportResult | null, FormData>(importLeads, null)

	const allRows = useMemo(() => (text.trim() ? parseTable(text) : []), [text])
	const previewRows = allRows.slice(0, 5)
	const columnCount = allRows.reduce((max, r) => Math.max(max, r.length), 0)
	const headers = hasHeader ? allRows[0] ?? [] : []

	const targetOf = (i: number): Target => targets[i] ?? {kind: "ignore"}
	const selValue = (t: Target) => (t.kind === "field" ? `field:${t.field}` : t.kind === "custom" ? "custom" : "")
	function onSelect(i: number, value: string) {
		if (value === "custom") setTargets({...targets, [i]: {kind: "custom", key: defaultCustomKey(headers[i] ?? null, i)}})
		else if (value.startsWith("field:")) setTargets({...targets, [i]: {kind: "field", field: value.slice(6) as LeadFieldKey}})
		else setTargets({...targets, [i]: {kind: "ignore"}})
	}

	return (
		<form className="flex flex-col gap-4" action={action}>
			<textarea
				className="h-40 rounded border border-border p-2 font-mono text-xs"
				name="text"
				placeholder="Wklej CSV/TSV (np. z arkusza). Pierwszy wiersz = nagłówki."
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<label className="flex items-center gap-2 text-sm">
				<input name="hasHeader" type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
				Pierwszy wiersz to nagłówki
			</label>

			{previewRows.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="border-collapse text-xs">
						<tbody>
							{previewRows.map((r, ri) => (
								<tr key={ri} className="border-b border-border">
									{r.map((c, ci) => (
										<td className="border border-border px-2 py-1" key={ci}>
											{c}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			{columnCount > 0 ? (
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
					{Array.from({length: columnCount}, (_, i) => {
						const t = targetOf(i)
						return (
							<div className="flex flex-col gap-1 text-xs" key={i}>
								<span className="truncate text-fg-muted">{headers[i]?.trim() || `Kolumna ${i + 1}`}</span>
								<select className="rounded border border-border px-1 py-1" name={`target_${i}`} value={selValue(t)} onChange={(e) => onSelect(i, e.target.value)}>
									<option value="">— ignoruj —</option>
									{FIELDS.map((f) => (
										<option key={f.key} value={`field:${f.key}`}>
											{f.label}
										</option>
									))}
									<option value="custom">Pole własne</option>
								</select>
								{t.kind === "custom" ? (
									<input
										className="rounded border border-dashed border-border px-1 py-1"
										name={`customkey_${i}`}
										placeholder="klucz pola"
										value={t.key}
										onChange={(e) => setTargets({...targets, [i]: {kind: "custom", key: e.target.value}})}
									/>
								) : null}
							</div>
						)
					})}
				</div>
			) : null}

			<p className="text-xs text-fg-muted">
				Wskazówka: zmapuj kolumnę Email - bez niej leady wejdą bez adresu i nie wezmą udziału w dedupe ani wysyłce. Kolumny ustawione na „Pole własne" trafią do pól własnych leada.
			</p>

			<label className="flex flex-col text-sm">
				Przypisz do linii usługi
				<select className="w-64 rounded border border-border px-2 py-1" name="offeringLineId" defaultValue="">
					<option value="">— brak —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
			</label>

			<button className="w-40 rounded bg-primary px-3 py-2 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				{pending ? "Importuję..." : "Importuj"}
			</button>

			{state ? (
				state.ok ? (
					<p className="text-sm text-success">
						Dodano {state.created}, pominięto duplikaty: {state.duplicateCount}, na suppression: {state.suppressedCount}.
						{state.withoutEmail > 0 ? ` Uwaga: ${state.withoutEmail} bez emaila.` : ""}
					</p>
				) : (
					<p className="text-sm text-danger">{state.error}</p>
				)
			) : null}
		</form>
	)
}
```

- [ ] **Step 2: Typecheck + lint.** Run: `npx tsc --noEmit` (Expected: 0) and `npx eslint "app/(app)/leady/import/import-wizard.tsx"` (Expected: clean).

- [ ] **Step 3: Commit.**

```bash
git add "app/(app)/leady/import/import-wizard.tsx"
git commit -m "feat(phase7): column->target import wizard (custom-field columns)"
```

---

## Task 4: Remove-row button on the customFields editor

**Files:**
- Modify: `app/(app)/leady/[id]/lead-edit-form.tsx`

- [ ] **Step 1: Add a remove button to each customFields row.** In the `rows.map((row, i) => ...)` block, after the `cf_value` input (still inside the `<div className="flex gap-2" key={i}>`), add:

```tsx
						<button
							className="shrink-0 px-1 text-sm text-danger"
							type="button"
							aria-label="Usuń pole"
							onClick={() => setRows(rows.filter((_, j) => j !== i))}
						>
							×
						</button>
```

(No confirm dialog — local unsaved edit. The existing "+ dodaj pole" button and the init-to-one-empty-row behavior stay. Removing all rows is allowed; `updateLead` then writes `customFields = {}`.)

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0.
- [ ] **Step 3: Commit.**

```bash
git add "app/(app)/leady/[id]/lead-edit-form.tsx"
git commit -m "feat(phase7): remove-row button on lead customFields editor"
```

---

## Task 5: Gates + roadmap + graph

- [ ] **Step 1: Full gates** (dev server OFF for the build):
  - `npx tsc --noEmit` — 0.
  - `npx vitest run` — all pass (expect ~210: prior 207 + ~3 new import cases).
  - `npx eslint "app/(app)" features components` — clean.
  - `npm run build` — green.
- [ ] **Step 2: Update `docs/superpowers/ROADMAP.md`:** mark `import-customfields-mapping` DONE + verified (code/test/build); note the column->target wizard sends arbitrary columns to `Lead.customFields` + the remove-row button; set the next sub-project to `deliverability-settings`. Update the Phase 7 table row + the NEXT TASK line + the recommended-order list + the How-to-resume line.
- [ ] **Step 3:** `graphify update .` (AST-only, no API cost).
- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark import-customfields-mapping DONE + refresh graph"
```

---

## Self-review

**Spec coverage:** `buildImportSpec` + `defaultCustomKey` + `customFields` on `LeadImportInput` + extended `mapRowsToLeads` (Task 1, TDD) covers the pure-logic section ✓; `importLeads` column-target parsing (Task 2) covers the action section ✓; column->target wizard (Task 3) covers the UI section ✓; remove-row button (Task 4) covers deliverable 2 ✓; gates/roadmap/graph (Task 5) ✓. No migration (spec says none).

**Placeholder scan:** every step shows complete code; test code is concrete with expected results. No TBD.

**Type consistency:** `ColumnTarget` shape (`ignore`/`field`+`field`/`custom`+`key`) is identical in `import.ts`, the action (`field: raw.slice(6) as LeadFieldKey`), and the wizard (`Target` alias). `buildImportSpec` returns `{mapping: ColumnMapping; customColumns: {index, key}[]}` consumed verbatim by `mapRowsToLeads(rows, mapping, {hasHeader, customColumns})`. `defaultCustomKey(header, index)` signature matches its wizard call. `LeadImportInput.customFields` flows through `partitionLeads` -> `createMany` unchanged.

**Notes:** Task 1 must land first (Tasks 2-3 depend on the new signature; tsc is briefly red between Task 1 and Task 3 — called out in each step). Tasks 2-4 touch disjoint files. The wizard rewrite is the only non-trivial piece; the logic lives in the unit-tested pure layer.
