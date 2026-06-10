# Further polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three independent polish pieces per spec `docs/superpowers/specs/2026-06-10-further-polish-design.md` (BINDING, esp. §2 form contract + animation constants): (1) skrzynki header + status Badge, (2) the CSV importer rebuilt as a 3-step wizard, (3) the lead detail page recomposed to layout B (main column + AI rail).

**Architecture:** No server-action, query, or schema changes anywhere. T1 extends the shared labels module (+tests). T2 rewrites ONE client component in the established wizard language — the reference implementation is `app/(app)/leady/lead-create-button.tsx` (mounted steps + `hidden`, imperative `animate()` slide, progress bar). T3 is a page-level recomposition of existing components.

**Tech Stack:** as creation-ux (Motion 12 via `motion/react`, `components/ui/*`, Tailwind v4 tokens, Vitest 4).

---

## Conventions (every task)

Tabs, no semicolons, path comment line 1 (line 2 after `"use client"`), `className` FIRST prop, `import {x}` no inner spaces, NO emoji. Read every file before editing. Gates per task: `npx tsc --noEmit` 0, `npx eslint <paths>` clean, `npx vitest run` green. One task = one commit, NO push, NO `next build`.

---

### Task 1: Skrzynki — labels maps + header + Badge

**Files:** Modify `features/enums/labels.ts`, `features/enums/labels.test.ts`, `app/(app)/skrzynki/page.tsx`.

- [ ] In `labels.ts` (after `ROLE_LABEL`), add — import type `EmailAccountStatus` on the existing type-import line:
```ts
export const EMAIL_ACCOUNT_STATUS_LABEL: Record<EmailAccountStatus, string> = {CONNECTED: "Połączona", ERROR: "Błąd", DISCONNECTED: "Odłączona"}
export const EMAIL_ACCOUNT_STATUS_VARIANT: Record<EmailAccountStatus, BadgeVariant> = {CONNECTED: "ok", ERROR: "bad", DISCONNECTED: "neutral"}
```
- [ ] In `labels.test.ts`: add `EmailAccountStatus` to the prisma import + the two map names to the labels import; add `total(EmailAccountStatus, EMAIL_ACCOUNT_STATUS_LABEL)` in the label-totality `it` and `total(EmailAccountStatus, EMAIL_ACCOUNT_STATUS_VARIANT)` in the variant-totality `it`.
- [ ] `skrzynki/page.tsx`: add `PageHeader` (title "Skrzynki wysyłkowe", description "Połączone konta Gmail z limitami i oknami wysyłki.", meta `` `${accounts.length} skrzynek · ${connected} połączonych` `` where `connected = accounts.filter((a) => a.status === "CONNECTED").length`) replacing the `h1`; the connect `<a>` moves into the header `action` KEEPING it an anchor to `/api/mailbox/google/connect` but styled as the primary button (copy the exact Button primary classes onto the anchor — check `components/ui/button-variants.ts` for the strings; an `<a>` is required for the OAuth full-page navigation). Replace the raw `{a.status}` span with the `Badge` via the two new maps. Replace the empty-list `<li>` with `EmptyState` (title "Brak połączonych skrzynek", action = the same styled connect anchor). The success/error searchParams `<p>`s and everything else stay.
- [ ] Gates: tsc 0; `npx eslint features/enums "app/(app)/skrzynki/**"` clean; `npx vitest run features/enums/labels.test.ts` green (the suite grows by 0 tests — 2 assertions inside existing its). Commit:
```bash
git add features/enums "app/(app)/skrzynki"
git commit -m "feat(polish): skrzynki PageHeader + EmailAccountStatus Badge maps"
```

---

### Task 2: CSV importer — 3-step wizard rewrite

**Files:** Rewrite `app/(app)/leady/import/import-wizard.tsx`; modify `app/(app)/leady/import/page.tsx`.
**Reference (read BOTH first):** `app/(app)/leady/lead-create-button.tsx` (the binding wizard mechanics: mounted steps + `hidden`, imperative `animate()` from `"motion/react"` with prev-step ref + `useReducedMotion` skip, progress "Krok X z N · label" + 2 px bar animating width with `{type: "spring", visualDuration: 0.25, bounce: 0}`) and the spec §2.

- [ ] **`page.tsx`:** `PageHeader` (title "Import leadów", description "Wklej dane z arkusza, zmapuj kolumny i zaimportuj.", action `<Link className="text-sm text-accent hover:underline" href="/leady">← Leady</Link>`) replacing the `h1`.
- [ ] **`import-wizard.tsx` rewrite.** Keep ALL existing logic/state (parseTable, targets, onText structural reset, selValue/onSelect, FIELDS, useActionState with `importLeads`). Add `step` state (0|1) + the result view (shown when `state?.ok` and a local `done` flag — see below). BINDING CONTRACT: ONE `<form action={action}>` wrapping steps 1+2 with BOTH step containers ALWAYS mounted (`hidden` on the inactive); fields keep their exact names (`text`, `hasHeader`, `target_<i>`, `customkey_<i>`, `offeringLineId`); NO AnimatePresence/`key` inside the form.
  - Step flow: `step` 0 = Wklej, 1 = Mapuj. The RESULT is rendered INSTEAD of the form when `state?.ok && done` — manage `done` via the useActionState wrapper pattern (wrap `importLeads`: `const res = await importLeads(prev, fd); if (res.ok) setDone(true); return res` — side-effects in the wrapper, lint-safe). "Importuj kolejne" resets: `setDone(false)`, `setStep(0)`, `setText("")`, `setTargets({})` (controlled values — no form.reset needed; `hasHeader` stays as-is).
  - Progress header (above the form AND the result): "Krok {n} z 3 · {Wklej dane|Mapuj kolumny|Wynik}" + the 2 px bar at 33/66/100% (result = 100). Slide steps with the imperative `animate()` pattern (two step refs + prevStep ref; skip on mount + reduced motion).
  - **Krok 1:** `Textarea` primitive (`className="h-48 font-mono text-xs"`, keep `name="text"`, controlled value+onChange via the existing `onText`); the `hasHeader` native checkbox unchanged; stats line `Wykryto {dataRows} wierszy · {columnCount} kolumn` where `dataRows = hasHeader ? Math.max(0, allRows.length - 1) : allRows.length` (render only when text non-empty); footer row: `<Link ... href="/leady">Anuluj</Link>` + `<Button variant="primary" type="button" disabled={allRows.length === 0} onClick={() => setStep(1)}>Dalej</Button>`.
  - **Krok 2:** the mapping becomes a `Table`/`Th`/`Td` — one row per column index: Kolumna (`headers[i]?.trim() || `Kolumna ${i + 1}``) | Podgląd (first non-empty cell of that column from the data rows, `truncate`, faint) | Cel (the existing `Select` + options + the custom-key `Input` below when `kind === "custom"`, dashed border kept). The email hint becomes `<Note variant="warning">`. Below: a footer row with the `offeringLineId` `Select` (Field label "Linia usługi", keep `name`) left, and right: `<Button type="button" onClick={() => setStep(0)}>Wstecz</Button>` + `<Button variant="primary" type="submit" disabled={pending || !hasOrgName}>{pending ? "Importuję..." : `Importuj ${dataRows} leadów`}</Button>` where `hasOrgName = Object.values(targets).some((t) => t.kind === "field" && t.field === "organizationName")`. The inline error `<p>` stays under the footer (visible on step 2).
  - **Wynik (replaces the form when done):** a 4-stat strip styled like the dashboard result row (bordered `Card`-ish flex with `divide-x`): Dodane (`text-success`) {state.created} / Duplikaty {state.duplicateCount} / Wykluczone (`text-warning`) {state.suppressedCount} / Bez e-maila {state.withoutEmail}; under it actions: `<Button type="button" onClick={resetAll}>Importuj kolejne</Button>` + `<Link className="...primary-anchor..." href="/leady">Przejdź do leadów</Link>` (style as primary Button classes on a Link).
- [ ] Gates: tsc 0; `npx eslint "app/(app)/leady/import/**"` clean; vitest green. **Form-contract check:** `git diff -U0 -- "app/(app)/leady/import" | grep -E '^[+-].*name='` -> the SAME name set on both sides (nothing added/renamed/dropped). Commit:
```bash
git add "app/(app)/leady/import"
git commit -m "feat(polish): CSV importer as a 3-step wizard (paste -> map -> result)"
```

---

### Task 3: Lead detail — layout B

**Files:** Modify `app/(app)/leady/[id]/page.tsx` (recomposition); minimal touches allowed in `draft-panel.tsx` / `uruchom-research.tsx` ONLY if their outer container needs a class tweak to sit flush in the rail (read them first; avoid double borders per spec §3).

- [ ] **Header:** keep the `← Leady` Link on top; replace the `h1 + badges` row with: `h1` (org name, `text-[17px] font-semibold tracking-[-0.02em]`) + the two existing Badges inline; ADD a quick-facts line under it: `[lead.email, lead.website, lead.city].filter(Boolean).join(" · ")` in `text-[11px] text-fg-faint` (render only when non-empty); a `border-b border-border pb-4` on the header block.
- [ ] **Grid:** `grid gap-6 lg:grid-cols-[1.6fr_1fr]`.
  - Main column (`flex flex-col gap-6`): section **Dane** = uppercase label (`text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint mb-2`) + `LeadEditForm` wrapped in `Card`/`CardBody` (the form has no own border — verify by reading); section **Oś czasu** = label + `Card`/`CardBody` containing `ActivityForm` + `LeadTimeline` stacked `gap-3` (timeline rows already render their own Cards inside — if that looks like cards-in-card, put ActivityForm in the Card and leave `LeadTimeline` outside it, directly under — implementer judges by reading both; NO double borders).
  - Rail (`flex flex-col gap-6`): section **Badania AI** = label + `UruchomResearch` AS-IS (it has its own container); section **Draft maila** = label + `DraftPanel` AS-IS (own container).
- [ ] Gates: tsc 0; `npx eslint "app/(app)/leady/[id]/**"` clean; vitest green. Commit:
```bash
git add "app/(app)/leady/[id]"
git commit -m "feat(polish): lead detail layout B - main column + AI rail + quick-facts header"
```

---

### Task 4: Final (controller) — gates, audit, docs

- [ ] Full tsc/vitest/eslint; `next build` only if dev OFF. Importer `name=` set-diff (empty). ROADMAP line, `graphify update .`, docs commit. Dismiss the spawned chip `task_7380c42d` (done by T1).

## Self-review notes

- Spec coverage: §1=T1, §2=T2 (contract + animation constants restated inline), §3=T3 (double-border rule restated), testing=T1 assertions + T4 audit.
- The importer result-view replaces the FORM — acceptable because reaching it requires `state.ok` (a successful import); "Importuj kolejne" rebuilds a fresh paste step with cleared controlled state; fields reappear with empty values (mounted again — no stale-value risk since text/targets are controlled and reset).
- T2/T3 deliberately give instructions + in-repo references instead of full code — the wizard mechanics are already proven in `lead-create-button.tsx`.
