# Gated motion pass (round 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Read the spec first: `docs/superpowers/specs/2026-06-15-gated-motion-pass-design.md`, and the taste contract `docs/superpowers/design-references.md`.** Animation guidance: the `/motion` (React) and `/web-animation-design` skills — re-read them before Task 3/4/5.

**Goal:** Ship the seven user-approved "gated" motion/atmosphere effects — sliding active indicator, dashboard count-up, status cross-fade, success checkmark settle, chart draw-in, login bloom, EmptyState illustration — to a mono UI, each reduced-motion-safe and compositor-only.

**Architecture:** New small client primitives (`count-up.tsx`, `success-check.tsx`, `empty-illustration.tsx`) + a client chart island (`dashboard-charts.tsx`); existing active-indicator pseudo-elements become Motion `layoutId` shared elements; one CSS transition on `Badge`; one static gradient layer on the login page. All motion reuses `lib/motion.ts` (`EASE_OUT_QUART`, `SPRING_SETTLE` — `bounce: 0`, no overshoot) and gates on `useReducedMotion`.

**Tech Stack:** Next 16 App Router, React 19, Motion (`motion/react`), Tailwind v4. No schema/server/behavior change, no migration, no new deps.

**Conventions (binding):** tabs, no semicolons, path comment line 1 (line 2 after a directive), `className` first, no emoji (geometric glyphs OK). Import Motion from `motion/react` in client files. Never read a MotionValue in render — only via `useTransform`/effects. The USER pushes; you commit per task; NEVER `git push`. Do NOT run `next build` except in Task 7 (dev server must be OFF — coordinate).

## File map

- Create: `components/ui/count-up.tsx` (T1), `components/ui/success-check.tsx` (T5), `components/ui/empty-illustration.tsx` (T6), `app/(app)/dashboard-charts.tsx` (T4)
- Modify: `app/(app)/dashboard-parts.tsx` + `app/(app)/page.tsx` (T1 count-up adoption, T4 chart import move), `components/ui/badge.tsx` (T2), `app/(app)/sidebar.tsx` + `app/(app)/kampanie/[id]/campaign-tabs.tsx` + `app/(app)/ustawienia/settings-shell.tsx` + `app/(app)/szablony/templates-shell.tsx` (T3 indicators), `app/(app)/szablony/templates-shell.tsx` (T5 success-check), `app/logowanie/page.tsx` (T6 bloom), `components/ui/empty-state.tsx` + a few callers (T6), `docs/superpowers/ROADMAP.md` (T7)

No task depends on another except: T4 moves Sparkline/FunnelRow out of `dashboard-parts.tsx`, so do T1 (which edits HeroStat in dashboard-parts) before T4 to avoid overlapping edits. Order T1→T7 as written.

---

### Task 1: CountUp primitive + dashboard adoption

**Files:**
- Create: `components/ui/count-up.tsx`
- Modify: `app/(app)/dashboard-parts.tsx` (HeroStat), `app/(app)/page.tsx` (4 hero stats)

- [ ] **Step 1: create the primitive** — `components/ui/count-up.tsx`:

```tsx
"use client"
// components/ui/count-up.tsx
import {useEffect, useRef} from "react"
import {animate, motion, useMotionValue, useReducedMotion, useTransform} from "motion/react"
import {EASE_OUT_QUART} from "@/lib/motion"
import {formatInt} from "@/features/metrics/compute"

// Counts 0 -> value once on first mount; snaps on later value changes and under reduced motion.
// formatInt (pure NBSP-thousands) is imported, not passed as a prop, because functions are not
// serializable across the server/client boundary. The MotionValue is read only inside useTransform.
export function CountUp({value}: {value: number}) {
	const reduce = useReducedMotion()
	const mv = useMotionValue(reduce ? value : 0)
	const text = useTransform(mv, (v) => formatInt(Math.round(v)))
	const done = useRef(false)
	useEffect(() => {
		if (reduce || done.current) {
			mv.set(value)
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

(Verify `features/metrics/compute.ts` has no server-only import — it is pure logic, safe in a client component. `formatInt` exists there.)

- [ ] **Step 2: HeroStat accepts an optional raw number** — in `app/(app)/dashboard-parts.tsx`, add the import after the existing `ArrowRightIcon` import:

```tsx
import {CountUp} from "@/components/ui/count-up"
```

Replace the `HeroStat` function with:

```tsx
export function HeroStat({label, value, sub, countUp}: {label: string; value: string; sub?: React.ReactNode; countUp?: number}) {
	return (
		<div className="flex flex-col px-5 py-4">
			<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{label}</span>
			<span className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{countUp === undefined ? value : <CountUp value={countUp} />}</span>
			{sub ? <span className="mt-0.5 text-[11px] text-fg-faint">{sub}</span> : null}
		</div>
	)
}
```

- [ ] **Step 3: pass raw integers on the dashboard** — in `app/(app)/page.tsx`, the four `HeroStat`s in the hero strip get a `countUp` prop (raw int; `value` stays as the SSR fallback string):

```tsx
<HeroStat label="Leady" value={formatInt(m.leadsTotal)} countUp={m.leadsTotal} sub={`w ${m.campaignsTotal} kampaniach`} />
<HeroStat label="Wysłane" value={formatInt(m.mailsSent)} countUp={m.mailsSent} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
<HeroStat label="Odpowiedzi" value={formatInt(m.breakdown.replied)} countUp={m.breakdown.replied} sub={<><span className="font-medium text-success">{formatPct(m.rates.replyRate)}</span> wskaźnik</>} />
<HeroStat label="Wygrane" value={formatInt(wonCount)} countUp={wonCount} sub="lejek: Wygrany" />
```

(Only these four — all plain integers. The campaign-page `MetricStat`s include composite "N · M%" values and are intentionally left static.)

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint components/ui/count-up.tsx "app/(app)/dashboard-parts.tsx" "app/(app)/page.tsx"` (clean).

```bash
git add components/ui/count-up.tsx "app/(app)/dashboard-parts.tsx" "app/(app)/page.tsx"
git commit -m "feat(motion): CountUp primitive + dashboard hero count-up on mount (snaps on recalc/reduced-motion)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Badge color cross-fade

**Files:**
- Modify: `components/ui/badge.tsx`

- [ ] **Step 1: add the transition to the base span**

In `components/ui/badge.tsx`, the Badge span className currently starts `"inline-flex h-[21px] items-center gap-1.5 rounded-sm px-2 text-[11.5px] font-medium"`. Add the color transition:

```tsx
		<span className={cn("inline-flex h-[21px] items-center gap-1.5 rounded-sm px-2 text-[11.5px] font-medium transition-[background-color,color] duration-300 ease-out", MAP[variant], className)}>
```

(Pure CSS; every variant change cross-fades; the global `prefers-reduced-motion` reset neutralizes it. No JS, server-safe. The per-change scale "tick" is intentionally deferred — no surface updates a badge in place via client state today.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint components/ui/badge.tsx` (clean).

```bash
git add components/ui/badge.tsx
git commit -m "feat(motion): status Badge cross-fades color on variant change (300ms, CSS-only)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Sliding active indicator (4 sites, layoutId)

**Files:**
- Modify: `app/(app)/sidebar.tsx`, `app/(app)/kampanie/[id]/campaign-tabs.tsx`, `app/(app)/ustawienia/settings-shell.tsx`, `app/(app)/szablony/templates-shell.tsx`

Pattern: the active indicator becomes a single `<motion.span layoutId="...">` rendered only on the active item; Motion FLIPs it between positions. Reuse `SPRING_SETTLE`. Under reduced motion, render a plain `<span>` (no layout animation) so it repositions instantly. Each `layoutId` is unique.

- [ ] **Step 1: sidebar nav bar** — in `app/(app)/sidebar.tsx`:

Add imports (the file already imports from `motion/react`? It does NOT — add):
```tsx
import {motion, useReducedMotion} from "motion/react"
import {SPRING_SETTLE} from "@/lib/motion"
```

`SideLink` currently renders the active bar via a `before:` pseudo on the Link className. Change `SideLink` so it takes `reduce` and renders the bar element. Replace the `SideLink` component with:

```tsx
function SideLink({item, active, labelCls, reduce}: {item: NavItem; active: boolean; labelCls: string; reduce: boolean}) {
	const {Icon} = item
	return (
		<Link
			className={cn(
				"relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
				active ? "text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
			)}
			href={item.href}
			title={item.label}
			aria-current={active ? "page" : undefined}
		>
			{active ? (
				reduce ? (
					<span className="absolute -left-2 bottom-1.5 top-1.5 w-[3px] rounded-r bg-accent" />
				) : (
					<motion.span layoutId="nav-active" className="absolute -left-2 bottom-1.5 top-1.5 w-[3px] rounded-r bg-accent" transition={SPRING_SETTLE} />
				)
			) : null}
			<Icon className="size-[18px] flex-none" />
			<span className={cn("truncate", labelCls)}>{item.label}</span>
		</Link>
	)
}
```

In the `Sidebar` component body, add `const reduce = useReducedMotion()` next to the other hooks, and pass `reduce={reduce}` to BOTH `<SideLink .../>` call sites (the nav-group map and the `SETTINGS_ITEM` one).

- [ ] **Step 2: campaign tabs underline** — in `app/(app)/kampanie/[id]/campaign-tabs.tsx`:

It already imports `motion, useReducedMotion` and `cn`; add `import {SPRING_SETTLE} from "@/lib/motion"`. The `reduce` const already exists. Replace the tab `<button>` block with a relative button that hosts the underline:

```tsx
				{TABS.map((t) => (
					<button
						className={cn(
							"relative px-3 py-2 text-sm transition-colors",
							t.id === active ? "text-fg" : "text-fg-muted hover:text-fg",
						)}
						key={t.id}
						type="button"
						role="tab"
						aria-selected={t.id === active}
						onClick={() => setActive(t.id)}
					>
						{t.label}
						{t.id === "przychodzace" && inboundCount > 0 ? <span className="ml-1.5 text-[11px] text-fg-faint">{inboundCount}</span> : null}
						{t.id === active ? (
							reduce ? (
								<span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
							) : (
								<motion.span layoutId="campaign-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" transition={SPRING_SETTLE} />
							)
						) : null}
					</button>
				))}
```

(Removes the old `-mb-px border-b-2 border-accent/border-transparent` approach; the underline is now the moving span over the container's `border-b`.)

- [ ] **Step 3: settings rail** — in `app/(app)/ustawienia/settings-shell.tsx`:

It imports `motion, useReducedMotion` already; add `import {SPRING_SETTLE} from "@/lib/motion"`. Add `const reduce = useReducedMotion()` if not present (it is — used for the AnimatePresence). The section `<button>` active branch uses `before:` rail classes. Change the button className active branch to drop the `before:*` and render a span. Replace the button with:

```tsx
					<button
						key={s.id}
						type="button"
						aria-current={s.id === active ? "true" : undefined}
						onClick={() => setActive(s.id)}
						className={cn(
							"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150",
							s.id === active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
						)}
					>
						{s.id === active ? (
							reduce ? (
								<span className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" />
							) : (
								<motion.span layoutId="settings-rail" className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" transition={SPRING_SETTLE} />
							)
						) : null}
						{s.label}
					</button>
```

- [ ] **Step 4: templates rail** — in `app/(app)/szablony/templates-shell.tsx`:

Add imports:
```tsx
import {motion, useReducedMotion} from "motion/react"
import {SPRING_SETTLE} from "@/lib/motion"
```
Add `const reduce = useReducedMotion()` inside `TemplatesShell` (near the other hooks). The rail `<button>` active branch uses the same `before:` kreska classes. Replace the rail button's className + add the span. The current button className active branch is `"bg-surface-2 text-fg before:absolute before:-left-px before:top-1/2 before:h-[15px] before:w-[2.5px] before:-translate-y-1/2 before:rounded before:bg-accent"`. Change to drop the `before:*` and render a span as the FIRST child inside the button:

```tsx
							<button
								className={cn(
									"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
									active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
								)}
								key={t.id}
								type="button"
								aria-current={active ? "true" : undefined}
								onClick={() => switchTo(t.id)}
							>
								{active ? (
									reduce ? (
										<span className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" />
									) : (
										<motion.span layoutId="templates-rail" className="absolute -left-px top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded bg-accent" transition={SPRING_SETTLE} />
									)
								) : null}
								<span className="flex items-center justify-between gap-2">
									<span className="truncate">{t.name}</span>
									{active && dirty ? <span className="size-[5px] flex-none rounded-full bg-warning" aria-label="Niezapisane zmiany" /> : null}
								</span>
								{meta ? <span className="block truncate text-[10px] text-fg-faint">{meta}</span> : null}
							</button>
```

(This preserves the existing rail content — name, dirty dot, meta — and only swaps the `before:` bar for the layoutId span. Confirm the surrounding `.map` variables `active`, `dirty`, `meta`, `t` match the current file; adjust names if they differ.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint "app/(app)/sidebar.tsx" "app/(app)/kampanie/[id]/campaign-tabs.tsx" "app/(app)/ustawienia/settings-shell.tsx" "app/(app)/szablony/templates-shell.tsx"` (clean). Grep the accent allowlist is intact (now `bg-accent` on motion.span instead of `before:bg-accent`): `rg -n "bg-accent" app` should show the four indicator sites + switch + mailbox chips (no `before:bg-accent` left).

```bash
git add "app/(app)/sidebar.tsx" "app/(app)/kampanie/[id]/campaign-tabs.tsx" "app/(app)/ustawienia/settings-shell.tsx" "app/(app)/szablony/templates-shell.tsx"
git commit -m "feat(motion): sliding active indicator via layoutId - sidebar nav, campaign tabs, settings + templates rails

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Chart draw-in (sparkline + funnel)

**Files:**
- Create: `app/(app)/dashboard-charts.tsx`
- Modify: `app/(app)/dashboard-parts.tsx` (remove Sparkline + FunnelRow), `app/(app)/page.tsx` (import them from dashboard-charts)

- [ ] **Step 1: create the client chart island** — `app/(app)/dashboard-charts.tsx` (move Sparkline + FunnelRow here, motion-ized):

```tsx
"use client"
// app/(app)/dashboard-charts.tsx
import {motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {buildSparklinePath, type DailyCount} from "@/features/metrics/compute"
import {EASE_OUT_QUART} from "@/lib/motion"

// Sparkline: the line draws in once via pathLength; the area fades in. Static after mount.
export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const reduce = useReducedMotion()
	const {line, area, end} = buildSparklinePath(daily.map((d) => d.count), 600, 64)
	if (!line) return null
	return (
		<svg className={className} viewBox="0 0 600 64" preserveAspectRatio="none" role="img" aria-label="Wysłane maile dziennie, ostatnie 30 dni">
			<defs>
				<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
					<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<motion.path d={area} fill="url(#spark-fill)" initial={reduce ? false : {opacity: 0}} animate={{opacity: 1}} transition={{duration: 0.6, delay: 0.12, ease: "easeOut"}} />
			<motion.path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 0.6, ease: EASE_OUT_QUART}} />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--text)" /> : null}
		</svg>
	)
}

export function FunnelRow({label, count, max, tone = "neutral"}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"}) {
	const reduce = useReducedMotion()
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<motion.span className={cn("absolute inset-y-0 left-0 origin-left rounded-full", fill)} style={{width: `${pct}%`}} initial={reduce ? false : {scaleX: 0}} animate={{scaleX: 1}} transition={{duration: 0.5, ease: EASE_OUT_QUART}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}
```

(Animating `pathLength` and `scaleX` is compositor-friendly; the bar keeps its `width: pct%` and grows from `scaleX: 0` with `origin-left`. Reduced motion → `initial={false}` renders the final state.)

- [ ] **Step 2: remove Sparkline + FunnelRow from `dashboard-parts.tsx`**

Delete the `Sparkline` and `FunnelRow` exports from `app/(app)/dashboard-parts.tsx` (the two functions and any now-unused imports: `buildSparklinePath` and the `DailyCount` type if no longer used there — keep `relativeTimePl` and `RecentReply` which `ReplyRow` still uses). Verify the remaining imports compile.

- [ ] **Step 3: import them from the island in `page.tsx`**

In `app/(app)/page.tsx`, change line 11 from:
```tsx
import {HeroStat, HealthStat, Sparkline, FunnelRow, ReplyRow} from "./dashboard-parts"
```
to:
```tsx
import {HeroStat, HealthStat, ReplyRow} from "./dashboard-parts"
import {Sparkline, FunnelRow} from "./dashboard-charts"
```

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint "app/(app)/dashboard-charts.tsx" "app/(app)/dashboard-parts.tsx" "app/(app)/page.tsx"` (clean).

```bash
git add "app/(app)/dashboard-charts.tsx" "app/(app)/dashboard-parts.tsx" "app/(app)/page.tsx"
git commit -m "feat(motion): dashboard sparkline + funnel draw in once on mount (client island, reduced-motion safe)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: SuccessCheck primitive + templates Save adoption

**Files:**
- Create: `components/ui/success-check.tsx`
- Modify: `app/(app)/szablony/templates-shell.tsx`

(Spec said "Activate", but the Activate button UNMOUNTS on success — status flips to ACTIVE and the header swaps to Pauza, so a check there can't settle. The templates editor Save button persists after save and already has success handling, so the check lands there. The primitive stays reusable for the Phase-4 send UI.)

- [ ] **Step 1: create the primitive** — `components/ui/success-check.tsx`:

```tsx
"use client"
// components/ui/success-check.tsx
import {motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"

// Green success check: path draws in, wrapper settles with bounce:0 (no overshoot).
export function SuccessCheck({className}: {className?: string}) {
	const reduce = useReducedMotion()
	return (
		<motion.span className={className} style={{display: "inline-flex"}} initial={reduce ? false : {scale: 0.9}} animate={{scale: 1}} transition={SPRING_SETTLE}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
				<motion.path d="M20 6L9 17l-5-5" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 0.28, ease: EASE_OUT_QUART}} />
			</svg>
		</motion.span>
	)
}
```

- [ ] **Step 2: show it briefly on a successful save** — in `app/(app)/szablony/templates-shell.tsx`:

Add imports:
```tsx
import {useState} from "react" // already imported - ensure useState is in the import
import {SuccessCheck} from "@/components/ui/success-check"
```
Add a transient success flag. Near the other `useState` calls add:
```tsx
	const [saved, setSaved] = useState(false)
```
In BOTH `useActionState` wrappers (create and update), inside the `if (res?.ok) {` block, after the existing toast/snapshot lines, add a brief flash:
```tsx
				setSaved(true)
				setTimeout(() => setSaved(false), 1400)
```
Change the submit Button content to show the check when `saved`:
```tsx
						<Button className="w-44 justify-center" variant="primary" type="submit" disabled={pending}>
							{saved ? <><SuccessCheck className="text-success" />Zapisano</> : effectiveId ? "Zapisz zmiany" : "Zapisz szablon"}
						</Button>
```

(`setTimeout` in an action wrapper is fine — it is an event-driven side effect, not a render effect. The check is green `text-success`, status color, not accent.)

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint components/ui/success-check.tsx "app/(app)/szablony/templates-shell.tsx"` (clean).

```bash
git add components/ui/success-check.tsx "app/(app)/szablony/templates-shell.tsx"
git commit -m "feat(motion): SuccessCheck (path-draw + bounce:0 settle) on template save - reusable for Phase-4 send UI

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Login bloom + EmptyState illustration

**Files:**
- Create: `components/ui/empty-illustration.tsx`
- Modify: `app/logowanie/page.tsx`, `components/ui/empty-state.tsx`, plus 2-3 empty-state callers

- [ ] **Step 1: login bloom** — in `app/logowanie/page.tsx`, the `<main>` is `mx-auto flex min-h-screen w-full max-w-[360px] flex-col justify-center gap-5 p-6`. Make it `relative` and add a static gradient layer as its first child (content sits above via the existing flow; add `relative z-10` to the brand wordmark row OR wrap content — simplest: give the layer `-z-10`). Change the `<main className=...>` to add `relative isolate` and insert as the first child:

```tsx
		<main className="relative isolate mx-auto flex min-h-screen w-full max-w-[360px] flex-col justify-center gap-5 p-6">
			<div className="pointer-events-none absolute inset-0 -z-10" style={{background: "radial-gradient(120% 80% at 50% 0%, var(--accent-quiet), transparent 60%)"}} />
```

(Uses `--accent-quiet` — the already-low-alpha accent tint — as a single static radial wash behind the login only. `isolate` + `-z-10` keep it behind content. No animation. Data surfaces untouched.)

- [ ] **Step 2: EmptyState illustration sub-component** — `components/ui/empty-illustration.tsx`:

```tsx
"use client"
// components/ui/empty-illustration.tsx
import {motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART} from "@/lib/motion"

// Line-only inbox glyph, draws in once. Neutral stroke (text-fg-faint), 1.8px icon vocabulary.
export function EmptyIllustration() {
	const reduce = useReducedMotion()
	return (
		<svg className="mx-auto mb-3 text-fg-faint" width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<motion.path d="M8 18 L18 18 L21 24 L27 24 L30 18 L40 18 L40 38 L8 38 Z M12 12 L36 12" initial={reduce ? false : {pathLength: 0}} animate={{pathLength: 1}} transition={{duration: 0.7, ease: EASE_OUT_QUART}} />
		</svg>
	)
}
```

- [ ] **Step 3: EmptyState accepts an illustration** — in `components/ui/empty-state.tsx`:

```tsx
// components/ui/empty-state.tsx
export function EmptyState({title, description, action, illustration}: {title: string; description?: string; action?: React.ReactNode; illustration?: React.ReactNode}) {
	return (
		<div className="px-5 py-12 text-center">
			{illustration ?? null}
			<h3 className="text-sm font-medium text-fg">{title}</h3>
			{description ? <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-fg-muted">{description}</p> : null}
			{action ? <div className="mt-4 flex justify-center">{action}</div> : null}
		</div>
	)
}
```

- [ ] **Step 4: adopt on the high-traffic empty lists** — pass `illustration={<EmptyIllustration />}` to the `EmptyState` in the leads list and the campaigns/research empty states. Concretely, in `app/(app)/leady/page.tsx` (the leads-empty `EmptyState`) add the import `import {EmptyIllustration} from "@/components/ui/empty-illustration"` and add the `illustration` prop. Find the `<EmptyState` calls in `app/(app)/leady/page.tsx`, `app/(app)/kampanie/page.tsx`, `app/(app)/badania/page.tsx` and add `illustration={<EmptyIllustration />}` to each top-level "nothing yet" state (leave secondary EmptyStates like 404/timeline as-is). Add the import to each file touched.

(If a given page has no plain "empty list" EmptyState, skip it — do not force the illustration onto every EmptyState; opt-in only.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` (exit 0); `npx eslint app/logowanie/page.tsx components/ui/empty-state.tsx components/ui/empty-illustration.tsx "app/(app)/leady/page.tsx" "app/(app)/kampanie/page.tsx" "app/(app)/badania/page.tsx"` (clean).

```bash
git add app/logowanie/page.tsx components/ui/empty-state.tsx components/ui/empty-illustration.tsx "app/(app)/leady/page.tsx" "app/(app)/kampanie/page.tsx" "app/(app)/badania/page.tsx"
git commit -m "feat(motion): login bloom (static accent-quiet wash) + EmptyState draw-in line illustration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Gates, guard greps, graphify, ROADMAP

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: gates**
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → all pass (no new pure tests expected; same count as before this round — confirm the number against the prior run)
- `npx eslint app components` → clean on touched code (the two pre-existing `any` test-mock files in `features/` are the documented exception, outside this scope)
- `npx next build` → success. The dev server MUST be OFF; if `.next`/port is locked, STOP and report (do not kill processes).

- [ ] **Step 2: guard greps**
- `rg -n "accent" app components --glob "!*.css"` → the allowlist sites only: sidebar (logo dot `text-accent` + the layoutId `bg-accent` bar), settings-shell (`bg-accent` rail), templates-shell (`bg-accent` rail), campaign-tabs (`bg-accent` underline), switch.tsx (`bg-accent`), checkbox.tsx (`checked:bg-accent`), mailbox-settings-form.tsx (day-chip trio), logowanie/page.tsx (logo dot `text-accent` + the `--accent-quiet` bloom). Anything else = failure.
- `rg -n "before:bg-accent" app` → ZERO (the rails/bars are now motion.span, not pseudo-elements).
- `rg -n "bg-glow|0_0_0_3px|shadow-\[" app components` → zero.

- [ ] **Step 3: graphify** — `graphify update .` (AST-only; non-blocking if missing).

- [ ] **Step 4: ROADMAP** — flip the `▶ NEXT TASK` block in `docs/superpowers/ROADMAP.md` to record `gated-motion-pass` DONE + verified, and set the next task to the user's live both-themes + reduced-motion smoke. Keep the prior `templates-campaign-polish` / `design-refinement` history intact below it. Include: the 7 effects shipped, that reduced-motion snaps everything, the deferred items (kbd/copy chip + the lifecycle "tick" + send-button success-check → Phase 4), and the still-open pre-launch items (team-role smoke, funded ANTHROPIC_API_KEY runs, deploy).

- [ ] **Step 5: commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: gated-motion-pass DONE - 7 motion/atmosphere effects shipped, reduced-motion-safe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

## Self-review notes (for the executor)

- **Server/client boundaries:** `CountUp`, `dashboard-charts` (Sparkline/FunnelRow), `SuccessCheck`, `EmptyIllustration` are `"use client"`. They are imported into server components (`dashboard-parts`, `page.tsx`, `empty-state`) — that creates client islands, which is correct. Do NOT pass functions across the boundary (that is why `CountUp` imports `formatInt` itself).
- **layoutId across routes (sidebar):** the sidebar lives in `app/(app)/layout.tsx` and persists across route changes, so the `layoutId="nav-active"` bar FLIPs between items on navigation. If it ever fails to animate, confirm the sidebar is not remounting.
- **Reduced motion:** every new effect branches on `useReducedMotion()` (or, for Badge, the global CSS reset). Verify by toggling the OS setting.
- **Accent discipline:** the only accent that MOVES is the indicator (moving, not adding). The success check is `text-success` (green), lifecycle uses status colors, charts are neutral (`var(--text)`/`bg-fg-muted`), the login bloom is `--accent-quiet` confined to the login page. No new decorative accent fills.
- **No new deps, no migration, no server/behavior change.** Pure presentation + motion.
