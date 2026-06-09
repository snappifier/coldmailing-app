# Phase 7 — design-foundation — Design

Date: 2026-06-09. Status: brainstorm done (visual sketch approved) — pending spec review. Sub-project 1 (build
order) of Phase 7. The visual source of truth is `docs/superpowers/design/design-foundation-sketch.html`
(committed) — this spec ports it into the real app.

## Goal

Establish the shared visual layer the whole app is missing: design tokens, a small typed component-primitive
library, dark+light theming, motion conventions, and the global scaffolding (toast, confirm dialog, route
boundaries, container, a11y baseline) — so every later Phase 7 sub-project composes consistent pieces instead
of re-deriving raw Tailwind. Validate it on ONE real surface (`/ustawienia`).

## Visual direction (locked via the sketch)

Vercel/Linear refined-minimal: near-black, **dark by default + full light**; **Inter** (UI) + **Geist Mono**
(numerics/IDs); monochrome-first with a **muted cool indigo** accent used sparingly (active nav, links, focus,
info) — dark `#7c86dd`, light `#4f56c6`; **flat** (no grain, soft glow); **sharp** radii (4/6/8px); balanced
density; motion = **ease-out** entrances (≤300ms), snappy micro-interactions, reduced-motion honored.

## Scope

**IN (this sub-project):**
- Design tokens in `globals.css` (Tailwind v4 `@theme inline` + per-theme CSS vars), values from the sketch.
- Fonts via `next/font` (self-hosted Inter + Geist Mono; removes the sketch's CDN dependency).
- Theme mechanism: `data-theme` on `<html>`, no-flash inline script, `prefers-color-scheme` default, a
  `ThemeToggle`, `localStorage` persistence.
- Primitive library in `components/ui/*` (list + APIs below), built on `cn()` (`lib/cn.ts`).
- Global scaffolding: `ToastProvider` + `useToast`, `ConfirmDialog` + `useConfirm`, route-level
  `loading.tsx` / `error.tsx` / `not-found.tsx`, a max-width `Container`, a11y baseline (skip link,
  global focus-visible, reduced-motion reset).
- Motion: easing tokens + reduced-motion; the settings "fluid body" transition.
- **Reference surface: `/ustawienia` rebuilt** with the section-nav shell + fluid body + primitives (the
  surface the user designed), migrating the existing opt-out + sender-signature forms onto primitives, plus a
  small new "Ogólne" section (org name).
- A light **token re-skin** of the existing global nav (`app/(app)/layout.tsx`): token colors + a theme
  toggle + `aria-current` active state.

**DEFERRED (later Phase 7 sub-projects, explicitly NOT here):**
- The full nav/shell redesign — sidebar, wordmark, cmd-k, account menu, mobile drawer (= `shell-and-nav-redesign`).
- Re-skinning every other page (`/leady`, `/pipeline`, `/kampanie`, …) (= `page-level-visual-pass`).
- "Skrzynki" / "Zespół" settings sections (those are `deliverability-settings` / `team-role-ui`).
- Real settings sub-routes (we use client-side sections now; routes can come with the shell sub-project).

## Decisions to confirm at review

1. **Reference surface depth.** Proposed: rebuild `/ustawienia` WITH the section-nav + fluid-body shell
   (showcases the motion you designed). Alternative (leaner, closer to "pure plumbing"): only migrate the
   existing `/ustawienia` forms onto primitives, defer the section-nav+fluid-body to the shell sub-project.
2. **Motion library.** Proposed: add **`motion`** (the Motion library, `motion/react`) for the fluid-body
   transition (`AnimatePresence`) + a `useReducedMotion` hook; CSS + easing tokens for all primitive
   micro-interactions. Alternative (no new dep): do the fluid body with a CSS keyframe re-trigger (like the
   sketch) / the View Transitions API.
3. **Theme mechanism.** Proposed: hand-rolled (~15-line no-flash inline script + toggle + `localStorage`),
   no dependency. Alternative: `next-themes` (handles SSR/flash for you, small dep).

## Architecture

### Tokens (`app/globals.css`)

Tailwind v4 CSS-first. Pattern:
```css
@import "tailwindcss";
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {                 /* light */
	--bg: #fbfbfc; --surface-1: #fff; --surface-2: #f6f6f7; --surface-3: #efeff1;
	--border: rgba(9,9,11,.09); --border-strong: rgba(9,9,11,.16);
	--text: #18181b; --text-muted: #56565e; --text-faint: #9b9ba3;
	--accent: #4f56c6; --accent-quiet: rgba(79,86,198,.11); --ring: rgba(79,86,198,.42);
	--primary-bg: #18181b; --primary-fg: #fafafa;
	--success: #16a34a; --danger: #dc2626; --warning: #b45309;  /* + -quiet variants */
}
[data-theme="dark"] {   /* dark — full set, values from the sketch */
	--bg: #08090a; --surface-1: #131316; /* … */ --accent: #7c86dd; /* … */
}
@theme inline {
	--color-bg: var(--bg); --color-surface-1: var(--surface-1); /* … all colors → utilities */
	--color-accent: var(--accent); --color-success: var(--success); /* … */
	--font-sans: var(--font-inter); --font-mono: var(--font-geist-mono);
	--radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px;
	--ease-out: cubic-bezier(0.215,0.61,0.355,1); --ease-out-quart: cubic-bezier(0.165,0.84,0.44,1);
}
@layer base {
	body { background: var(--bg); color: var(--text); }
	:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
	@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; } }
}
```
`@theme inline` makes utilities (`bg-surface-1`, `text-text`, `text-accent`, `rounded-md`, `ease-out`) resolve
to the runtime vars, so flipping `[data-theme]` recolors everything. Full token values are taken verbatim from
the sketch.

### Fonts + theme (root layout)

- `app/layout.tsx`: load `Inter` + `Geist_Mono` via `next/font/google`, expose `--font-inter` / `--font-geist-mono`
  on `<html className={...variable}>`. Add the no-flash theme script in `<head>` (reads `localStorage.theme`
  else `prefers-color-scheme`, sets `documentElement.dataset.theme`). `<body>` drops the hardcoded
  `bg-white text-zinc-900` (now from tokens).
- `components/ui/theme-toggle.tsx` (client): toggles `data-theme` + persists.

### Primitive library (`components/ui/*`)

Each is a small typed, presentational component using `cn()` + token utilities. Proposed APIs:
- `button.tsx` — `variant: "primary"|"secondary"|"ghost"|"danger"` (default secondary), `size: "sm"|"md"`,
  forwards `...props`, `disabled`/pending styles. Variants via a plain map (no CVA dep).
- `input.tsx`, `textarea.tsx`, `select.tsx` — styled native elements forwarding refs/props.
- `field.tsx` — `<Field label hint error>` wrapper (label + control slot + hint/error text); the de-facto
  form-row contract.
- `card.tsx` — `Card`, `CardBody`, `CardFooter`.
- `badge.tsx` — `variant: "neutral"|"ok"|"warn"|"bad"|"info"`, optional leading dot.
- `table.tsx` — `Table`/`THead`/`Th`/`Td` (or a `<table>`-styling wrapper) at balanced density; `.mono`/tabular
  for numeric cells.
- `switch.tsx` — controlled boolean toggle (button role=switch, aria-checked).
- `note.tsx` — inline callout (`variant: "warning"|"info"`), used by the sender-signature flag.
- `empty-state.tsx` — icon + title + text + optional action.
- `spinner.tsx` — for loading/pending.
- `toast.tsx` + `toast-provider.tsx` + `use-toast.ts` — context-based; `toast({title, variant})`; portal
  region bottom-right; auto-dismiss; reduced-motion safe.
- `confirm-dialog.tsx` + `use-confirm.ts` — `const confirm = useConfirm(); if (await confirm({title, body,
  confirmLabel, danger})) {…}`. Built on the native `<dialog>` element (`showModal()` → real focus trap +
  Esc + backdrop, no Radix dep) styled with tokens.

Icons: a tiny inline-SVG set (no `lucide-react` dep) under `components/ui/icons.tsx` for the few we need
(check, chevron, warning, sun/moon, etc.).

### Scaffolding

- `app/(app)/layout.tsx`: wrap children in `<Container>` + mount `<ToastProvider>` + the confirm provider; nav
  re-skinned with token utilities + `ThemeToggle` + `aria-current` (via a small client `NavLink` using
  `usePathname`). Keep the flat link list (full redesign = sub-project #7).
- Route boundaries: `app/(app)/loading.tsx` (centered spinner), `app/(app)/error.tsx` (error card + retry,
  `"use client"`), `app/(app)/not-found.tsx` + `app/not-found.tsx` (empty-state).
- `components/ui/container.tsx` — `max-w-[1080px] mx-auto px-…`.

### Reference surface — `/ustawienia`

Rebuild as the sketch's settings pattern (within the existing app shell):
- A client `SettingsShell` with a left section nav (`Ogólne`, `Podpis nadawcy`, `Wykrywanie rezygnacji`) +
  a **fluid body** that animates on section change (per Decision 2). Active section gets the indigo indicator.
- Sections reuse existing server actions, now rendered with primitives:
  - `Ogólne`: org name (new tiny `setOrgName` action + `Organization.name` already exists) — additive.
  - `Podpis nadawcy`: the existing `SenderSignatureForm` migrated to `Field`/`Textarea`/`Note`/`Button` +
    `useToast` on save; the empty flag becomes `<Note variant="warning">`.
  - `Wykrywanie rezygnacji`: the existing opt-out `SettingsForm` migrated to `Field`/`Select`/`Button`.
- `getOrgSettings` already returns what's needed (+ add `name` to its select).

## Files (high level — the plan enumerates every one)

- `app/globals.css` — tokens + base.
- `app/layout.tsx` — fonts, no-flash script, token body.
- `components/ui/*` — primitives (≈14 files) + `icons.tsx`.
- `components/ui/{toast-provider,use-toast,confirm-dialog,use-confirm,theme-toggle,container}.tsx`.
- `app/(app)/layout.tsx` — providers + container + nav re-skin + `NavLink`.
- `app/(app)/loading.tsx`, `error.tsx`, `not-found.tsx`; `app/not-found.tsx`.
- `app/(app)/ustawienia/*` — `SettingsShell` + the three section components; `getOrgSettings`/actions get
  `name`.
- `package.json` — add `motion` (pending Decision 2). (`clsx`/`tailwind-merge` already present.)

## Testing

The project tests **pure logic** only (Vitest, no component/jsdom setup — out of scope to add). So:
- Unit-test the pure bits: any `button` variant→class resolver, the toast reducer, the confirm-hook state
  machine, the theme-resolution helper (read storage/`prefers` → theme).
- Everything else validated by `tsc` 0, `next build` green, eslint clean, and the sketch as the visual
  reference (manual smoke: toggle theme, switch settings sections, save → toast, a destructive confirm).
- Verify current `motion` + `next/font` + Tailwind v4 `@theme`/`@custom-variant` APIs in the official docs
  before coding (AGENTS.md rule).

## Risks / notes

- **Biggest, most cross-cutting change in Phase 7** (touches the root layout + global CSS + every future
  surface). Mitigation: it's additive (new files + token swaps); only `/ustawienia` and the nav re-skin change
  behavior; the sketch pins the target; other pages keep working on raw Tailwind utilities (which now resolve
  to tokens where class names overlap — but most use literal `zinc-*` and are untouched until the visual pass).
- Hardcoded `zinc-*`/`white` classes elsewhere will NOT auto-theme (they're literal) — that's fine; they get
  migrated in `page-level-visual-pass`. Dark mode is fully correct only on the surfaces we convert
  (`/ustawienia`, the nav); document this so dark mode isn't mistaken as "done app-wide".
- `next/font` self-hosting removes the CDN dependency and FOUT; confirm Geist Mono is available via
  `next/font/google` (else use the `geist` package).
- Not live-run-dependent (no API key); pure UI.
