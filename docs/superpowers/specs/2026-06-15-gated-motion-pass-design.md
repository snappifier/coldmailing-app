# Gated motion pass (round 3) — design

Date: 2026-06-15
Status: approved by user (interactive demo, all 7 effects selected)
Grounded in: `docs/superpowers/design-references.md` (taste contract), the interactive demo (`gated_motion_pile_interactive_demo` widget), and the `/motion` (React) + `/web-animation-design` skills.

## Goal

The "mockup-gated" pile from the design-references backlog: seven motion/atmosphere additions the user confirmed via a feelable demo. These are the items that needed a visual gate because they add motion (and one adds ambient atmosphere) to a deliberately near-static mono UI. All seven were selected.

Binding constraints carried from the taste contract:
- Accent only MOVES, never expands its surface or glows on hover. The single accent-moving effect is the sliding indicator.
- Lifecycle/status motion uses ONLY status colors (success/warning/danger/neutral) — accent never participates.
- Success spring uses the canonical `SPRING_SETTLE` (`bounce: 0`) — no overshoot.
- Every effect is compositor-only (transform/opacity, or SVG stroke-dashoffset/width which are cheap) and gated by `useReducedMotion` → snaps to final state.
- Data surfaces stay flat; the one bloom is login-only.
- Motion lib: import from `motion/react` in client components; reuse `EASE_OUT_QUART` / `SPRING_SETTLE` from `lib/motion.ts`; never read a MotionValue in render (use `useTransform`); prefer `willChange` only while animating.

No schema/server/behavior change. No new deps (motion already installed). Light+dark parity.

## 1. Sliding active indicator (the one accent-moving effect)

Replace hard-cut active indicators with a shared-element that slides. Motion `layoutId` on a single `<motion.span>` per indicator group: when the active item changes, Motion animates the element from its old to new position.

Sites (all four share the idiom for consistency — once the pattern exists it is trivial; leaving some hard-cut would read inconsistent):
- **`app/(app)/sidebar.tsx`** — the active nav item's `before:bg-accent` left bar becomes a `<motion.span layoutId="nav-active" className="...accent bar...">` rendered ONLY inside the active item. The sidebar is already a client component (`usePathname`); on route change it re-renders with a new active item and the bar slides. NOTE: there are multiple nav groups (Sprzedaż/Treści/Wysyłka + Ustawienia) plus the collapse states — `layoutId` must be unique and the indicator must only animate within the rendered sidebar (it does; the element persists across route changes because the sidebar lives in the layout).
- **`app/(app)/kampanie/[id]/campaign-tabs.tsx`** — the per-button `border-b-2 border-accent` becomes one `<motion.span layoutId="campaign-tab-underline">` 2px bar under the active tab. In-page `useState` change → slides.
- **`app/(app)/ustawienia/settings-shell.tsx`** — the active section `before:bg-accent` rail → `<motion.span layoutId="settings-rail">`.
- **`app/(app)/szablony/templates-shell.tsx`** — the active rail kreska `before:bg-accent` → `<motion.span layoutId="templates-rail">`.

Transition: `layout` spring — reuse `SPRING_SETTLE` (`{type: "spring", visualDuration: 0.25, bounce: 0}`) so it matches the modal morph and never overshoots. `useReducedMotion` → render the bar statically on the active item with `layout={false}` (no slide; instant reposition). The bar keeps `bg-accent`; this is "moving, not adding" — accent surface area is unchanged.

Perf: `layoutId` animations are transform-based (Motion FLIP) — compositor-friendly. No `willChange` needed (Motion manages it).

Accent-allowlist note: still the same sites (sidebar bar, tab underline, settings rail, templates rail) — the guard grep allowlist is unchanged; we only swap the rendering mechanism.

## 2. Count-up on dashboard metrics (first mount only)

New client primitive `components/ui/count-up.tsx`:

```tsx
"use client"
// components/ui/count-up.tsx
import {useEffect, useRef} from "react"
import {animate, motion, useMotionValue, useReducedMotion, useTransform} from "motion/react"
import {EASE_OUT_QUART} from "@/lib/motion"

export function CountUp({value, format}: {value: number; format: (n: number) => string}) {
	const reduce = useReducedMotion()
	const mv = useMotionValue(reduce ? value : 0)
	const text = useTransform(mv, (v) => format(Math.round(v)))
	const done = useRef(false)
	useEffect(() => {
		if (reduce || done.current) {
			mv.set(value) // snap on recalculation / reduced-motion
			done.current = true
			return
		}
		done.current = true
		const controls = animate(mv, value, {duration: 0.5, ease: EASE_OUT_QUART})
		return () => controls.stop()
	}, [value, reduce, mv])
	return <motion.span>{text}</motion.span>
}
```

(First mount animates 0→value; any later `value` change snaps — per the contract "draw-in once, then stay still"; reduced-motion never animates. `format` keeps the existing NBSP/number formatting — the MotionValue is read only inside `useTransform`, never in render.)

Adoption — ONLY plain-integer stats (composite values like "11 · 17%" stay static):
- `app/(app)/dashboard-parts.tsx` `HeroStat` — where the dashboard passes a plain integer formatted via `formatInt`, pass the raw number + `formatInt` to `CountUp`. The hero strip on `app/(app)/page.tsx` builds these; the integer KPIs (e.g. total sends, leads) get count-up, the rate/composite ones do not. `HeroStat`/`MetricStat` gain an optional `countUp?: number` (raw value) — when provided, render `<CountUp value={countUp} format={formatInt} />` instead of the static `value` string; otherwise unchanged.
- Decision rule captured in the plan: a stat is count-up-eligible iff its displayed value is a single integer (no "·", no "%", no "—").

This keeps `dashboard-parts.tsx` a server component except the tiny `CountUp` island.

## 3. Lifecycle status cross-fade (status colors only)

The `Badge` already transitions nothing. Add a CSS transition so a Badge that changes `variant` cross-fades color instead of hard-swapping, plus a brief scale "tick" when the value changes.

- `components/ui/badge.tsx`: add `transition-[background-color,color] duration-300 ease-out` to the base span. Pure CSS, zero JS, server-safe, covered by the global reduced-motion reset. This makes EVERY badge variant change cross-fade — desirable and cheap.
- The "tick" (a ~260ms scale 0.92→1 on change) is only meaningful where a badge updates live in place. The clearest live site is `app/(app)/kampanie/[id]/lead-inbox.tsx` status badges and the lead timeline; however these re-render on server revalidation (full remount), not in-place, so a JS tick needs a client wrapper keyed on the status value. SCOPE DECISION: ship the CSS color cross-fade on `Badge` globally now (it benefits every status change incl. optimistic ones); DEFER the per-change scale "tick" to when a surface updates a badge in place via client state (none today do — the demo's tick was illustrative). The cross-fade is the substance; the tick without an in-place updater would never fire.

Guardrail: lifecycle transitions ride existing status variants (`ok`/`warn`/`bad`/`neutral`) — accent never participates, not even a transitional tint.

## 4. Success checkmark settle (Send / Activate)

A success moment on the two highest-intent actions. New client primitive `components/ui/success-check.tsx` — an inline SVG check whose path draws in (`stroke-dashoffset`) with a subtle scale settle on the `SPRING_SETTLE` curve (no overshoot). Green (`text-success`) — status color, not accent.

- Reuse `CheckIcon` geometry; animate `pathLength` (Motion supports `pathLength` 0→1) on mount, plus a `motion.span` wrapper `scale: [0.9, 1]` with `SPRING_SETTLE`. `useReducedMotion` → render the check statically.
- Adoption: `app/(app)/kampanie/[id]/campaign-header-actions.tsx` (Aktywuj) already toasts on success; ADD a brief inline success-check state on the button (label → check + "Aktywowano" for ~1.2s) before the revalidation settles. The send flow proper is the Inngest worker (no synchronous "Send" button in the UI today); the nearest synchronous success is Activate and the per-step Save — apply to **Activate** (clear high-intent moment) and leave others to toasts. SCOPE: one site (Activate button) now; the pattern (SuccessCheck primitive) is reusable for the Phase-4 send UI.

(Honest note: the demo showed a generic "Wyślij" button; in the real app the equivalent high-intent synchronous action is Activate. We apply there.)

## 5. Draw-in charts (sparkline + funnel, once)

The dashboard Sparkline is a server-rendered SVG and FunnelRow is a width-% bar. Animate both ONCE on first client paint, then static.

- New client wrapper around the existing SVG output. Two options; the plan picks: keep the server-rendered `Sparkline`/`FunnelRow` markup and add a thin **client `DrawIn` wrapper** that, on mount, animates the line's `stroke-dashoffset` (length→0) and the funnel bars' width (0→target) via `animate()` with `EASE_OUT_QUART` (~600ms line, ~500ms bars, tiny stagger). Reduced-motion: render final state immediately (no wrapper effect).
- Cleanest concrete approach: convert `Sparkline` to accept a `client` draw by wrapping the `<path>` stroke in a `motion.path` with `initial={{pathLength: 0}} animate={{pathLength: 1}}` (Motion handles dash math) inside a small client component; FunnelRow bar becomes `motion.span` `initial={{scaleX: 0}} animate={{scaleX: 1}}` with `transform-origin: left` (scaleX is compositor-friendly, avoids animating width/layout). The dashboard sections that render these become/embed client islands.
- Once-only: these mount once per dashboard load; no replay, no loop. The `pathLength`/`scaleX` initial only runs on mount.

Perf: `pathLength` and `scaleX` are compositor-friendly; add `willChange: transform` to the funnel bars during animation only.

## 6. Login bloom (ambient, login-only)

`app/logowanie/page.tsx`: add ONE static radial-gradient bloom behind the login card. A single absolutely-positioned layer inside the `<main>`: `radial-gradient(120% 90% at 50% -10%, var(--accent) ~14% alpha, transparent 60%)`. Static (no animation), CSS only, never on data surfaces. Implement via an inline style or a dedicated token; keep alpha low (~.14 dark / ~.10 light) so it reads as a faint atmospheric wash, not an "AI-slop glow hero." The card and content sit above it (`relative`). Tables/app chrome unaffected.

Guardrail check: this is the single exception to "flat --bg, no glow," confined to the unauthenticated login screen, matching Raycast/Clerk login atmosphere. Confirmed restrained in the demo.

## 7. EmptyState draw-in illustration (line-only)

`components/ui/empty-state.tsx`: gains an optional `illustration` (a line-only SVG, `icons.tsx` stroke 1.8px vocabulary, neutral `text-fg-faint` stroke — NOT a filled/colored spot illustration) that draws in once on mount via `motion.path` `pathLength` 0→1 (~700ms `EASE_OUT_QUART`), reduced-motion renders final. Provide one default inbox/pipeline glyph; `EmptyState` renders it above the title when passed. Existing `EmptyState` callers without an illustration are unchanged.

- Since `EmptyState` is currently a server component used widely, the illustration animation needs a tiny client sub-component (`<EmptyIllustration />`) so most of `EmptyState` stays server. Pass an illustration node; the animated default lives in the client sub-component.
- Adopt the default illustration on the highest-traffic empty states (leady, kampanie, badania empty lists) — opt-in per call so we don't blanket every EmptyState.

## 8. Out of scope / unchanged

- kbd chip + copy-to-clipboard primitives — DEFERRED to Phase 4 (no current consumer; YAGNI per the taste contract). Recorded as an open chip.
- The lifecycle "tick" scale (deferred, §3). Per-row badge ticks wait for an in-place client updater.
- Send-button success-check beyond Activate — waits for the Phase-4 send UI.
- All status colors, tokens, radii, layout, existing server actions, the sending engine.

## 9. Verification

- `tsc` 0, `vitest` green (no new pure logic expected; if `CountUp`'s eligibility helper or any pure formatter is added, TDD it), `eslint` clean on touched dirs (watch `react-hooks` — all MotionValue reads via `useTransform`, no setState-in-effect; the count-up effect cleans up its `animate` controls).
- `npx next build` (coordinate: dev server OFF).
- Guard greps: accent allowlist UNCHANGED in count (the sliding indicators are the same four sites, now `motion.span` with `bg-accent` instead of `before:bg-accent`/`border-accent`); `bg-glow`/`0_0_0_3px`/`shadow-[` still zero; the login bloom uses `var(--accent)` in a gradient on `app/logowanie/page.tsx` — add it to the allowlist as an explicitly-permitted accent atmosphere (login only).
- Manual smoke (user, :3000, both themes + reduced-motion via OS): tab/nav/rail indicators slide (and snap under reduced-motion); dashboard numbers count up once on load and snap on refresh; a status badge change cross-fades; Activate shows the check settle; sparkline+funnel draw in once; login bloom reads restrained; an empty list draws its illustration.

## 10. Implementation notes

- Slices: (1) `lib/motion` already has the tokens; create `components/ui/count-up.tsx` + `success-check.tsx` + the draw-in helpers + EmptyState illustration sub-component (primitives first); (2) sliding indicators (4 sites, layoutId); (3) dashboard count-up + chart draw-in; (4) badge cross-fade + Activate success-check; (5) login bloom + EmptyState adoption; (6) gates + guard greps + ROADMAP. Each slice independently reviewable.
- Reduced-motion is non-negotiable on every effect — copy the established `useReducedMotion` branch shape from `modal.tsx`/`campaign-tabs.tsx`.
- `graphify update .` after code; user pushes; Claude commits.
