# Phase 7 — dark-ready token migration — Design

Date: 2026-06-09. Status: spec ready (grounded by the `dark-ready-color-inventory` workflow). **Implementation
deferred to a FRESH session** (per the split-spec/implement convention + the user's request). Sub-project of
Phase 7; a focused, objective subset of `page-level-visual-pass` that makes the app render correctly in dark
mode and flips the default theme to dark.

## Goal

Make every page **dark-correct** by replacing literal Tailwind color classes (`zinc-*`, `white`, status
colors) with the design-foundation token utilities, then flip the runtime default theme from light to dark.
After this, dark mode works app-wide (today only `/ustawienia` + the nav are theme-correct).

## Scope

**IN:** mechanical color-class -> token swap across the **33 files** below (the canonical map), the few
resolved exceptions, and flipping the default theme to dark at the very end.

**OUT (stays in `page-level-visual-pass`, the later high-taste pass):** converting raw `<button>`/`<input>`/
`<select>`/`<textarea>`/badges to the `components/ui/*` primitives; layout/spacing/empty-state/copy polish;
dedicated category-badge tokens. This pass keeps the existing markup and only swaps class names.

## Canonical replacement map (apply consistently everywhere)

| from | to |
|---|---|
| `text-zinc-700` | `text-fg` |
| `text-zinc-600` / `text-zinc-500` | `text-fg-muted` |
| `text-zinc-400` | `text-fg-faint` |
| `text-white` (on a dark button) | `text-primary-fg` |
| `text-blue-600` (link/accent) | `text-accent` |
| `text-red-600` | `text-danger` |
| `text-green-700` | `text-success` |
| `text-amber-700` | `text-warning` |
| `bg-white` | `bg-surface-1` |
| `bg-zinc-50` / `bg-zinc-100` | `bg-surface-2` |
| `bg-zinc-900` (solid button) | `bg-primary` (pair `text-white`->`text-primary-fg`) |
| `bg-blue-50` | `bg-accent-quiet` |
| `border-zinc-100` / `border-zinc-200` / `border-zinc-300` / `border-zinc-400` | `border-border` |
| `divide-zinc-200` | `divide-border` |
| `hover:bg-zinc-50` | `hover:bg-surface-2` |
| `hover:border-zinc-300` | `hover:border-border-strong` |

(Refinement vs the raw inventory: `text-zinc-400 -> text-fg-faint` to preserve a 3-tier text hierarchy.)

## Resolved ambiguities (defaults — override in the fresh session if desired)

1. **Solid amber CTAs** — `bg-amber-600 text-white` on `draft-panel.tsx` ("Zapisz draft"),
   `uruchom-research.tsx` ("Zastosuj propozycje"), `batches/[id]/batch-view.tsx` ("Zatwierdź wszystko"):
   these are **primary actions**, not quiet tints. Map -> `bg-primary text-primary-fg` (NOT the
   `bg-warning-quiet` default). The amber was an arbitrary highlight.
2. **Off-palette category badges** — the research *kind* badges (`bg-amber-100`/`text-amber-700` = Ocena,
   `bg-sky-100`/`text-sky-700` = Treść, `bg-violet-100`/`text-violet-700` = Draft on `badania/page.tsx`;
   the violet "draft" badge on `sequence-and-leads.tsx`): **leave AS-IS** (documented exception). They are
   light-tint category chips that stay readable on dark, and keeping them preserves the kind distinction.
   Proper dark-native category tokens are a `page-level-visual-pass` enhancement. (Do NOT collapse them to
   `warning`/`accent` — that loses meaning.)
3. **Suppression "Usuń"** (`suppression/page.tsx`, `text-blue-600` on a destructive link) -> `text-danger`
   (semantic, matches the other delete actions).
4. **Header/emphasis borders** — `border-zinc-300` -> `border-border` by default; the **table-header bottom
   border** on `leady/page.tsx` -> `border-border-strong` to preserve hierarchy over fainter body rows.
5. **Faint text tier** — `text-zinc-400` -> `text-fg-faint` (see map); `zinc-500/600` -> `text-fg-muted`.
6. **Faint dividers** — `border-zinc-100` -> `border-border` (accept slightly stronger; no faintest token).
7. **Intentional `bg-white`** — `pipeline/card.tsx` card surface -> `bg-surface-1` (the raised panel surface;
   `#131316` in dark — correct).
8. **Markup -> primitive refactor** — OUT of scope (color-only pass keeps raw elements; primitive adoption is
   a later pass).

## Files (33 — grouped into the plan's tasks)

shell+login: `app/logowanie/page.tsx`. leady: `leady/page.tsx`, `lead-form.tsx`,
`batch-research-launcher.tsx`, `leady/[id]/{page,lead-edit-form,activity-form,timeline,draft-panel,uruchom-research}.tsx`.
import+lines+suppression: `leady/import/import-wizard.tsx`, `linie/{page,offering-line-form}.tsx`,
`suppression/{page,suppression-form}.tsx`. kampanie: `kampanie/page.tsx`, `campaign-form.tsx`,
`kampanie/[id]/{page,sending-controls,sequence-and-leads,lead-inbox}.tsx`. badania:
`badania/{page,research-type-form}.tsx`, `badania/batches/[id]/{page,batch-view}.tsx`. szablony+placeholdery:
`szablony/{page,template-editor}.tsx`, `placeholdery/{page,placeholder-form}.tsx`. skrzynki+pipeline:
`skrzynki/page.tsx`, `pipeline/{page,board,card}.tsx`.
(`app/page.tsx` = redirect, no colors. `app/(app)/layout.tsx`, `/ustawienia`, `components/ui/*` already
tokenized.)

## Default-theme flip (final step, after all 33 files migrate)

- `features/theme/resolve.ts`: change `resolveInitialTheme` default `"light"` -> `"dark"` (+ update the
  comment). Decide whether unstored should honor `prefers-color-scheme` (recommended: default `"dark"`
  outright for this internal tool; keep it simple).
- `app/layout.tsx`: the no-flash `themeScript` default `"light"` -> `"dark"`; `<html data-theme="light">` ->
  `data-theme="dark"`; keep them mirrored (the comment already notes this).
- `features/theme/resolve.test.ts`: update the "defaults to dark" expectation.
- Smoke-test dark across every migrated page before committing the flip.

## Testing

- `tsc` 0, `next build` green, `eslint` clean after each slice.
- No unit tests change except the theme-resolve default flip test.
- Manual: toggle to dark (or after the flip, default dark) and eyeball each migrated route for unreadable
  (dark-on-dark) text or white islands. The inventory's per-file summaries are the checklist.
- Optional: a guard grep `rg "(zinc|bg-white|text-white|border-zinc)" app/(app)` should return only the
  documented exceptions (category badges) after the pass.

## Risks / notes

- **Riskiest files** (resolve per the ambiguity decisions, eyeball after): `draft-panel.tsx`,
  `uruchom-research.tsx`, `batches/[id]/batch-view.tsx` (solid amber CTAs -> primary), `badania/page.tsx` +
  `sequence-and-leads.tsx` (category badges left as-is).
- **Order matters for the flip:** keep the default on light until ALL 33 files are migrated + verified, then
  flip — so no half-migrated page renders broken in dark.
- Pure UI; no API/live dependency. Mechanical + low-risk per file; the value is consistency (one shared map).
