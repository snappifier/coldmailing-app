# Pulpit Card Expand Morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The pulpit's single Card smoothly changes size (Motion layout FLIP with the full anti-warp correction set) on live refresh, collapse/expand, and table expand — plus a two-beat entry: all below-hero sections grow simultaneously, THEN charts/numbers paint.

**Architecture:** One new client file `app/(app)/(pulpit)/dashboard-morph.tsx` (MorphCard/MorphSection/CollapsibleSection/CampaignsTable) wraps the existing server-rendered sections. FLIP corrections per the Motion docs + the `a8356fa` revert lesson: `borderRadius` via `style`, card border as a padding-wrapper, sections `layout="position"`, `LayoutGroup` so child-state changes re-measure the card. Entry growth is a one-shot CSS `grid-template-rows 0fr→1fr` (spark-wipe manoeuvre — SSR/StrictMode-safe, no setState-in-effect).

**Tech Stack:** Next 16 RSC + client islands, Motion (`motion/react`: layout, layoutId-free FLIP, AnimatePresence, LayoutGroup), Tailwind v4 tokens, CSS `linear()` baked spring.

**Conventions (MANDATORY):** tabs, no semicolons, `className` first, `import {x}` no inner spaces, NO emoji, Polish UI strings, NO file-path comments. Commits: `scope: lowercase one-line description`, no trailers, never push. Dev server is the USER's.

**Spec:** `docs/superpowers/specs/2026-08-20-pulpit-expand-morph-design.md` (user-approved — binding; technique A is the user's explicit decision over the recommended B).

**Existing facts the plan relies on (verified 2026-08-20):**
- `app/(app)/(pulpit)/page.tsx` — the Card: hero strip / sparkline section / funnel+replies 2-col grid / campaigns table, `divide-y divide-border`, pageIn wave classes at `.55s`/`.62s`/`.95s`, HealthStat fadeIn at `1.55s`, reply-% `CountUp delay={0.26}`, FunnelRow `delay={0.6}`.
- `app/(app)/dashboard-parts.tsx:21` — `HeroStat` count-up delay `0.1 + index * 0.08`.
- `app/globals.css:84` — `.spark-wipe` bakes a bounce:0 spring `linear()` at 1900ms with `.1s both` delay.
- `app/(app)/sidebar.tsx:22-34` — the module-store + `useSyncExternalStore` localStorage idiom (server snapshot = default, no hydration mismatch, no setState-in-effect).
- `components/ui/icons.tsx` exports `ChevronDownIcon` (used by NumberInput).
- `components/ui/count-up.tsx` — `CountUp` accepts `delay` (seconds); entrance is invisible until delay elapses.
- `lib/motion.ts` — `SPRING_SETTLE = {type: "spring", visualDuration: 0.25, bounce: 0}`, `EASE_OUT_QUART`.
- `Badge`, `CAMPAIGN_STATUS_LABEL/_VARIANT`, `formatInt`/`formatPct` are all client-safe imports (pure/presentational).
- vitest baseline: 271 passing; eslint clean except the 2 documented `any` test-mock files.

---

### Task 1: CSS — shared spring linear() + entry growth keyframes + beat-2 retime

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Extract the baked spring into a custom property and add the growth animation**

In `:root` (after the `--selection` line) add the shared curve (the exact point list currently inline in `.spark-wipe`):

```css
	--spring-linear: linear(0, 0.0082, 0.03, 0.0619, 0.101, 0.145, 0.192, 0.2407, 0.2899, 0.3386, 0.3863, 0.4324, 0.4765, 0.5186, 0.5582, 0.5955, 0.6304, 0.6629, 0.6931, 0.7209, 0.7466, 0.7703, 0.792, 0.8118, 0.83, 0.8465, 0.8616, 0.8753, 0.8878, 0.899, 0.9093, 0.9185, 0.9268, 0.9344, 0.9412, 0.9473, 0.9528, 0.9578, 0.9622, 0.9662, 0.9698, 0.973, 0.9759, 0.9785, 0.9808, 0.9829, 0.9848, 0.9864, 0.9879, 0.9892, 0.9904, 0.9915, 0.9924, 0.9932, 0.994, 0.9947, 0.9952, 0.9958, 0.9962, 0.9967, 0.997, 0.9974, 1);
```

In `@layer base`, next to the existing keyframes, add:

```css
	@keyframes pulpitGrow { from { grid-template-rows: 0fr; } to { grid-template-rows: 1fr; } }
	/* Entry beat 1: every below-hero pulpit section expands SIMULTANEOUSLY (480ms of the same
	   bounce:0 spring as the sparkline wipe); beat 2 (charts/numbers) starts at .55s. */
	.pulpit-grow { animation: pulpitGrow 480ms var(--spring-linear) both; }
```

Then replace the `.spark-wipe` rule so it consumes the variable AND starts after beat 1 (delay `.1s` → `.55s`):

```css
	.spark-wipe { animation: sparkWipe 1900ms var(--spring-linear) .55s both; }
```

(The keyframes `sparkWipe`, `fadeIn`, `pageIn` etc. stay untouched. `pageIn` remains — other routes use it via `template.tsx`.)

- [ ] **Step 2: Verify**

Run: `grep -c "spring-linear" app/globals.css` → 3 (declaration + 2 uses). No commit yet — single commit in Task 4.

---

### Task 2: `dashboard-morph.tsx` — MorphCard, MorphSection, CollapsibleSection, CampaignsTable

**Files:**
- Create: `app/(app)/(pulpit)/dashboard-morph.tsx`

- [ ] **Step 1: Create the file (verbatim)**

```tsx
"use client"
import {useState, useSyncExternalStore} from "react"
import Link from "next/link"
import {AnimatePresence, LayoutGroup, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {cn} from "@/lib/cn"
import {Badge} from "@/components/ui/badge"
import {ChevronDownIcon} from "@/components/ui/icons"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import type {CampaignStatus} from "@/generated/prisma/client"

// Collapse store: one localStorage JSON object keyed by section id, read through
// useSyncExternalStore (server snapshot = open) - the sidebar collapse idiom, so SSR renders
// everything expanded, a persisted-closed section snaps shut on hydration, and there is no
// setState-in-effect. The snapshot is a primitive boolean per section, so it stays stable.
const PULPIT_KEY = "pulpit-collapsed"
let listeners: (() => void)[] = []
let cache: Record<string, boolean> | null = null
function subscribeCollapse(cb: () => void) {
	listeners = [...listeners, cb]
	return () => { listeners = listeners.filter((l) => l !== cb) }
}
function readAll(): Record<string, boolean> {
	if (cache) return cache
	try { cache = JSON.parse(localStorage.getItem(PULPIT_KEY) ?? "{}") as Record<string, boolean> } catch { cache = {} }
	return cache
}
function setCollapsed(id: string, v: boolean) {
	cache = {...readAll(), [id]: v}
	try { localStorage.setItem(PULPIT_KEY, JSON.stringify(cache)) } catch { /* private mode */ }
	for (const l of listeners) l()
}

// Technique A - Motion layout FLIP - with the full anti-warp correction set (spec + the a8356fa
// revert lesson): borderRadius via style (Motion scale-corrects it only there), the card's 1px
// border replaced by a padding-as-border wrapper (a real border cannot render below 1px mid-scale
// and shimmers), sections counter-corrected via layout="position" so hairlines and content never
// scale. LayoutGroup makes collapse/expand state changes INSIDE a section re-measure the card -
// without it a child-only re-render would never trigger the card's FLIP.
// Fallback clause (spec): if live smoke still warps, swap these internals to a measured-height
// animation - the page contract (children as sections) stays identical.
export function MorphCard({children}: {children: React.ReactNode}) {
	const reduce = useReducedMotion()
	const t = reduce ? {duration: 0} : SPRING_SETTLE
	return (
		<LayoutGroup>
			<motion.div className="bg-border p-px shadow-card" layout={!reduce} style={{borderRadius: 8}} transition={t}>
				<motion.div className="divide-y divide-border overflow-hidden bg-surface-1" layout={!reduce} style={{borderRadius: 7}} transition={t}>
					{children}
				</motion.div>
			</motion.div>
		</LayoutGroup>
	)
}

// grow: wraps the content in the one-shot entry expansion (CSS grid-template-rows 0fr -> 1fr).
// The hero section omits it - the card starts at hero height and grows from there.
export function MorphSection({className, grow, children}: {className?: string; grow?: boolean; children: React.ReactNode}) {
	const reduce = useReducedMotion()
	return (
		<motion.div className={className} layout={reduce ? false : "position"} transition={reduce ? {duration: 0} : SPRING_SETTLE}>
			{grow ? (
				<div className="pulpit-grow grid">
					<div className="min-h-0 overflow-hidden">{children}</div>
				</div>
			) : (
				children
			)}
		</motion.div>
	)
}

// Clickable uppercase header + fade-out/in content. Sequence on collapse: content fades 130ms,
// AnimatePresence removes it, the removal render triggers the card FLIP shut (LayoutGroup).
export function CollapsibleSection({id, label, children}: {id: string; label: string; children: React.ReactNode}) {
	const reduce = useReducedMotion()
	const collapsed = useSyncExternalStore(subscribeCollapse, () => readAll()[id] === true, () => false)
	return (
		<div>
			<button
				className="group mb-2 flex w-full items-center justify-between gap-2 text-left"
				type="button"
				aria-expanded={!collapsed}
				onClick={() => setCollapsed(id, !collapsed)}
			>
				<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint transition-colors group-hover:text-fg-muted">{label}</span>
				<ChevronDownIcon className={cn("size-3.5 text-fg-faint transition-transform duration-200", collapsed && "-rotate-90")} />
			</button>
			<AnimatePresence initial={false}>
				{!collapsed ? (
					<motion.div
						initial={reduce ? false : {opacity: 0}}
						animate={{opacity: 1}}
						exit={{opacity: 0}}
						transition={{duration: reduce ? 0 : 0.13, ease: EASE_OUT_QUART}}
					>
						{children}
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}

export interface CampaignRowData {
	id: string
	name: string
	status: CampaignStatus
	contacted: string
	replied: string
	replyPct: string
	barPct: number
	bounced: string
	unsubscribed: string
}

const TABLE_LIMIT = 5

// The campaigns table, moved from the page so the 5-row limit can be client state; expanding
// rides the same LayoutGroup FLIP as everything else. Markup is byte-equal to the old server table.
export function CampaignsTable({rows}: {rows: CampaignRowData[]}) {
	const [expanded, setExpanded] = useState(false)
	const shown = expanded ? rows : rows.slice(0, TABLE_LIMIT)
	return (
		<>
			<table className="w-full text-[13px]">
				<thead>
					<tr className="border-b border-border-strong text-left text-[10px] uppercase tracking-[.05em] text-fg-faint">
						<th className="pb-2 pr-3 font-semibold">Kampania</th>
						<th className="pb-2 pr-3 font-semibold">Status</th>
						<th className="pb-2 pr-3 text-right font-semibold">Skontaktowani</th>
						<th className="pb-2 pr-3 font-semibold">Odpowiedzi</th>
						<th className="pb-2 pr-3 text-right font-semibold">Odbicia</th>
						<th className="pb-2 text-right font-semibold">Rezygnacje</th>
					</tr>
				</thead>
				<tbody>
					{shown.map((c) => (
						<tr className="border-b border-border last:border-b-0" key={c.id}>
							<td className="py-2 pr-3"><Link className="text-fg font-medium hover:underline underline-offset-2" href={`/kampanie/${c.id}`}>{c.name}</Link></td>
							<td className="py-2 pr-3"><Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge></td>
							<td className="py-2 pr-3 text-right tabular-nums">{c.contacted}</td>
							<td className="py-2 pr-3">
								<span className="inline-flex items-center gap-2">
									<span className="tabular-nums">{c.replied} <span className="text-fg-muted">· {c.replyPct}</span></span>
									<span className="relative h-[3px] w-[52px] overflow-hidden rounded-full bg-surface-3">
										<span className="absolute inset-y-0 left-0 rounded-full bg-fg" style={{width: `${c.barPct}%`}} />
									</span>
								</span>
							</td>
							<td className="py-2 pr-3 text-right tabular-nums">{c.bounced}</td>
							<td className="py-2 text-right tabular-nums">{c.unsubscribed}</td>
						</tr>
					))}
				</tbody>
			</table>
			{rows.length > TABLE_LIMIT ? (
				<button className="mt-2 text-[12px] text-fg-muted transition-colors hover:text-fg hover:underline underline-offset-2" type="button" onClick={() => setExpanded((e) => !e)}>
					{expanded ? "Zwiń" : `Pokaż wszystkie (${rows.length})`}
				</button>
			) : null}
		</>
	)
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` → 0. `npx eslint "app/(app)/(pulpit)/dashboard-morph.tsx"` → clean.

---

### Task 3: Wire the page + beat-2 retimes

**Files:**
- Modify: `app/(app)/(pulpit)/page.tsx`
- Modify: `app/(app)/dashboard-parts.tsx:21` (HeroStat count-up base delay)

- [ ] **Step 1: Retime HeroStat**

In `dashboard-parts.tsx` line 21, count-ups now start after beat 1 (`0.1` → `0.55`):

```tsx
			<span className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{countUp === undefined ? value : <CountUp value={countUp} delay={0.55 + index * 0.08} />}</span>
```

- [ ] **Step 2: Rewire the page**

In `page.tsx`: replace the `Card` import line with the morph imports (Card is no longer used on this page):

```tsx
import {MorphCard, MorphSection, CollapsibleSection, CampaignsTable} from "./dashboard-morph"
```

(Remove `import {Card} from "@/components/ui/card"`; keep `Badge` REMOVED too — the table moved out — but keep `Link` only if still used: after this change the page no longer renders `Link`/`Badge`/`CAMPAIGN_STATUS_*` directly, so drop those imports as well.)

Add the row mapping after `funnelMax`:

```tsx
	const campaignRows = m.campaigns.map((c) => ({
		id: c.id,
		name: c.name,
		status: c.status as CampaignStatus,
		contacted: formatInt(c.contacted),
		replied: formatInt(c.replied),
		replyPct: formatPct(c.replyRate),
		barPct: Math.min(100, Math.round((c.replyRate ?? 0) * 1000)),
		bounced: formatInt(c.bounced),
		unsubscribed: formatInt(c.unsubscribed),
	}))
```

(`CampaignStatus` type import stays.) Then replace the whole `<Card className="divide-y divide-border">…</Card>` block with:

```tsx
			<MorphCard>
				<MorphSection>
					<div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
						<HeroStat label="Leady" value={formatInt(m.leadsTotal)} countUp={m.leadsTotal} index={0} sub={`w ${m.campaignsTotal} kampaniach`} />
						<HeroStat label="Wysłane" value={formatInt(m.mailsSent)} countUp={m.mailsSent} index={1} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
						<HeroStat label="Odpowiedzi" value={formatInt(m.breakdown.replied)} countUp={m.breakdown.replied} index={2} sub={<><span className="font-medium text-success">{m.rates.replyRate === null ? formatPct(null) : <CountUp value={m.rates.replyRate * 100} decimals={1} suffix="%" delay={0.71} />}</span> wskaźnik</>} />
						<HeroStat label="Wygrane" value={formatInt(wonCount)} countUp={wonCount} index={3} sub="lejek: Wygrany" />
					</div>
				</MorphSection>

				<MorphSection grow>
					<div className="px-5 py-4">
						<div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Wysłane maile · dziennie</span>
							{/* Beat 2 tail: enters only after the hero count-ups perceptually finish (last stat: .79s start + 1.2s spring). */}
							<span className="flex flex-wrap gap-4 [animation:fadeIn_.6s_var(--ease-out)_2s_both]">
								<HealthStat color="bg-danger" label="odbicia" value={`${formatInt(m.breakdown.bounced)} · ${formatPct(m.rates.bounceRate)}`} />
								<HealthStat color="bg-warning" label="rezygnacje" value={`${formatInt(m.breakdown.unsubscribed)} · ${formatPct(m.rates.unsubRate)}`} />
								<HealthStat color="bg-fg-faint" label="błędy" value={formatInt(m.breakdown.failed)} />
							</span>
						</div>
						<Sparkline className="h-16 w-full" daily={daily} />
					</div>
				</MorphSection>

				<MorphSection grow>
					<div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
						<div className="px-5 py-4">
							<CollapsibleSection id="lejek" label="Lejek sprzedaży">
								{m.funnel.map((f, i) => (
									<FunnelRow key={f.stage} index={i} delay={0.6} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "neutral"} />
								))}
							</CollapsibleSection>
						</div>
						<div className="px-5 py-4">
							<CollapsibleSection id="odpowiedzi" label="Ostatnie odpowiedzi">
								{replies.length === 0 ? (
									<p className="text-sm text-fg-muted">Brak odpowiedzi.</p>
								) : (
									replies.map((r) => <ReplyRow key={`${r.campaignLeadId}-${r.at.getTime()}`} reply={r} now={now} />)
								)}
							</CollapsibleSection>
						</div>
					</div>
				</MorphSection>

				<MorphSection grow>
					<div className="px-5 py-4">
						<CollapsibleSection id="kampanie" label="Kampanie">
							{campaignRows.length === 0 ? <p className="text-sm text-fg-muted">Brak kampanii.</p> : <CampaignsTable rows={campaignRows} />}
						</CollapsibleSection>
					</div>
				</MorphSection>
			</MorphCard>
```

Notes: the three `[animation:pageIn_…]` classes and the two `mb-2 …uppercase…` label divs are GONE (labels live in CollapsibleSection headers now); the sparkline section keeps a plain label span. The empty-state early return and the closing footnote `<p>` stay byte-identical.

- [ ] **Step 3: Gates**

Run: `npx tsc --noEmit` → 0; `npx eslint "app/(app)/(pulpit)/" "app/(app)/dashboard-parts.tsx"` → clean; `npx vitest run` → 271 passing (unchanged).
Guard greps: `grep -c "pageIn" "app/(app)/(pulpit)/page.tsx"` → 0; `grep -c "MorphSection" "app/(app)/(pulpit)/page.tsx"` → 5 (4 sections + import).

---

### Task 4: Motion audit, ROADMAP, single commit

- [ ] **Step 1: Motion audit** — run the `/motion-audit` skill on `app/(app)/(pulpit)/dashboard-morph.tsx` + the globals.css additions (taste-contract gate). Expected: FLIP transforms + opacity fades + one CSS grid-rows entry = the only layout-property animation is the deliberate one-shot entry (accepted: runs once at mount on a single card). Fix anything it flags at C or worse before committing.
- [ ] **Step 2: `next build`** — ONLY if dev is OFF (`curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:3000` → non-200/307). Otherwise record "build deferred (dev running)" in the ROADMAP line.
- [ ] **Step 3: `graphify update .`** — expect the semantic-graph refusal (AST cache refresh only); note it.
- [ ] **Step 4: ROADMAP** — add the pulpit-expand-morph DONE line (spec/plan paths, technique-A decision + fallback clause, timings, deferred analytics morph, user-smoke checklist: entry two-beat, 30s refresh growth via the dev simulator, collapse persistence across reload, table expand, reduced-motion, both themes).
- [ ] **Step 5: Single commit**

```bash
git add app/globals.css "app/(app)/(pulpit)/dashboard-morph.tsx" "app/(app)/(pulpit)/page.tsx" "app/(app)/dashboard-parts.tsx" docs/superpowers/ROADMAP.md graphify-out/cache
git commit -m "pulpit: card expand morph - FLIP with anti-warp corrections, two-beat entry, collapsible sections, table limit"
```

- [ ] **Step 6: USER smoke (manual, not yours):** on :3000 — entry (box grows once, THEN charts/numbers), simulator-driven refresh growth, collapse each section + reload persistence, „Pokaż wszystkie", reduced-motion snap, both themes. Fallback clause stands: warp → variant B inside dashboard-morph.tsx.
