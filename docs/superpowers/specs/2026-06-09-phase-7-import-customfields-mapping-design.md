# Phase 7 — import-customfields-mapping — Design

Date: 2026-06-09. Status: spec ready (design approved — Wariant A, column->target). Sub-project #5 (build order)
of Phase 7. Objective, M-sized. Depends on `design-foundation` (tokens/primitives already in place). No DB
migration (`Lead.customFields Json?` already exists). Visual reference:
`docs/superpowers/design/import-mock/index.html` (Wariant A is the chosen left panel).

## Goal

Stop the CSV importer from silently dropping every column that is not one of the 10 known lead fields. Let the
operator route any column to `Lead.customFields` (with an editable key), and add a remove-row button to the
lead-detail customFields editor so saved custom fields can be deleted.

Two deliverables:
1. **Import custom-column mapping** — a column-centric wizard: each CSV column gets one target (ignore / a known
   field / a custom field with an editable key). Custom columns land in `Lead.customFields`.
2. **Remove-row button** on the lead-detail customFields editor (`lead-edit-form.tsx`).

## Scope

**IN:** the column->target wizard rewrite; extending the pure import logic; storing `customFields` on import;
the remove-row button.

**OUT:** changing the parser (`parseTable`/`splitRow`/`detectDelimiter` unchanged); the known-field set; the
custom-placeholder / template system; any migration; merging custom fields into EXISTING leads (import only
inserts new, dedup-filtered leads — no per-lead merge).

## Data model

No migration. `Lead.customFields` stays `Json?`, holding `Record<string, string>` (the exact shape `updateLead`
already writes, so AI/research/template consumers are unaffected).

Extend the pure import input (`features/leads/import.ts`):

```ts
export interface LeadImportInput {
	// ...existing 10 scalar fields unchanged...
	customFields: Record<string, string> | null   // NEW: null when the lead has no custom columns
}
```

`partitionLeads` already passes whole `LeadImportInput` objects through to `toInsert`, and `importLeads`
spreads them into `createMany` (`{...l, organizationId, offeringLineId}`), so `customFields` flows to the DB
with no dedupe change. (Prisma `createMany` accepts a JS object / null for a `Json?` column.)

## Pure logic (`features/leads/import.ts`) — testable, TDD against `import.test.ts`

Keep `ColumnMapping = Partial<Record<LeadFieldKey, number>>` as the known-field interface so the verified
known-field path is untouched. Add a column-centric target model + a translator + a `mapRowsToLeads` extension.

```ts
export type ColumnTarget =
	| {kind: "ignore"}
	| {kind: "field"; field: LeadFieldKey}
	| {kind: "custom"; key: string}

export interface ImportSpec {
	mapping: ColumnMapping
	customColumns: {index: number; key: string}[]
}

// Pure: column-index -> target list  ->  {known-field mapping, custom-column list}
export function buildImportSpec(targets: ColumnTarget[]): ImportSpec
```

`buildImportSpec` rules (index = position in the array = CSV column index):
- `ignore` -> contributes nothing.
- `field` -> `mapping[field] = index`. If two columns target the same known field, the **last** wins.
- `custom` -> trim the key; if non-empty, push `{index, key}`. An empty key is treated as ignore (dropped).
  Duplicate custom keys are allowed in the list; the per-row Record build makes the later column win.

Extend `mapRowsToLeads` (third arg gains an optional `customColumns`, fully back-compatible — existing tests and
the action's known-field behavior are unchanged when it is absent):

```ts
export function mapRowsToLeads(
	rows: string[][],
	mapping: ColumnMapping,
	opts: {hasHeader: boolean; customColumns?: {index: number; key: string}[]},
): LeadImportInput[]
```

Per data row, after building the 10 known fields exactly as today, build the custom bag:
```ts
const cf: Record<string, string> = {}
for (const {index, key} of opts.customColumns ?? []) {
	const v = cell(row, index)   // existing helper: trimmed value or ""
	if (v) cf[key] = v           // skip empty cells -> no empty-string custom fields
}
// on the pushed lead: customFields: Object.keys(cf).length ? cf : null
```
Every existing `mapRowsToLeads` test still passes (no `customColumns` -> `customFields` is `null`).

Optional tiny pure helper for the wizard's default key: `defaultCustomKey(header: string | null, index: number)`
= trimmed `header` if non-empty, else `kolumna_${index + 1}`. (May be inlined in the wizard instead; if added to
`import.ts`, unit-test it.)

## Wizard UI (`app/(app)/leady/import/import-wizard.tsx`) — column-centric rewrite

Keep: the textarea, the `hasHeader` checkbox, the 5-row preview table, the offering-line select, the submit
button, and the result message. Replace the per-field `FIELDS` grid with a per-column mapping grid.

- Reactively derive from the pasted text: `rows` (existing, first 5), `columnCount` (existing), and
  `headers = hasHeader ? (parseTable(text)[0] ?? []) : []`.
- Controlled state: `targets: Record<number, ColumnTarget>` keyed by column index (default `{kind: "ignore"}`).
- For each column `i` in `0..columnCount-1`, render a card: the header label (`headers[i]` or `Kolumna ${i+1}`)
  + a `<select name={\`target_${i}\`}>` whose value encodes the target:
  - `""` -> `— ignoruj —`
  - `field:<LeadFieldKey>` -> one option per known field (labels from the existing `FIELDS` list, incl.
    `Nazwa placówki *`)
  - `custom` -> `Pole własne`
  When the selection is `custom`, render `<input name={\`customkey_${i}\`}>` controlled by `targets[i].key`,
  defaulting to `defaultCustomKey(headers[i] ?? null, i)` at the moment the user switches to `custom`.
- Validation (client hint + server-enforced): at least one column must target `organizationName`.
- Styling: reuse tokens; a responsive grid of cards (works for any column count). Known target = accent, custom
  = success, ignore = faint — mirroring the mockup (visual polish to taste, not required for correctness).

## Action (`features/leads/actions.ts` `importLeads`)

Replace the `mapping_<field>` parsing with column-target parsing:
- Re-parse `rows` from `text` (as today); `columnCount = max row length`.
- For `i` in `0..columnCount-1`, read `target_${i}` (`""`|`field:<key>`|`custom`) and `customkey_${i}`; build a
  `ColumnTarget[]` (default `ignore`).
- `const {mapping, customColumns} = buildImportSpec(targets)`.
- Keep the guard: `mapping.organizationName === undefined` -> error "Zmapuj kolumnę z nazwą placówki".
- `const leads = mapRowsToLeads(rows, mapping, {hasHeader, customColumns})`.
- The rest (dedupe, suppression, `createMany`, result) is unchanged; `customFields` rides along.

## Remove-row button (`app/(app)/leady/[id]/lead-edit-form.tsx`)

Add a per-row remove control to the customFields `fieldset`: a small `text-danger` `type="button"` (e.g. `×` /
`Usuń`) that filters that row out of the `rows` state: `setRows(rows.filter((_, j) => j !== i))`. **No confirm
dialog** — this is a local, unsaved edit (the same class as the research-type-form remove-field, which
`destructive-action-safety` deliberately excluded). Removing all rows is allowed (saving then writes
`customFields = {}`); keep the existing "+ dodaj pole" and the init-to-one-empty-row behavior.

## Testing

- TDD `features/leads/import.test.ts` (extend): `buildImportSpec` (known last-wins, custom collected, ignore
  dropped, empty key dropped); `mapRowsToLeads` with `customColumns` (custom bag built, empty cells skipped,
  `null` when none); a back-compat case (no `customColumns` -> `customFields: null`). If `defaultCustomKey` is
  added to `import.ts`, test it (header trimmed, fallback `kolumna_N`).
- `tsc` 0, `eslint "app/(app)" features` clean, `next build` green, `vitest` green (+ the new cases; expect ~210+).
- Manual (optional, dev server): paste a CSV with extra columns, set two to `Pole własne`, one to ignore, import,
  open a created lead, confirm the custom fields are present and a row can be removed + saved.

## Risks / notes

- The wizard rewrite is the riskiest piece (controlled state + reactive column count). Mitigated: the pure
  `buildImportSpec` + `mapRowsToLeads` carry the logic and are unit-tested; the component is a thin form over them.
- `createMany` + `Json` custom values: standard Prisma; verified at build/test time.
- Reactive `columnCount`: only columns `0..columnCount-1` are rendered, so shrinking the paste naturally drops
  stale targets from the submitted form (unrendered inputs are not submitted).
