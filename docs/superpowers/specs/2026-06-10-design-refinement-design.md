# Design Refinement — mono UI + Linear micro-accent (design)

Date: 2026-06-10
Status: approved by user (brainstorm with visual mocks; all forks user-picked)
Mocks: `.superpowers/brainstorm/5958-1781087764/content/` — `accent-directions.html` (picked A mono), `accent-micro-color.html` (refined to micro map), `accent-linear.html` (picked dark-mode variant), `focus-style.html` (picked variant 1)

## Goal

The user's brief: "mniej glow i bardziej minimalistyczny akcent, żeby nie wyglądało jak AI slop, i dopracować wszystko co zostało" — less glow, a far more minimal accent, and finish the remaining rough surfaces (login, route states, modal/toast/confirm shadows, dead tokens).

Approved direction, in one sentence: a monochrome UI where the accent color survives only as three micro-signals — the logo dot, the active-tab bar, and on/checked controls — in Linear's indigo, with hairline neutral focus instead of the 3px glow.

This is a pure-presentation change: zero behavior, server, schema, or form-contract changes. No migration. Light and dark themes stay at parity (dark remains the default).

## Decisions (user-picked)

1. **Direction:** mono UI (mock variant A). Links, badges, progress, charts lose color; only statuses (success/danger/warning) stay colored.
2. **Accent surface ("mega minimal"):** accent appears ONLY on: logo dot, active-tab bar (sidebar + settings-section rail), Switch ON + checked day chips, and the keyboard `:focus-visible` outline on buttons/links (transient, a11y; suppressed on form controls — see §4 correction).
3. **Accent color:** Linear indigo — light theme `#5E6AD2`, dark theme `#828FFF` (Linear's own dark-mode lift of the same brand hue).
4. **Input focus:** variant 1 — 1px border brightens to a neutral "border-focus" color + background lifts surface-2 → surface-1. No box-shadow of any kind.

## 1. Token changes (`app/globals.css`)

Light (`:root`):

- `--accent: #5E6AD2`
- `--accent-quiet: rgba(94,106,210,.10)`
- `--ring: rgba(94,106,210,.45)`
- NEW `--border-focus: rgba(9,9,11,.45)`
- NEW `--selection: rgba(9,9,11,.12)`
- DELETE `--bg-glow`

Dark (`[data-theme="dark"]`):

- `--accent: #828FFF`
- `--accent-quiet: rgba(130,143,255,.14)`
- `--ring: rgba(130,143,255,.60)`
- NEW `--border-focus: rgba(255,255,255,.55)`
- NEW `--selection: rgba(255,255,255,.16)`
- DELETE `--bg-glow`

`@theme inline` block:

- ADD `--color-border-focus: var(--border-focus)` (enables `border-border-focus`, `focus:border-border-focus`).
- ADD static shadow scale: `--shadow-modal: 0 16px 48px -16px rgba(0,0,0,.5)` and `--shadow-pop: 0 8px 24px -12px rgba(0,0,0,.35)` (enables `shadow-modal` / `shadow-pop`). Same values both themes (black-alpha shadows are theme-safe).
- AUDIT `--color-ring`: if no `ring-*`/`text-ring`/`border-ring` class references it anywhere, remove the `@theme` export (keep the raw `--ring` var — `:focus-visible` uses it directly).

`@layer base`:

- `::selection { background: var(--selection) }` (was `--accent-quiet`).
- `:focus-visible` rule unchanged (2px solid `var(--ring)`) — keyboard-only accent outline is deliberate (a11y; invisible on click).
- ADD `@keyframes confirmIn` — `from { opacity: 0; transform: scale(.96) translateY(8px) }` to none (used by the Confirm dialog, see §5). The existing global `prefers-reduced-motion` reset already neutralizes it.

`--accent-quiet` survives for exactly one consumer family: checked day chips (`peer-checked:bg-accent-quiet`). Everything else that used it goes neutral (see §3).

## 2. Canonical link recipes (replaces `text-accent` links)

Two recipes, applied app-wide:

- **Data links** (row titles, entity names, table cell links): `text-fg font-medium hover:underline underline-offset-2`. Sites currently on `text-accent` or `hover:text-accent`: `/leady` row links, dashboard campaigns table links (`hover:text-accent` → `hover:underline`), `/kampanie` + `/badania` list title links, batch-view lead links.
- **Secondary action links** (back links, aux actions): `text-fg-muted hover:text-fg hover:underline underline-offset-2`. Sites: `← Leady` (import), `← Kampanie` (campaign detail), `← Badania` (batch page), `← Leady` (lead detail back link), `Importuj` (leady header), `Nowy szablon` (szablony header anchor), `Importuj z CSV →` (lead wizard), `Anuluj` (import wizard), `+ Dodaj wiersz` (lead-edit-form custom fields), the `/skrzynki` link inside sending-controls note.

Underline on hover is the affordance; no color. `font-medium` already present on most data links.

## 3. Accent strip map (file by file)

KEEP accent (the complete allowlist):

- `app/globals.css` — token definitions, `--ring` in `:focus-visible`.
- `app/(app)/sidebar.tsx` — logo dot `text-accent`; active item `before:bg-accent` bar (the rest of the active treatment is unchanged except the icon color — see strip list).
- `app/(app)/ustawienia/settings-shell.tsx` — active section `before:bg-accent` rail.
- `components/ui/switch.tsx` — checked `bg-accent`.
- `app/(app)/skrzynki/mailbox-settings-form.tsx` — day chips `peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent`.

STRIP accent:

- `app/(app)/sidebar.tsx`: active icon `text-accent` → remove (icon inherits item color); avatar `bg-accent text-primary-fg` → `bg-surface-3 text-fg`.
- `components/ui/badge.tsx`: `info` variant → `bg-surface-3 text-fg border border-border` (keys/API unchanged; neutral keeps `text-fg-muted` so info still reads one step stronger).
- `components/ui/note.tsx`: `info` variant → `bg-surface-2 text-fg-muted border-border` (warning unchanged).
- `app/(app)/dashboard-parts.tsx`: sparkline stroke/end-dot `var(--accent)` → `var(--text)`; gradient stops `var(--accent)` → `var(--text)` with top opacity lowered to `.12`; `FunnelBar` default tone `bg-accent` → `bg-fg-muted` (won/lost unchanged).
- `app/(app)/page.tsx`: reply-rate mini bar `bg-accent` → `bg-fg`; campaign link hover per §2.
- `app/(app)/leady/import/import-wizard.tsx` + `app/(app)/leady/lead-create-button.tsx`: step progress bars `bg-accent` → `bg-fg`.
- `app/(app)/skrzynki/page.tsx`: "odpowiedzi: on" pill `bg-accent-quiet text-accent` → `bg-surface-3 text-fg-muted`.
- `app/(app)/pipeline/board.tsx`: drag-over `bg-accent-quiet` → `bg-surface-3`.
- All link sites per §2.
- `components/ui/input.tsx`, `select.tsx`, `textarea.tsx`: per §4.

## 4. Focus treatment (Input / Select / Textarea)

In all three primitives:

- DROP `focus:[box-shadow:0_0_0_3px_var(--accent-quiet)]` — no shadow, nothing replaces it.
- `focus:border-accent` → `focus:border-border-focus`.
- `focus:bg-surface-1` stays; hover `border-border-strong` stays.
- Transition property list drops `box-shadow`: `transition-[border-color,background] duration-150`.
- `focus:outline-none` → `focus:outline-hidden` (same visual, plus a forced-colors fallback outline for Windows High Contrast).

Correction (found in review): on Input/Select/Textarea the global `:focus-visible` ring is intentionally SUPPRESSED by the outline utility (utilities layer beats the base-layer rule) — and that is the only coherent option, because text controls match `:focus-visible` on mouse focus too, which would repaint the accent ring on every click. Keyboard and mouse share the hairline treatment on form controls; the global 2px accent `:focus-visible` outline remains the keyboard indicator for buttons and links only.

## 5. Shadow scale + Confirm entrance (Modal / Confirm / Toast / dropdown)

- `components/ui/modal.tsx`: panel `shadow-[0_24px_64px_-24px_rgba(0,0,0,.8)]` → `shadow-modal`.
- `components/ui/confirm.tsx`: add `shadow-modal` to the dialog panel; add CSS-only entrance — `[&[open]]:[animation:confirmIn_.2s_var(--ease-out-quart)]` (or equivalent arbitrary-variant syntax verified at impl) + backdrop unchanged. Exit stays instant (native `close()`), matching "exit can be faster" and zero-JS constraint. Grounded in web-animation-design: entering element → ease-out, 200ms (modal class), transform+opacity only, global reduced-motion reset covers it.
- `components/ui/toast-provider.tsx`: `shadow-[0_8px_24px_-16px_rgba(0,0,0,.4)]` → `shadow-pop` (toastIn animation untouched).
- `app/(app)/sidebar.tsx` account dropdown: `shadow-[0_12px_32px_-16px_rgba(0,0,0,.6)]` → `shadow-pop`.
- Guard: after the change, zero arbitrary `shadow-[` literals remain in `app/(app)` + `components/ui` (the two tokens are the only shadow vocabulary).

## 6. Login page rebuild (`app/logowanie/page.tsx`)

Server component, same auth flow (session check + `signIn("google", {redirectTo: "/leady"})` server action). New presentation:

- Flat `--bg` page, centered column `max-w-[360px]`.
- Brand row: accent dot `●` + `cold·mail` wordmark (same idiom as sidebar logo).
- `Card` with: `h1` "Zaloguj się" (`text-[15px] font-semibold tracking-[-0.02em]`), description `text-[12.5px] text-fg-muted` ("Wewnętrzne narzędzie cold mailingu. Dostęp przez konto Google."), full-width submit button composed from the secondary Button classes (import `Button` directly — it has no "use client" directive) with an inline monochrome Google "G" SVG (`currentColor`, stroke/fill mono — no brand colors, consistent with mono UI).
- Footnote under the card: `text-[11.5px] text-fg-faint` "Dostęp tylko dla zaproszonych kont."
- No ThemeToggle pre-auth; the page follows the resolved theme like every other page.

## 7. Route-state pass (loading / error / not-found)

- `app/(app)/loading.tsx`: Spinner + stacked caption `Wczytywanie…` (`text-[12.5px] text-fg-faint`), centered, `gap-3`.
- `app/(app)/error.tsx`: keep Card + retry; add a secondary action link "Wróć do pulpitu" (`href="/"`, secondary link recipe) next to the retry Button.
- `app/(app)/not-found.tsx` and `app/not-found.tsx`: align both to one quiet pattern — title, one-line description, secondary link back to `/` (read current content at impl; keep copy Polish, no behavior change).

## 8. Out of scope / unchanged

- Button variants (primary stays neutral white/graphite), status colors, Badge `ok`/`warn`/`bad`, all spacing/layout, the binding creation-ux motion spec (modal enter/exit, wizard morph), Table/Card/EmptyState primitives, all server code, all form contracts.
- Research category badges (`/badania` kind chips) already use the shared label map — they keep their current tints (status-like, not accent).
- No new dependencies.

## 9. Verification

- `tsc` 0, `vitest` green (no count change expected — presentation only; `button-variants`/labels suites unaffected), `eslint` clean on touched dirs, **`npx next build`** (dev server confirmed OFF — this also closes the twice-deferred build gate).
- Guard greps (all must hold):
  - `accent` usages in `app/` + `components/` exactly match the §3 allowlist.
  - `0_0_0_3px` / focus box-shadow → zero hits.
  - `bg-glow` → zero hits.
  - arbitrary `shadow-[` in `app/(app)` + `components/ui` → zero hits (only `shadow-modal`/`shadow-pop`).
- User eyeball on :3000 in BOTH themes (toggle in sidebar): login, dashboard (sparkline/funnel), leady list links, import wizard step bar, skrzynki chips + switch, pipeline drag-over, a Confirm dialog, a Toast.

## 10. Implementation notes

- Slice the work: (1) tokens + primitives (input/select/textarea/badge/note/switch stays/modal/confirm/toast), (2) sidebar + settings-shell + links sweep, (3) dashboard parts + wizards + pipeline + skrzynki, (4) login + route states, (5) gates + guard greps. Each slice is independently reviewable; no cross-slice coupling beyond tokens landing first.
- `graphify update .` after code changes (AST-only). Spec/plan additions would need `graphify . --obsidian`, which requires the unset `GEMINI_API_KEY` — skip unless the key appears.
- The user pushes; Claude may commit.
