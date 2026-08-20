# Pulpit card expand morph — design

Date: 2026-08-20. Status: user-approved (technique A chosen explicitly over the recommended B; entry corrected by the user to a two-beat choreography — sections together, data after).

## Goal

The pulpit's single Card smoothly changes size instead of jumping, on three triggers: page entry (two-beat reveal), the 30s live refresh (new replies/campaigns arrive), and user interaction (collapsible sections + a campaigns-table row limit). **Deferred by decision:** the shared-element morph pulpit → /analytics — /analytics does not exist yet (spec approved, no plan); revisit when it is built.

## Technique — A: Motion `layout` FLIP (user decision)

This exact effect was shipped and REVERTED once (`a8356fa`: the layout-FLIP height morph warped tab content and hairlines). The user picked A anyway, so A ships WITH the full correction set from the Motion layout docs:

- Card `borderRadius` is set via `style` — Motion scale-corrects radius only when set there.
- The Card's 1px `border` is replaced by a **padding-as-border wrapper** (outer `motion.div` with bg `--border` + `p-px`, inner with `bg-surface-1`) — a real border cannot render below 1px mid-scale and shimmers; this is the docs' recommended workaround and addresses the exact `a8356fa` failure.
- Every section is a `MorphSection` (`motion.div layout="position"`): section content and hairline `divide-y` borders are **never scaled**, only translated. A grown section's new rows are revealed by the card edge sweeping over them (overflow-hidden on the card).
- `shadow-card` stays a class; its minor distortion during a morph is accepted (subtle shadow).
- **Fallback clause:** if live smoke still shows warp, MorphCard's internals swap to a measured-height animation (variant B) — one file, the page untouched.

## Components

New client `app/(app)/(pulpit)/dashboard-morph.tsx`:

- **`MorphCard`** — the padding-wrapper + `motion.div layout` pair, `transition={SPRING_SETTLE}`, `useReducedMotion` → `layout={false}`. Children are the sections; `divide-y divide-border` moves to the inner element.
- **`MorphSection`** — `motion.div layout="position"` wrapper for each section.
- **`CollapsibleSection`** — clickable header (existing uppercase label style + `ChevronDownIcon` rotating, mono) for Lejek sprzedaży / Ostatnie odpowiedzi / Kampanie. Content unmounts via `AnimatePresence` (opacity-only exit 130ms, the campaign-tabs idiom); the card FLIPs closed/open. Collapsed state is persisted per section in localStorage via the sidebar's module-store + `useSyncExternalStore` idiom (`getServerSnapshot` → open, so SSR renders open; a persisted-closed section snaps closed on hydration — accepted flash, normally beats the entry reveal).
- **`CampaignsTable`** — the campaigns table moves from the page into this client component with plain serializable row props ({id, name, status, contacted, replied, replyRate, bounced, unsubscribed}); renders 5 rows by default + „Pokaż wszystkie (N)" / „Zwiń" toggle; expansion goes through the same FLIP. Button hidden when N ≤ 5.

`app/(app)/(pulpit)/page.tsx`: `<Card className="divide-y divide-border">` → `<MorphCard>`; sections wrapped in `MorphSection`/`CollapsibleSection`; table JSX replaced by `<CampaignsTable rows={…}>`. `LiveRefresh`, metrics queries, `dashboard-parts`, sparkline internals — untouched (except the sparkline's start delay below).

## Triggers

1. **Live refresh** — `router.refresh()` swaps the RSC payload; MorphCard re-renders, Motion measures before/after and springs to the new height. No additional code path.
2. **Entry — two-beat choreography (user-corrected: no waves):**
   - **Beat 1 (t=0):** ALL below-hero sections (sparkline, funnel+replies, campaigns) expand **simultaneously** via a one-shot CSS `grid-template-rows: 0fr → 1fr` animation (~0.5s, a bounce:0 spring baked into a CSS `linear()` — the exact spark-wipe manoeuvre: pure CSS, SSR/StrictMode-safe, no hydration mismatch, no setState-in-effect). The card grows from the hero strip to full size in ONE motion. The old `pageIn` wave classes on these sections are REMOVED.
   - **Beat 2 (~0.5s, after the box settles):** data paints — the spark-wipe delay moves 0.1s → ~0.5s, funnel bars draw (existing delay ≈ stays), hero count-ups + the reply-% CountUp + the health-stat `fadeIn` shift to start after beat 1. Numbers and charts never animate while the box is still growing.
   - The entry animation and the collapse mechanism are independent (entry = CSS on the outer grid wrapper; collapse = mount/unmount inside), so a persisted-closed section simply grows to header-only height.
3. **Collapse/expand** — header click; content fades 130ms, card FLIPs; state persists across visits.
4. **Table limit** — 5 rows + „Pokaż wszystkie (N)"; expanding/collapsing rides the same FLIP.

## Motion & taste guardrails

- Tokens only: `SPRING_SETTLE` (FLIP), `EASE_OUT_QUART` (fades), one baked spring `linear()` (entry growth, same curve family as `.spark-wipe`). No new curve identities.
- Zero accent: chevrons and headers stay mono; the morph moves no color.
- Reduced motion: `layout={false}`, CSS animations/transitions killed by the existing global reset — sections render open at full size instantly.
- `/motion-audit` on the new component before commit (taste-contract requirement for any shipped animation).

## Out of scope

- pulpit → /analytics shared-element morph (deferred until /analytics exists).
- Any behavior change to LiveRefresh, metrics queries, or Sparkline beyond its start delay.
- Collapse state syncing across devices (localStorage only).

## Testing & gates

- No new pure logic (the collapse store is a trivial module store) → vitest count unchanged.
- `tsc`, `eslint`, `/motion-audit`; `next build` when dev is OFF.
- USER smoke on :3000: entry two-beat (box first, data second), 30s-refresh growth via the dev simulator, collapse persistence across reload, table expand/collapse, reduced-motion snap (OS setting), both themes.
