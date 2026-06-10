# Creation UX — modals, lead wizard, page headers — Design

Date: 2026-06-10. Status: approved (scope: "all pages + headers"; step indicator: variant B picked in the mock;
animation spec authored with the /motion and /web-animation-design skills per the user's instruction).
Post-Phase-7 polish. Size M/L. Mock: `.superpowers/brainstorm/2477-1781081234/content/creation-ux.html`.

## Goal

Kill the "dev tool" feel of the library pages: creation moves from inline forms glued above lists into modals —
the lead gets a 2-step wizard whose dialog box smoothly morphs between steps (shared-layout animation) — and every
library page gets a professional header (title + description + live counts + a primary action on the right),
hover states on list rows, and EmptyState CTAs. Big editors (szablony, badania) stay pages.

## Animation spec (binding; from the motion + web-animation-design skills)

- Modal ENTER: backdrop `opacity 0->1` + panel `opacity 0->1, scale 0.96->1, y 8->0`, **200 ms, ease-out-quart**
  (`cubic-bezier(0.165, 0.84, 0.44, 1)`); EXIT 160 ms (~20% faster) to `scale 0.97, opacity 0`. Backdrop and panel
  share timing (paired-elements rule). Never scale from 0.
- STEP CHANGE (on-screen morph): the panel uses Motion `layout` (FLIP -> transform-only, no layout-property
  animation) with `transition={{type: "spring", visualDuration: 0.25, bounce: 0}}` — no overshoot, interruptible.
  Step content enters direction-aware: `x: +-12 -> 0, opacity 0 -> 1`, 200 ms ease-out (next = from right). The
  outgoing step hides instantly (`hidden`) — Linear-style "morph + enter", which also preserves form state (below).
- Progress (variant B): "Krok 1 z 2 · Organizacja" (11 px, muted) + a 2 px accent progress line whose width
  animates with the same spring as the morph.
- `useReducedMotion`: disables EVERYTHING (no morph, no slides, no scale — instant snaps), mirroring settings-shell.
- Row hover (frequent interaction): CSS only, `transition-colors 150ms ease`, border + subtle bg. No JS.
- Imports from `"motion/react"` only (client components). No `framer-motion` anywhere.

## 1. New primitives (`components/ui/`)

- **`modal.tsx`** — native `<dialog>` (the ConfirmProvider idiom: `showModal()`/`close()`, `onCancel` -> onClose,
  `backdrop:` classes; ESC + focus-trap for free). Props: `{open, onClose, title, children, footer?, width?}`.
  Inside: a Motion panel implementing the enter/exit + `layout` morph per the animation spec. The footer renders
  in a hairline-topped bar (`border-t border-border bg-surface-2/60`).
- **`page-header.tsx`** — `{title, description?, meta?: ReactNode, action?: ReactNode}`: flex row, title 16-18 px
  semibold, description 12-13 px muted, meta line 11 px faint (counts, ` · ` separated, tabular), action flush
  right (usually `<Button variant="primary">`), hairline under the whole header.

## 2. Lead wizard (`app/(app)/leady/lead-wizard.tsx`, client)

- Trigger: the page-header action "+ Dodaj leada" and the EmptyState CTA.
- 2 steps inside ONE `<form action={useActionState(createLead)}>`:
  - **Krok 1 — Organizacja:** `organizationName` (required), `website`, `city`, `offeringLineId` (Select).
  - **Krok 2 — Kontakt:** `contactPersonName`, `contactRole`, `honorific` (Select Pan/Pani/—), `email`, `phone`,
    `region`.
- Steps stay MOUNTED; the inactive step gets `hidden` (display:none inputs still submit) — the FormData contract
  is one flat submit, no state duplication. "Dalej" validates only the ACTIVE step via
  `step.querySelectorAll(":invalid")` + `reportValidity()`; "Wstecz" never validates.
- Footer: left "Importuj z CSV →" link (`/leady/import`, krok 1 only); right Anuluj | Dalej / Wstecz | "Dodaj
  leada" (primary, pending-disabled). On `state.ok`: toast "Dodano leada", form reset, modal closes, wizard back
  to step 1 (revalidate already in the action). Error: inline danger `<p>` (stays on the failing step).
- **Server (additive):** `leadFormSchema` + `createLead` gain `honorific` (PAN/PANI/empty -> null), `phone`,
  `region` — columns already exist on `Lead`; no migration. `contactRole` is already accepted.

## 3. Simple modals (same `Modal` primitive)

`kampanie` (name + offeringLine), `linie` (name + description), `placeholdery` (5 fields), `suppression` (email):
the EXISTING form components move inside a Modal opened from the page-header action; inline forms disappear from
above the lists. Each form gains an `onSuccess` callback (effect on `state.ok` -> close + toast); field `name`s
and server actions unchanged. A small client `create-<x>-button.tsx` per page owns the open state (server pages
stay server).

## 4. Page headers + filling (all library pages)

- Adopt `PageHeader` on: **leady** (meta: "N leadów · M w kampaniach"; actions: "+ Dodaj leada" + the existing
  Importuj link as secondary; the filter toolbar moves directly under the header), **kampanie** ("N kampanii ·
  M aktywnych"), **linie**, **placeholdery**, **suppression** ("N wykluczeń"), **szablony** + **badania** (header
  + counts; action stays a Link to the existing editor/page — no modal), **pipeline** (header + lead count; no action).
- Counts come from data already fetched (list lengths) plus at most one cheap `count()` where the list is filtered
  (leady total). No new feature queries module.
- EmptyState `action` opens the relevant modal (leady/kampanie/linie/placeholdery) or links (szablony/badania).
- List-row hover polish on the Card rows: `hover:border-border-strong` (+ existing transition tokens) across
  kampanie/szablony/placeholdery/linie/suppression/badania rows.

## Scope

**IN:** the two primitives, the lead wizard (+ additive `createLead` fields), four simple modals, headers + counts
+ hover + EmptyState CTAs on the listed pages. **OUT:** moving the szablony/badania editors into modals, the CSV
import wizard redesign (link only), bulk edit, keyboard shortcuts, any migration.

## Testing

- Pure: none new required (wizard state is trivial component state); if a helper emerges (e.g. step-direction
  reducer), unit-test it. Existing 258 stay green.
- Gates: `tsc` 0, `eslint` clean, `vitest` green; `next build` deferred while dev is live.
- Form-contract guard: a `name=` set-diff over the touched forms must show NO renamed/dropped field; `createLead`
  gains only the three additive fields.
- Live eyeball by the user on :3000 (modals, morph, reduced-motion via OS setting if possible).

## Risks / notes

- Native `<dialog>` + Motion: animate INSIDE the dialog element (the dialog itself cannot be FLIP-morphed
  reliably across browsers); panel = a child `motion.div`.
- `hidden` steps keep inputs in the form — deliberate (uncontrolled inputs, zero double-source-of-truth).
- The morph animates the PANEL between two content heights; with `layout` on the panel and steps swapping,
  Motion measures before/after — verify no scrollbar flash (`overflow-hidden` on the panel during transition).
- Modals are client islands on server pages; pages keep their data fetching (forms receive props as today).
