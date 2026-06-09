# dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An org-wide pulpit at `/` (KPIs + sales funnel + campaigns table) and a per-campaign metrics block on `/kampanie/[id]`, all derived from existing data (no open/click tracking, no migration).

**Architecture:** Pure metric math first (`features/metrics/compute.ts`, TDD), then thin org-scoped Prisma queries (`features/metrics/queries.ts`), then two read-only server-rendered surfaces. Rate denominator = "contacted" (assigned minus PENDING/SKIPPED/FAILED). Spec: `docs/superpowers/specs/2026-06-09-phase-7-dashboards-design.md`.

**Tech Stack:** Next 16 (App Router, server components), Prisma 7 (`groupBy` with `_count:{_all:true}`), Vitest 4, TypeScript 6. Reuses `STAGE_ORDER`/`STAGE_LABEL` from `features/pipeline/types`.

**Conventions:** tabs, no semicolons, `"use client"` only where needed (these are server components — none needed), path comment on line 1, `className` first, `import {x}` no inner spaces, NO emoji.

---

## Task 1: Pure metric logic (TDD)

**Files:**
- Create: `features/metrics/compute.ts`
- Test: `features/metrics/compute.test.ts`

- [ ] **Step 1: Write the failing test** (`features/metrics/compute.test.ts`):

```ts
// features/metrics/compute.test.ts
import {describe, it, expect} from "vitest"
import {summarizeStatuses, contacted, rate, computeRates, formatPct, formatInt, buildCampaignRows, orderFunnel} from "@/features/metrics/compute"

describe("summarizeStatuses", () => {
	it("buckets counts, defaults missing to 0, sums total", () => {
		const b = summarizeStatuses([{status: "REPLIED", count: 3}, {status: "PENDING", count: 5}, {status: "DONE", count: 2}])
		expect(b).toMatchObject({replied: 3, pending: 5, done: 2, bounced: 0, total: 10})
	})
})

describe("contacted", () => {
	it("excludes pending, skipped, failed", () => {
		const b = summarizeStatuses([{status: "PENDING", count: 5}, {status: "SKIPPED", count: 2}, {status: "FAILED", count: 1}, {status: "ACTIVE", count: 4}, {status: "REPLIED", count: 3}, {status: "DONE", count: 1}])
		expect(contacted(b)).toBe(8) // 4+3+1
	})
})

describe("rate", () => {
	it("divides, null on zero denominator", () => {
		expect(rate(7, 100)).toBeCloseTo(0.07)
		expect(rate(0, 0)).toBeNull()
		expect(rate(5, 0)).toBeNull()
	})
})

describe("computeRates", () => {
	it("derives reply/bounce/unsub rates against contacted", () => {
		const b = summarizeStatuses([{status: "PENDING", count: 180}, {status: "SKIPPED", count: 10}, {status: "FAILED", count: 10}, {status: "DONE", count: 372}, {status: "REPLIED", count: 28}])
		const r = computeRates(b)
		expect(r.contacted).toBe(400)
		expect(r.replyRate).toBeCloseTo(0.07)
	})
})

describe("formatPct / formatInt", () => {
	it("formats percentages with a Polish comma and dash on null", () => {
		expect(formatPct(0.0703)).toBe("7,0%")
		expect(formatPct(0)).toBe("0,0%")
		expect(formatPct(null)).toBe("—")
	})
	it("groups thousands with a non-breaking space", () => {
		expect(formatInt(1312)).toBe("1 312")
		expect(formatInt(42)).toBe("42")
		expect(formatInt(1000000)).toBe("1 000 000")
	})
})

describe("buildCampaignRows", () => {
	it("merges per-campaign status rows, preserves order, defaults missing", () => {
		const rows = buildCampaignRows(
			[{id: "c1", name: "A", status: "ACTIVE"}, {id: "c2", name: "B", status: "DRAFT"}],
			[{campaignId: "c1", status: "REPLIED", count: 2}, {campaignId: "c1", status: "DONE", count: 8}, {campaignId: "c1", status: "PENDING", count: 90}],
		)
		expect(rows[0]).toMatchObject({id: "c1", name: "A", contacted: 10, replied: 2})
		expect(rows[0].replyRate).toBeCloseTo(0.2)
		expect(rows[1]).toMatchObject({id: "c2", contacted: 0, replied: 0, replyRate: null})
	})
})

describe("orderFunnel", () => {
	it("orders by STAGE_ORDER, defaulting missing stages to 0", () => {
		const f = orderFunnel({NEW: 120, WON: 7})
		expect(f.map((x) => x.stage)).toEqual(["NEW", "AUDIT", "PROPOSAL", "MEETING", "OFFER", "WON", "LOST"])
		expect(f[0]).toEqual({stage: "NEW", count: 120})
		expect(f.find((x) => x.stage === "AUDIT")).toEqual({stage: "AUDIT", count: 0})
	})
})
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run features/metrics/compute.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `features/metrics/compute.ts`:

```ts
// features/metrics/compute.ts
import type {CampaignLeadStatus, DealStage} from "@/generated/prisma/client"
import {STAGE_ORDER} from "@/features/pipeline/types"

export interface StatusBreakdown {
	pending: number; active: number; replied: number; bounced: number
	unsubscribed: number; skipped: number; failed: number; done: number; total: number
}
export interface Rates {
	contacted: number
	replyRate: number | null
	bounceRate: number | null
	unsubRate: number | null
}
export interface CampaignRow {
	id: string; name: string; status: string
	contacted: number; replied: number; bounced: number; unsubscribed: number; replyRate: number | null
}

const KEY: Record<CampaignLeadStatus, keyof StatusBreakdown> = {
	PENDING: "pending", ACTIVE: "active", REPLIED: "replied", BOUNCED: "bounced",
	UNSUBSCRIBED: "unsubscribed", SKIPPED: "skipped", FAILED: "failed", DONE: "done",
}

export function summarizeStatuses(rows: {status: CampaignLeadStatus; count: number}[]): StatusBreakdown {
	const b: StatusBreakdown = {pending: 0, active: 0, replied: 0, bounced: 0, unsubscribed: 0, skipped: 0, failed: 0, done: 0, total: 0}
	for (const r of rows) {
		b[KEY[r.status]] += r.count
		b.total += r.count
	}
	return b
}

export function contacted(b: StatusBreakdown): number {
	return b.total - b.pending - b.skipped - b.failed
}

export function rate(numerator: number, denominator: number): number | null {
	return denominator > 0 ? numerator / denominator : null
}

export function computeRates(b: StatusBreakdown): Rates {
	const c = contacted(b)
	return {contacted: c, replyRate: rate(b.replied, c), bounceRate: rate(b.bounced, c), unsubRate: rate(b.unsubscribed, c)}
}

export function formatPct(r: number | null): string {
	if (r === null) return "—"
	return `${(r * 100).toFixed(1).replace(".", ",")}%`
}

export function formatInt(n: number): string {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function buildCampaignRows(
	campaigns: {id: string; name: string; status: string}[],
	statusRows: {campaignId: string; status: CampaignLeadStatus; count: number}[],
): CampaignRow[] {
	const byCampaign = new Map<string, {status: CampaignLeadStatus; count: number}[]>()
	for (const r of statusRows) {
		const arr = byCampaign.get(r.campaignId) ?? []
		arr.push({status: r.status, count: r.count})
		byCampaign.set(r.campaignId, arr)
	}
	return campaigns.map((c) => {
		const b = summarizeStatuses(byCampaign.get(c.id) ?? [])
		const cc = contacted(b)
		return {id: c.id, name: c.name, status: c.status, contacted: cc, replied: b.replied, bounced: b.bounced, unsubscribed: b.unsubscribed, replyRate: rate(b.replied, cc)}
	})
}

export function orderFunnel(counts: Partial<Record<DealStage, number>>): {stage: DealStage; count: number}[] {
	return STAGE_ORDER.map((stage) => ({stage, count: counts[stage] ?? 0}))
}
```

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx vitest run features/metrics/compute.test.ts` — Expected: PASS. Then `npx tsc --noEmit` — Expected: 0.
- [ ] **Step 5: Commit.**

```bash
git add features/metrics/compute.ts features/metrics/compute.test.ts
git commit -m "feat(phase7): pure metrics compute helpers (TDD)"
```

---

## Task 2: Metrics queries

**Files:**
- Create: `features/metrics/queries.ts`

- [ ] **Step 1: Implement** `features/metrics/queries.ts`:

```ts
// features/metrics/queries.ts
import {prisma} from "@/lib/prisma"
import type {DealStage} from "@/generated/prisma/client"
import {summarizeStatuses, computeRates, buildCampaignRows, orderFunnel, type StatusBreakdown, type Rates, type CampaignRow} from "@/features/metrics/compute"

export interface OrgMetrics {
	leadsTotal: number
	campaignsTotal: number
	campaignsActive: number
	mailsSent: number
	breakdown: StatusBreakdown
	rates: Rates
	funnel: {stage: DealStage; count: number}[]
	campaigns: CampaignRow[]
}

export async function getOrgMetrics(orgId: string): Promise<OrgMetrics> {
	const [leadsTotal, campaigns, mailsSent, statusGroups, dealGroups, campaignStatusGroups] = await Promise.all([
		prisma.lead.count({where: {organizationId: orgId}}),
		prisma.campaign.findMany({where: {organizationId: orgId}, select: {id: true, name: true, status: true}, orderBy: {createdAt: "desc"}}),
		prisma.message.count({where: {organizationId: orgId, direction: "OUTBOUND", status: "SENT"}}),
		prisma.campaignLead.groupBy({by: ["status"], where: {campaign: {organizationId: orgId}}, _count: {_all: true}}),
		prisma.lead.groupBy({by: ["dealStage"], where: {organizationId: orgId}, _count: {_all: true}}),
		prisma.campaignLead.groupBy({by: ["campaignId", "status"], where: {campaign: {organizationId: orgId}}, _count: {_all: true}}),
	])

	const breakdown = summarizeStatuses(statusGroups.map((g) => ({status: g.status, count: g._count._all})))
	const funnelCounts: Partial<Record<DealStage, number>> = {}
	for (const g of dealGroups) funnelCounts[g.dealStage] = g._count._all
	const campaignRows = buildCampaignRows(campaigns, campaignStatusGroups.map((g) => ({campaignId: g.campaignId, status: g.status, count: g._count._all})))

	return {
		leadsTotal,
		campaignsTotal: campaigns.length,
		campaignsActive: campaigns.filter((c) => c.status === "ACTIVE").length,
		mailsSent,
		breakdown,
		rates: computeRates(breakdown),
		funnel: orderFunnel(funnelCounts),
		campaigns: campaignRows,
	}
}

export interface CampaignMetrics {
	breakdown: StatusBreakdown
	rates: Rates
	mailsSent: number
}

export async function getCampaignMetrics(campaignId: string, orgId: string): Promise<CampaignMetrics | null> {
	const campaign = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {id: true}})
	if (!campaign) return null
	const [statusGroups, mailsSent] = await Promise.all([
		prisma.campaignLead.groupBy({by: ["status"], where: {campaignId}, _count: {_all: true}}),
		prisma.message.count({where: {campaignLead: {campaignId}, direction: "OUTBOUND", status: "SENT"}}),
	])
	const breakdown = summarizeStatuses(statusGroups.map((g) => ({status: g.status, count: g._count._all})))
	return {breakdown, rates: computeRates(breakdown), mailsSent}
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0. (If the Prisma `groupBy` `_count` shape errors, confirm it matches `features/research/batch-actions.ts:84` which uses `_count: {_all: true}` -> `g._count._all`.)
- [ ] **Step 3: Commit.**

```bash
git add features/metrics/queries.ts
git commit -m "feat(phase7): org + per-campaign metrics queries"
```

---

## Task 3: Pulpit at `/` (move into the (app) shell) + nav

**Files:**
- Delete: `app/page.tsx`
- Create: `app/(app)/page.tsx`
- Create: `app/(app)/dashboard-parts.tsx`
- Modify: `app/(app)/layout.tsx` (add the nav link)

- [ ] **Step 1: Remove the old redirect.** Run: `git rm app/page.tsx` (it only did `redirect("/leady")`; `/` now renders the dashboard inside the `(app)` shell).

- [ ] **Step 2: Add the nav link.** In `app/(app)/layout.tsx`, prepend `["/", "Pulpit"]` to the `LINKS` array so it reads:

```tsx
const LINKS: [string, string][] = [
	["/", "Pulpit"],
	["/leady", "Leady"], ["/pipeline", "Pipeline"], ["/linie", "Linie usług"], ["/szablony", "Szablony"],
	["/placeholdery", "Placeholdery"], ["/badania", "Badania"], ["/kampanie", "Kampanie"], ["/skrzynki", "Skrzynki"],
	["/suppression", "Suppression"], ["/ustawienia", "Ustawienia"],
]
```
(`NavLink` marks `/` active only when `pathname === "/"`, so it does not light up on other routes.)

- [ ] **Step 3: Create the presentational parts** `app/(app)/dashboard-parts.tsx`:

```tsx
// app/(app)/dashboard-parts.tsx
import {cn} from "@/lib/cn"
import type {DealStage} from "@/generated/prisma/client"

const TONE: Record<string, string> = {up: "text-success", warn: "text-warning", bad: "text-danger", muted: "text-fg-faint"}

export function Kpi({label, value, sub, tone = "muted"}: {label: string; value: string; sub?: string; tone?: "up" | "warn" | "bad" | "muted"}) {
	return (
		<div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-3.5">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
			{sub ? <span className={cn("text-xs", TONE[tone])}>{sub}</span> : null}
		</div>
	)
}

export function FunnelBar({stage, label, count, max}: {stage: DealStage; label: string; count: number; max: number}) {
	const pct = max > 0 ? Math.round((count / max) * 100) : 0
	const color = stage === "WON" ? "bg-success" : stage === "LOST" ? "bg-danger/60" : "bg-accent/85"
	return (
		<div className="grid grid-cols-[88px_1fr_40px] items-center gap-2 text-sm">
			<span className="text-fg-muted">{label}</span>
			<span className="flex h-[18px] items-center">
				<span className={cn("h-full rounded", color)} style={{width: `${pct}%`}} />
			</span>
			<span className="text-right tabular-nums">{count}</span>
		</div>
	)
}

export function MetricStat({label, value}: {label: string; value: string}) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-base font-semibold tabular-nums">{value}</span>
		</div>
	)
}
```

- [ ] **Step 4: Create the dashboard** `app/(app)/page.tsx`:

```tsx
// app/(app)/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {getOrgMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {Kpi, FunnelBar} from "./dashboard-parts"

export default async function DashboardPage() {
	const {orgId} = await requireOrg()
	const m = await getOrgMetrics(orgId)
	const wonCount = m.funnel.find((f) => f.stage === "WON")?.count ?? 0
	const funnelMax = Math.max(1, ...m.funnel.map((f) => f.count))

	if (m.leadsTotal === 0) {
		return (
			<section className="flex flex-col gap-4">
				<h1 className="text-lg font-semibold">Pulpit</h1>
				<p className="text-sm text-fg-muted">Brak danych. Zaimportuj leady i uruchom kampanię, aby zobaczyć metryki.</p>
			</section>
		)
	}

	return (
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Pulpit</h1>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Kpi label="Leady" value={formatInt(m.leadsTotal)} sub={`w ${m.campaignsTotal} kampaniach`} />
				<Kpi label="Wysłane maile" value={formatInt(m.mailsSent)} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
				<Kpi label="Odpowiedzi" value={formatInt(m.breakdown.replied)} sub={`${formatPct(m.rates.replyRate)} wskaźnik`} tone="up" />
				<Kpi label="Wygrane" value={formatInt(wonCount)} sub="lejek: WON" tone="up" />
				<Kpi label="Odbicia" value={formatInt(m.breakdown.bounced)} sub={formatPct(m.rates.bounceRate)} tone="warn" />
				<Kpi label="Rezygnacje" value={formatInt(m.breakdown.unsubscribed)} sub={formatPct(m.rates.unsubRate)} tone="warn" />
				<Kpi label="Błędy wysyłki" value={formatInt(m.breakdown.failed)} sub="FAILED" tone="bad" />
				<Kpi label="Aktywne kampanie" value={formatInt(m.campaignsActive)} sub={`z ${m.campaignsTotal}`} />
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<div className="rounded-lg border border-border bg-surface-1 p-4">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">Lejek sprzedaży</h2>
					<div className="flex flex-col gap-2">
						{m.funnel.map((f) => (
							<FunnelBar key={f.stage} stage={f.stage} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} />
						))}
					</div>
				</div>

				<div className="rounded-lg border border-border bg-surface-1 p-4">
					<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fg-faint">Kampanie</h2>
					{m.campaigns.length === 0 ? (
						<p className="text-sm text-fg-muted">Brak kampanii.</p>
					) : (
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border-strong text-left text-xs uppercase tracking-wide text-fg-faint">
									<th className="pb-2 pr-2 font-semibold">Kampania</th>
									<th className="pb-2 pr-2 font-semibold">Skontakt.</th>
									<th className="pb-2 pr-2 font-semibold">Odpowiedzi</th>
									<th className="pb-2 pr-2 font-semibold">Odb.</th>
									<th className="pb-2 font-semibold">Rez.</th>
								</tr>
							</thead>
							<tbody>
								{m.campaigns.map((c) => (
									<tr className="border-b border-border" key={c.id}>
										<td className="py-1.5 pr-2">
											<Link className="text-accent hover:underline" href={`/kampanie/${c.id}`}>{c.name}</Link>
											<span className="ml-1 text-fg-faint">· {c.status}</span>
										</td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.contacted)}</td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.replied)} <span className="text-fg-muted">{formatPct(c.replyRate)}</span></td>
										<td className="py-1.5 pr-2 tabular-nums">{formatInt(c.bounced)}</td>
										<td className="py-1.5 tabular-nums">{formatInt(c.unsubscribed)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			<p className="text-xs text-fg-faint">Bez śledzenia otwarć i kliknięć (open-pixel wyłączony). Wskaźniki liczone względem leadów, do których wyszła min. 1 wiadomość.</p>
		</section>
	)
}
```

- [ ] **Step 5: Typecheck + lint.** Run: `npx tsc --noEmit` (Expected: 0) and `npx eslint "app/(app)"` (Expected: clean).
- [ ] **Step 6: Commit.**

```bash
git add "app/(app)/page.tsx" "app/(app)/dashboard-parts.tsx" "app/(app)/layout.tsx"
git commit -m "feat(phase7): pulpit dashboard at / (KPIs + funnel + campaigns) + nav"
```

---

## Task 4: Per-campaign metrics block

**Files:**
- Modify: `app/(app)/kampanie/[id]/page.tsx`

- [ ] **Step 1: Add the imports** at the top of `app/(app)/kampanie/[id]/page.tsx`:

```tsx
import {getCampaignMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {MetricStat} from "../../dashboard-parts"
```

- [ ] **Step 2: Fetch the metrics.** After `if (!campaign) notFound()` (line ~22), add:

```tsx
	const metrics = await getCampaignMetrics(id, orgId)
```

- [ ] **Step 3: Render the strip** between the `</h1>` and `<SendingControls ...>` (after line ~48):

```tsx
			{metrics ? (
				<div className="flex flex-wrap gap-5 rounded-lg border border-border bg-surface-1 p-3.5">
					<MetricStat label="Wysłane maile" value={formatInt(metrics.mailsSent)} />
					<MetricStat label="Skontaktowani" value={formatInt(metrics.rates.contacted)} />
					<MetricStat label="Odpowiedzi" value={`${formatInt(metrics.breakdown.replied)} · ${formatPct(metrics.rates.replyRate)}`} />
					<MetricStat label="Odbicia" value={`${formatInt(metrics.breakdown.bounced)} · ${formatPct(metrics.rates.bounceRate)}`} />
					<MetricStat label="Rezygnacje" value={`${formatInt(metrics.breakdown.unsubscribed)} · ${formatPct(metrics.rates.unsubRate)}`} />
					<MetricStat label="Błędy" value={formatInt(metrics.breakdown.failed)} />
				</div>
			) : null}
```

- [ ] **Step 4: Typecheck + lint.** Run: `npx tsc --noEmit` (0) and `npx eslint "app/(app)/kampanie"` (clean).
- [ ] **Step 5: Commit.**

```bash
git add "app/(app)/kampanie/[id]/page.tsx"
git commit -m "feat(phase7): per-campaign metrics strip on campaign page"
```

---

## Task 5: Gates + roadmap + graph

- [ ] **Step 1: Full gates** (dev server OFF for the build):
  - `npx tsc --noEmit` — 0.
  - `npx vitest run` — all pass (expect ~230: prior 222 + ~8 new compute cases).
  - `npx eslint "app/(app)" features components` — clean.
  - `npm run build` — green (`/` now appears as a dynamic route, not a redirect).
- [ ] **Step 2: Update `docs/superpowers/ROADMAP.md`:** mark `dashboards` DONE + verified (code/test/build); note the pulpit at `/` (org KPIs + deal funnel + campaigns table) + the per-campaign metrics strip + the new `features/metrics` (compute + queries); note `/` moved into the `(app)` shell (nav gained "Pulpit"); rate denominator = contacted; open/click omitted by design. Set the next sub-project to `shell-and-nav-redesign` (high-taste — waits for user design direction). Update the Phase 7 table row + the NEXT TASK line + the recommended-order list + the How-to-resume line.
- [ ] **Step 3:** `graphify update .` (AST-only, no API cost).
- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark dashboards DONE + refresh graph"
```

---

## Self-review

**Spec coverage:** pure compute (Task 1, TDD) covers `summarizeStatuses`/`contacted`/`rate`/`computeRates`/`formatPct`/`formatInt`/`buildCampaignRows`/`orderFunnel` ✓; queries (Task 2) cover `getOrgMetrics`/`getCampaignMetrics`, org-scoped ✓; pulpit at `/` moved into `(app)` + nav (Task 3) ✓; per-campaign strip (Task 4) ✓; contacted denominator (compute) ✓; no open/click, no migration ✓; gates/roadmap/graph (Task 5) ✓.

**Placeholder scan:** every step has complete code; tests are concrete with expected values; the one "confirm `_count` shape" note points at an existing in-repo example (`batch-actions.ts:84`) — not a TBD. No placeholders.

**Type consistency:** `StatusBreakdown`/`Rates`/`CampaignRow` defined in Task 1 are imported verbatim by Task 2's `OrgMetrics`/`CampaignMetrics`; `formatPct`/`formatInt`/`Kpi`/`FunnelBar`/`MetricStat` signatures used in Tasks 3-4 match their definitions; `getOrgMetrics`/`getCampaignMetrics` return shapes match what the pages read (`m.breakdown.replied`, `m.rates.replyRate`, `m.funnel`, `m.campaigns[*].replyRate`, `metrics.mailsSent`). Prisma `groupBy` uses `_count:{_all:true}` -> `g._count._all` (matches the repo's existing usage).

**Notes:** Task 1 lands the unit-tested core; Tasks 2-4 build on it (tsc stays green throughout — `app/page.tsx` deletion + `app/(app)/page.tsx` creation happen together in Task 3). All surfaces are read-only server components (no client JS, no new deps). Reuses `STAGE_ORDER`/`STAGE_LABEL`.
