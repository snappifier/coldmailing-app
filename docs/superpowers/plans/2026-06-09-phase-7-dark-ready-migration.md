# dark-ready token migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace literal color classes with design tokens across 33 pages so dark mode renders correctly app-wide, then flip the runtime default theme to dark.

**Architecture:** Mechanical, slice-by-slice application of ONE shared canonical map (below). Keep markup; swap class names only. Flip the default theme LAST, after all pages are migrated + verified. Spec: `docs/superpowers/specs/2026-06-09-phase-7-dark-ready-migration-design.md`.

**Tech Stack:** Next 16, Tailwind v4 (tokens from design-foundation), TypeScript 6, Vitest 4.

---

## Canonical map (apply in EVERY task)

```
text-zinc-700            -> text-fg
text-zinc-600            -> text-fg-muted
text-zinc-500            -> text-fg-muted
text-zinc-400            -> text-fg-faint
text-white (dark button) -> text-primary-fg
text-blue-600            -> text-accent
text-red-600             -> text-danger
text-green-700           -> text-success
text-amber-700           -> text-warning
bg-white                 -> bg-surface-1
bg-zinc-50 / bg-zinc-100 -> bg-surface-2
bg-zinc-900              -> bg-primary
bg-blue-50               -> bg-accent-quiet
border-zinc-100/200/300/400 -> border-border
divide-zinc-200          -> divide-border
hover:bg-zinc-50         -> hover:bg-surface-2
hover:border-zinc-300    -> hover:border-border-strong
```
**Exceptions (do NOT apply the default map):**
- Solid amber CTA buttons `bg-amber-600 text-white` -> `bg-primary text-primary-fg` (primary actions).
- Research **kind** category badges (`bg-amber-100`/`text-amber-700`, `bg-sky-100`/`text-sky-700`, `bg-violet-100`/`text-violet-700`) -> **leave as-is** (documented light-tint exception).
- Suppression "Usuń" link `text-blue-600` -> `text-danger` (destructive, not accent).
- `leady/page.tsx` table-header bottom border `border-zinc-300` -> `border-border-strong` (hierarchy).

After each task: `npx tsc --noEmit` (0), commit. Run `npm run build` only on the final task (Task 9).

---

## Task 1: shell + login

**Files:** `app/logowanie/page.tsx`.
- [ ] Apply the canonical map (this file: `text-zinc-600`->`text-fg-muted`, `border-zinc-300`->`border-border`, `hover:bg-zinc-50`->`hover:bg-surface-2`).
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — login"`

## Task 2: leady (list + detail)

**Files:** `app/(app)/leady/page.tsx`, `lead-form.tsx`, `batch-research-launcher.tsx`, `app/(app)/leady/[id]/{page,lead-edit-form,activity-form,timeline,draft-panel,uruchom-research}.tsx`.
- [ ] Apply the canonical map to all 9 files. Exceptions in this slice: `leady/page.tsx` table-header border -> `border-border-strong`; `draft-panel.tsx` + `uruchom-research.tsx` solid `bg-amber-600 text-white` CTAs ("Zapisz draft" / "Zastosuj propozycje") -> `bg-primary text-primary-fg`.
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — leady (list + detail)"`

## Task 3: import + lines + suppression

**Files:** `app/(app)/leady/import/import-wizard.tsx`, `app/(app)/linie/{page,offering-line-form}.tsx`, `app/(app)/suppression/{page,suppression-form}.tsx`.
- [ ] Apply the canonical map. Exception: `suppression/page.tsx` "Usuń" `text-blue-600` -> `text-danger`.
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — import, lines, suppression"`

## Task 4: kampanie

**Files:** `app/(app)/kampanie/page.tsx`, `campaign-form.tsx`, `app/(app)/kampanie/[id]/{page,sending-controls,sequence-and-leads,lead-inbox}.tsx`.
- [ ] Apply the canonical map. Exception: the violet "draft" badge (`bg-violet-100`/`text-violet-700`) in `sequence-and-leads.tsx` -> leave as-is.
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — kampanie"`

## Task 5: badania

**Files:** `app/(app)/badania/{page,research-type-form}.tsx`, `app/(app)/badania/batches/[id]/{page,batch-view}.tsx`.
- [ ] Apply the canonical map. Exceptions: the kind category badges (amber/sky/violet) in `badania/page.tsx` -> leave as-is; `batch-view.tsx` solid `bg-amber-600 text-white` "Zatwierdz wszystko" CTA -> `bg-primary text-primary-fg`.
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — badania"`

## Task 6: szablony + placeholdery

**Files:** `app/(app)/szablony/{page,template-editor}.tsx`, `app/(app)/placeholdery/{page,placeholder-form}.tsx`.
- [ ] Apply the canonical map (template-editor has the built-in token palette buttons + the `{{...}}` insert buttons — swap zinc borders/hover to tokens).
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — szablony, placeholdery"`

## Task 7: skrzynki + pipeline

**Files:** `app/(app)/skrzynki/page.tsx`, `app/(app)/pipeline/{page,board,card}.tsx`.
- [ ] Apply the canonical map (`board.tsx` drop-target `bg-blue-50` -> `bg-accent-quiet`, column `bg-zinc-100` -> `bg-surface-2`; `card.tsx` `bg-white` -> `bg-surface-1`, `hover:border-zinc-300` -> `hover:border-border-strong`).
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): dark-ready tokens — skrzynki, pipeline"`

## Task 8: verify dark, then flip the default theme

- [ ] **Verify before flipping.** With the dev server, toggle to dark and eyeball each migrated route (use the spec's per-file summaries as the checklist) for dark-on-dark text or white islands. Fix any stragglers (likely a missed literal class) and commit them. Optional guard: `rg "(text-zinc-|bg-zinc-|border-zinc-|divide-zinc-|bg-white|text-white|text-blue-600|bg-blue-)" "app/(app)"` should return only the documented category-badge exceptions.
- [ ] **Flip `features/theme/resolve.ts`:** default `"light"` -> `"dark"`:
```typescript
export function resolveInitialTheme(stored: string | null): Theme {
	return stored === "dark" || stored === "light" ? stored : "dark"
}
```
Update the comment (no longer "light during migration").
- [ ] **Flip `app/layout.tsx`:** in `themeScript`, the two `"light"` fallbacks -> `"dark"`; `<html data-theme="light">` -> `data-theme="dark"`. (Keep the script + resolveInitialTheme mirrored.)
- [ ] **Update `features/theme/resolve.test.ts`:** the "defaults to ... when nothing is stored" test -> expect `"dark"` for `null` and `"bogus"`.
- [ ] Run `npx vitest run features/theme/resolve.test.ts` (pass with the new expectation).
- [ ] `npx tsc --noEmit` (0).
- [ ] Commit: `git commit -m "feat(phase7): flip default theme to dark (all pages migrated)"`

## Task 9: gates + roadmap + graph

- [ ] `npx tsc --noEmit` (0); `npx vitest run` (207, theme test updated still passes); `npx eslint "app/(app)"` (clean); `npm run build` (green, dev OFF).
- [ ] Update `docs/superpowers/ROADMAP.md`: mark `dark-ready token migration` DONE; note the default is now dark + all pages token-based; `page-level-visual-pass` now only owns the deeper polish (primitive adoption, spacing/copy, category-badge tokens).
- [ ] `graphify update .`.
- [ ] Commit: `git commit -m "docs(phase7): mark dark-ready migration DONE + refresh graph"`

---

## Self-review

**Spec coverage:** canonical map (every task) ✓; 33 files across 7 slice tasks (T1-T7) ✓; all 8 ambiguity resolutions encoded as task exceptions (amber CTAs T2/T5, category badges T4/T5 leave-as-is, suppression Usun T3, header border T2, faint tier in the map, bg-white T7) ✓; default flip last (T8) ✓; gates/roadmap (T9) ✓.

**Placeholder scan:** the map + per-slice exceptions are concrete; the per-file detail lives in the spec's inventory summaries (referenced). No TBD.

**Type consistency:** `resolveInitialTheme` default value is the only logic change (T8) + its test (T8); all else is class-string swaps. Token utility names match design-foundation.

**Notes:** Mostly mechanical — a careful find/replace per file using the map, honoring the 4 exception groups. Riskiest files (solid amber CTAs, category badges) are explicitly called out in T2/T5. Keep light default until T8.
