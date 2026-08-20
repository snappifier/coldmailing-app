# Pulpit card expand morph — design

Date: 2026-08-20. Status: user-approved (technique A chosen explicitly over the recommended B). **Revised repeatedly same day after live use. Final: (1) the box-growth entry was dropped; (2) entry = two-beat on fades — lejek/odpowiedzi/kampanie together at .1s, data (charts/numbers) from ~.55s; (3) the "whole pulpit jumps on F5" symptom was NOT the simultaneity — it was the collapsible content SSR-ing with inline opacity:0 (an AnimatePresence initial fix gone wrong) popping in at hydration; fixed by restoring initial={false} and moving the funnel-bar entrance to CSS. The size morph fires ONLY on events.**

## Goal

The pulpit's single Card smoothly changes size instead of jumping, on its EVENTS: the 30s live refresh (new replies/campaigns arrive) and user interaction (collapsible sections + a campaigns-table row limit). Page entry is a two-beat choreography on opacity fades — the card is full-size from the first frame (no growth). **Deferred by decision:** the shared-element morph pulpit → /analytics — /analytics does not exist yet (spec approved, no plan); revisit when it is built.

## Technique — A: Motion `layout` FLIP (user decision)

This exact effect was shipped and REVERTED once (`a8356fa`: the layout-FLIP height morph warped tab content and hairlines). The user picked A anyway, so A ships WITH the full correction set from the Motion layout docs:

- Card `borderRadius` is set via `style` — Motion scale-corrects radius only when set there.
- The Card's 1px `border` is replaced by a **padding-as-border wrapper** (outer `motion.div` with bg `--border` + `p-px`, inner with `bg-surface-1`) — a real border cannot render below 1px mid-scale and shimmers; this is the docs' recommended workaround and addresses the exact `a8356fa` failure.
- Every section is a `MorphSection` (`motion.div layout="position"`): section content and hairline `divide-y` borders are **never scaled**, only translated. A grown section's new rows are revealed by the card edge sweeping over them (overflow-hidden on the card).
- `shadow-card` stays a class; its minor distortion during a morph is accepted (subtle shadow).
- `CountUp` wraps `AnimateNumber` in `LayoutGroup inherit={false}` — digit layout animations must never join the card's LayoutGroup, or every digit re-render re-measures the card mid-entry (while pageIn transforms are live) and plays a phantom position correction after the entrance settles.
- **Fallback clause:** if live smoke still shows warp, MorphCard's internals swap to a measured-height animation (variant B) — one file, the page untouched.

## Components

New client `app/(app)/(pulpit)/dashboard-morph.tsx`:

- **`MorphCard`** — the padding-wrapper + `motion.div layout` pair, `transition={SPRING_SETTLE}`, `useReducedMotion` → `layout={false}`. Children are the sections; `divide-y divide-border` moves to the inner element.
- **`MorphSection`** — `motion.div layout="position"` wrapper for each section.
- **`CollapsibleSection`** — clickable header (existing uppercase label style + `ChevronDownIcon` rotating, mono) for Lejek sprzedaży / Ostatnie odpowiedzi / Kampanie. Content unmounts via `AnimatePresence` (opacity-only exit 130ms, the campaign-tabs idiom); the card FLIPs closed/open. Collapsed state is persisted per section in a COOKIE (module store + `useSyncExternalStore` for reactivity): the page reads the cookie server-side and SSRs a persisted-collapsed section CLOSED (`defaultCollapsed` prop = the server snapshot), so hydration never re-closes it — the earlier localStorage version animated the section shut after every hard reload (a whole-panel jump). The same cookie treatment was applied to the sidebar's `nav-collapsed` (its post-hydration width snap shifted the entire content area on F5).
- **`CampaignsTable`** — the campaigns table moves from the page into this client component with plain serializable row props ({id, name, status, contacted, replied, replyRate, bounced, unsubscribed}); renders 5 rows by default + „Pokaż wszystkie (N)" / „Zwiń" toggle; expansion goes through the same FLIP. Button hidden when N ≤ 5.

`app/(app)/(pulpit)/page.tsx`: `<Card className="divide-y divide-border">` → `<MorphCard>`; sections wrapped in `MorphSection`/`CollapsibleSection`; table JSX replaced by `<CampaignsTable rows={…}>`. `LiveRefresh`, metrics queries, `dashboard-parts`, sparkline internals — untouched (except the sparkline's start delay below).

## Triggers

1. **Live refresh** — `router.refresh()` swaps the RSC payload; MorphCard re-renders, Motion measures before/after and springs to the new height. No additional code path.
2. **Entry — two-beat on fades (final):** the card is full-size instantly (on first mount Motion `layout` does not animate, so MorphCard is inert at entry by construction; the earlier `.pulpit-grow` box-growth mechanism was removed after live use). Beat 1: lejek / odpowiedzi / kampanie fade in TOGETHER via `pageIn` at one shared `.1s` delay. Beat 2 (~`.55s`): data paints TOGETHER — spark-wipe delay `.55s`, hero count-ups `0.55 + i·0.08`, reply-% CountUp `0.71`, funnel bars `0.55 + i·0.09` (a CSS `.funnel-grow` animation on the PAINT clock — a Motion `initial` entrance would be suppressed by the collapsible section's `AnimatePresence initial={false}` and hydration-clocked besides), health-stat `fadeIn` at `2s`. `AnimatePresence initial={false}` is LOAD-BEARING: without it the content SSRs with inline `opacity:0` and every hard reload paints the sections empty until hydration pops them in (the "whole pulpit jumps on F5" symptom). FunnelRow keeps the `funnelEntryPlayed` latch so a re-expanded Lejek draws bars immediately instead of replaying the 0.6s entry delay.
3. **Collapse/expand** — header click; content fades 130ms, card FLIPs; state persists across visits.
4. **Table limit** — 5 rows + „Pokaż wszystkie (N)"; expanding/collapsing rides the same FLIP.

## Motion & taste guardrails

- Tokens only: `SPRING_SETTLE` (FLIP), `EASE_OUT_QUART` (fades). No new curve identities.
- Zero accent: chevrons and headers stay mono; the morph moves no color.
- Reduced motion: `layout={false}`, CSS animations/transitions killed by the existing global reset — sections render open at full size instantly.
- `/motion-audit` on the new component before commit (taste-contract requirement for any shipped animation).

## Out of scope

- pulpit → /analytics shared-element morph (deferred until /analytics exists).
- Any behavior change to LiveRefresh, metrics queries, or Sparkline internals.
- Collapse state syncing across devices (localStorage only).

## Testing & gates

- No new pure logic (the collapse store is a trivial module store) → vitest count unchanged.
- `tsc`, `eslint`, `/motion-audit`; `next build` when dev is OFF.
- USER smoke on :3000: entry two-beat (three sections together, then charts/numbers), 30s-refresh growth via the dev simulator, collapse persistence across reload, table expand/collapse, reduced-motion snap (OS setting), both themes.
