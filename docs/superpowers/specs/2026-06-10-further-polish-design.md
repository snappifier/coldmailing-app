# Further polish — skrzynki, CSV import wizard, lead detail layout — Design

Date: 2026-06-10. Status: approved (user picked all three areas; importer 3-step direction approved via mock;
lead-detail layout = variant B picked in the mock). Post-phase polish. Size M.
Mock: `.superpowers/brainstorm/4437-1781084584/content/import-and-lead.html`. Builds on `creation-ux`
(Modal/PageHeader primitives, the wizard pattern + its BINDING animation constants) and `features/enums/labels.ts`.

## 1. Skrzynki — quick close (no mock; pattern fully determined)

- `features/enums/labels.ts` += `EMAIL_ACCOUNT_STATUS_LABEL: Record<EmailAccountStatus, string>`
  (CONNECTED "Połączona", ERROR "Błąd", DISCONNECTED "Odłączona") and `EMAIL_ACCOUNT_STATUS_VARIANT`
  (ok / bad / neutral). `labels.test.ts` gains the two totality assertions (mirror the existing pattern).
- `app/(app)/skrzynki/page.tsx`: `PageHeader` (title "Skrzynki wysyłkowe", description "Połączone konta Gmail z
  limitami i oknami wysyłki.", meta `` `${accounts.length} skrzynek · ${connected} połączonych` ``) replacing the
  `h1`; the raw `<a class="...bg-primary...">Połącz skrzynkę Google</a>` becomes the header `action` styled as the
  primary Button (keep it an `<a href="/api/mailbox/google/connect">` — full-page navigation is required for
  OAuth; apply the Button classes to the anchor, like the repo does for link-buttons). The raw `{a.status}` pill
  -> `<Badge variant={EMAIL_ACCOUNT_STATUS_VARIANT[a.status]}>{EMAIL_ACCOUNT_STATUS_LABEL[a.status]}</Badge>`.
  Empty list -> `EmptyState` with the same connect anchor as action. This COMPLETES the spawned chip
  `task_7380c42d` (dismiss it afterwards).

## 2. CSV importer as a 3-step wizard (stays a PAGE — bulk paste needs space)

Rewrite `app/(app)/leady/import/import-wizard.tsx` in the creation-ux wizard language; `import/page.tsx` gets
`PageHeader` (title "Import leadów", description "Wklej dane z arkusza, zmapuj kolumny i zaimportuj.", action =
the back link "← Leady").

- **Steps:** 1 Wklej dane -> 2 Mapuj kolumny -> 3 Wynik. Progress = variant B ("Krok X z 3 · <label>" + the 2 px
  accent bar, same spring `visualDuration .25, bounce 0`); step transitions use the SAME imperative `animate()`
  slide (x ±12, 200 ms ease-out-quart, reduced-motion skip) as the lead wizard — no AnimatePresence/key inside
  the form.
- **FORM CONTRACT (binding):** ONE `<form action={importLeads}>`; ALL steps stay mounted (`hidden`), so the
  existing fields keep submitting unchanged: `text`, `hasHeader`, `target_<i>`, `customkey_<i>`,
  `offeringLineId`. The structural-re-paste mapping reset (column-count change -> `setTargets({})`) is preserved.
- **Krok 1:** `Textarea` primitive (taller, mono), the `hasHeader` native checkbox, live stats line "Wykryto
  N wierszy · M kolumn" (N excludes the header row when `hasHeader`); footer: Anuluj (Link to /leady) + Dalej
  (disabled until `allRows.length > 0`).
- **Krok 2:** mapping as a `Table` primitive — one ROW per column: Kolumna (header name or "Kolumna i") | Podgląd
  (first non-empty cell, truncated) | Cel (`Select` with the existing FIELDS options + "Pole własne" -> inline
  `Input` for the custom key, dashed). The email hint becomes `Note variant="warning"`. Footer: the offeringLine
  `Select` (label "Linia usługi") on the left, Wstecz + submit `Button variant="primary"` "Importuj N leadów"
  on the right; the submit is DISABLED until some column maps to `organizationName` (client courtesy; server
  validation stays the source of truth). Pending label "Importuję...".
- **Krok 3 (result):** derived from `state.ok` — on success advance to a result view: a 4-stat strip
  (Dodane [success] / Duplikaty / Wykluczone [warning] / Bez e-maila) + actions "Importuj kolejne" (resets text/
  targets/step — controlled values, so reset via state setters) and "Przejdź do leadów" (Link). On error: stay on
  step 2 with the inline danger `<p>` (unchanged behavior).
- Server action `importLeads` is NOT touched.

## 3. Lead detail — layout B (main column + AI rail)

`app/(app)/leady/[id]/page.tsx` recomposed (components themselves only minimally touched):

- **Header** (composed locally — a detail-page variant, not the list `PageHeader`): top row keeps the "← Leady"
  link; then `h1` org name + the existing stage/score Badges inline; below a quick-facts meta line
  `email · website · city` (only non-empty parts, ` · ` joined, faint). Hairline under the header.
- **Grid `lg:grid-cols-[1.6fr_1fr]`** (stacks on small screens):
  - **Main column:** section "Dane" (the `LeadEditForm`) then section "Oś czasu" (`ActivityForm` + `LeadTimeline`).
  - **AI rail:** section "Badania AI" (`UruchomResearch`) then "Draft maila" (`DraftPanel`).
- **Section pattern:** uppercase 10 px label (`text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint`)
  + the content. Where a child component ALREADY renders its own bordered container (DraftPanel, UruchomResearch),
  do NOT wrap it in another Card (no double borders) — label + component. Where it doesn't (LeadEditForm,
  timeline group), wrap in `Card`/`CardBody`. Implementer reads each component first and applies this rule.
- No data/action changes; the same five child components, re-arranged.

## Scope

**IN:** the three areas above. **OUT:** updateLead phone/region support (pre-existing gap, separate),
the import column auto-mapping heuristics, any migration, any server-action change.

## Testing

- `labels.test.ts` totality for the new maps (the only new unit tests — the wizard logic is component state).
- Gates: `tsc` 0, `eslint` clean, `vitest` green (258 + 0/2 assertions inside the existing labels suite);
  `next build` deferred while dev is live.
- Form-contract guard: set-diff of `name=` over the importer change = EMPTY (no field added/renamed/dropped).
- Live eyeball by the user on :3000 (import flow end-to-end with a real paste; lead card on lg + narrow).

## Risks / notes

- The importer textarea/checkbox are CONTROLLED — "Importuj kolejne" resets via setters (form.reset() alone
  would not clear them).
- Step-3-on-success means `useActionState` keeps the last result; leaving step 3 via "Importuj kolejne" only
  changes local step state — a subsequent submit replaces the state (correct); the result view must read
  `state` ONLY when `step === 2`.
- The mapping Table can be long (many columns) — rows are fine; no virtualization needed at internal scale.
