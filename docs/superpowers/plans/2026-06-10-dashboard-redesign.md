# Dashboard redesign (pulpit) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the pulpit (`/`) to the approved variant B "single canvas": 4 hero numbers, a 30-day sends sparkline + sending-health strip, thin-bar funnel next to a recent-replies feed, flat campaigns table with status Badges — per spec `docs/superpowers/specs/2026-06-10-dashboard-redesign-design.md`.

**Architecture:** Pure, unit-tested chart/bucket/time logic in `features/metrics/compute.ts`; two additive org-scoped queries in `features/metrics/queries.ts`; the page + parts are 100% server-rendered (SVG sparkline from a pure path builder, zero client JS). No migration, no behavior change outside `/`.

**Tech Stack:** Next 16 App Router (server components), Prisma 7, Tailwind v4 tokens, `components/ui/{card,badge}`, `features/enums/labels`, Vitest 4.

---

## Conventions (every step)

- Tabs, no semicolons, path comment line 1, `className` FIRST prop, `import {x}` no inner spaces, NO emoji.
- Read every file before editing. Gates per task: `npx tsc --noEmit` 0, `npx eslint <paths>` clean, `npx vitest run` green. One task = one commit, do NOT push, do NOT run `next build` (dev server live).

---

### Task 1: Pure compute — `bucketDaily`, `relativeTimePl`, `buildSparklinePath` (TDD)

**Files:**
- Modify: `features/metrics/compute.ts` (append; do not touch existing exports)
- Modify: `features/metrics/compute.test.ts` (append new describes)

- [ ] **Step 1: Append failing tests** to `features/metrics/compute.test.ts` (read it first; mirror its import style — add the new names to the existing import from `@/features/metrics/compute`):

```ts
describe("bucketDaily", () => {
	const tz = "Europe/Warsaw"
	const now = new Date("2026-06-10T12:00:00Z")
	it("zero-fills the trailing window and counts per local day", () => {
		const dates = [new Date("2026-06-10T08:00:00Z"), new Date("2026-06-10T09:30:00Z"), new Date("2026-06-09T15:00:00Z")]
		const out = bucketDaily(dates, 3, now, tz)
		expect(out).toHaveLength(3)
		expect(out[0]).toEqual({date: "2026-06-08", count: 0})
		expect(out[1]).toEqual({date: "2026-06-09", count: 1})
		expect(out[2]).toEqual({date: "2026-06-10", count: 2})
	})
	it("ignores dates outside the window and handles empty input", () => {
		expect(bucketDaily([], 2, now, tz).map((d) => d.count)).toEqual([0, 0])
		const out = bucketDaily([new Date("2026-05-01T10:00:00Z")], 2, now, tz)
		expect(out.map((d) => d.count)).toEqual([0, 0])
	})
	it("buckets by the tz-local calendar day (UTC evening = next PL day)", () => {
		const out = bucketDaily([new Date("2026-06-09T22:30:00Z")], 2, now, tz)
		expect(out[1]).toEqual({date: "2026-06-10", count: 1})
	})
})

describe("relativeTimePl", () => {
	const now = new Date("2026-06-10T12:00:00Z")
	it("formats minutes, hours, yesterday, days", () => {
		expect(relativeTimePl(new Date("2026-06-10T11:59:40Z"), now)).toBe("teraz")
		expect(relativeTimePl(new Date("2026-06-10T11:48:00Z"), now)).toBe("12 min")
		expect(relativeTimePl(new Date("2026-06-10T09:00:00Z"), now)).toBe("3 godz.")
		expect(relativeTimePl(new Date("2026-06-09T10:00:00Z"), now)).toBe("wczoraj")
		expect(relativeTimePl(new Date("2026-06-07T10:00:00Z"), now)).toBe("3 dni")
	})
	it("clamps future dates to teraz", () => {
		expect(relativeTimePl(new Date("2026-06-10T13:00:00Z"), now)).toBe("teraz")
	})
})

describe("buildSparklinePath", () => {
	it("returns empty strings and null end for no data", () => {
		expect(buildSparklinePath([], 600, 64)).toEqual({line: "", area: "", end: null})
	})
	it("scales the peak to the top padding and closes the area", () => {
		const {line, area, end} = buildSparklinePath([0, 5, 10], 600, 64, 4)
		expect(line.startsWith("M0 60")).toBe(true)
		expect(line).toContain("L300 32")
		expect(line).toContain("L600 4")
		expect(area.endsWith("L600 64 L0 64 Z")).toBe(true)
		expect(end).toEqual({x: 600, y: 4})
	})
	it("renders all-zero data as a flat bottom line (max guard)", () => {
		const {line} = buildSparklinePath([0, 0], 600, 64, 4)
		expect(line).toBe("M0 60 L600 60")
	})
	it("handles a single point", () => {
		const {line, end} = buildSparklinePath([3], 600, 64, 4)
		expect(line).toBe("M600 4")
		expect(end).toEqual({x: 600, y: 4})
	})
})
```

- [ ] **Step 2: Run to verify they fail** — `npx vitest run features/metrics/compute.test.ts` -> FAIL (missing exports).

- [ ] **Step 3: Append the implementations** to `features/metrics/compute.ts`:

```ts
export interface DailyCount {
	date: string
	count: number
}

// Buckets timestamps into per-day counts over the trailing `days` window (today inclusive),
// keyed by the tz-local calendar day; missing days are zero-filled. DST edge (24h stepping
// can duplicate/skip one local-day key) is accepted for an internal dashboard.
export function bucketDaily(dates: Date[], days: number, now: Date, tz: string): DailyCount[] {
	const fmt = new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"})
	const counts = new Map<string, number>()
	for (const d of dates) {
		const key = fmt.format(d)
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}
	const out: DailyCount[] = []
	for (let i = days - 1; i >= 0; i--) {
		const key = fmt.format(new Date(now.getTime() - i * 86_400_000))
		out.push({date: key, count: counts.get(key) ?? 0})
	}
	return out
}

export function relativeTimePl(date: Date, now: Date): string {
	const diffMin = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000))
	if (diffMin < 1) return "teraz"
	if (diffMin < 60) return `${diffMin} min`
	const diffH = Math.floor(diffMin / 60)
	if (diffH < 24) return `${diffH} godz.`
	const diffD = Math.floor(diffH / 24)
	if (diffD === 1) return "wczoraj"
	return `${diffD} dni`
}

function round1(n: number): number {
	return Math.round(n * 10) / 10
}

// SVG path data for a max-scaled sparkline: the stroke line, the closed area fill, and the
// last point (for the end dot). Pure so the chart is server-rendered and unit-testable.
export function buildSparklinePath(counts: number[], width: number, height: number, pad = 4): {line: string; area: string; end: {x: number; y: number} | null} {
	if (counts.length === 0) return {line: "", area: "", end: null}
	const max = Math.max(1, ...counts)
	const innerH = height - pad * 2
	const stepX = counts.length > 1 ? width / (counts.length - 1) : 0
	const pts = counts.map((c, i) => ({
		x: round1(counts.length > 1 ? i * stepX : width),
		y: round1(pad + innerH * (1 - c / max)),
	}))
	const line = `M${pts.map((p) => `${p.x} ${p.y}`).join(" L")}`
	const area = `${line} L${width} ${height} L0 ${height} Z`
	return {line, area, end: pts[pts.length - 1] ?? null}
}
```

- [ ] **Step 4: Run green** — `npx vitest run features/metrics/compute.test.ts` -> PASS (old 8 + new ~9). Full `npx vitest run` -> green.
- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit` 0; `npx eslint features/metrics` clean.
```bash
git add features/metrics/compute.ts features/metrics/compute.test.ts
git commit -m "feat(dashboard): pure bucketDaily/relativeTimePl/buildSparklinePath (TDD)"
```

---

### Task 2: Queries — `getDailySends` + `getRecentReplies`

**Files:**
- Modify: `features/metrics/queries.ts` (append; read first, mirror its style)

Confirmed schema facts: `Message` has `organizationId` (direct), required `campaignLeadId`, `direction`, `status`, `inboundKind InboundKind?`, `sentAt DateTime?`, `createdAt`; relation `campaignLead` -> `CampaignLead` (which has `campaign` -> `Campaign{id,name}` and `lead` -> `Lead{organizationName}`).

- [ ] **Step 1: Append to `features/metrics/queries.ts`:**

```ts
export interface RecentReply {
	campaignLeadId: string
	campaignId: string
	campaignName: string
	organizationName: string
	at: Date
}

export async function getDailySends(orgId: string, days = 30, now = new Date()): Promise<DailyCount[]> {
	const since = new Date(now.getTime() - days * 86_400_000)
	const msgs = await prisma.message.findMany({
		where: {organizationId: orgId, direction: "OUTBOUND", status: "SENT", sentAt: {gte: since}},
		select: {sentAt: true},
	})
	const dates = msgs.map((m) => m.sentAt).filter((d): d is Date => d != null)
	return bucketDaily(dates, days, now, "Europe/Warsaw")
}

export async function getRecentReplies(orgId: string, limit = 6): Promise<RecentReply[]> {
	const msgs = await prisma.message.findMany({
		where: {organizationId: orgId, direction: "INBOUND", inboundKind: {in: ["REPLY", "OPT_OUT_SUSPECT"]}},
		orderBy: {createdAt: "desc"},
		take: limit,
		select: {
			createdAt: true,
			campaignLead: {select: {id: true, campaign: {select: {id: true, name: true}}, lead: {select: {organizationName: true}}}},
		},
	})
	return msgs.map((m) => ({
		campaignLeadId: m.campaignLead.id,
		campaignId: m.campaignLead.campaign.id,
		campaignName: m.campaignLead.campaign.name,
		organizationName: m.campaignLead.lead.organizationName,
		at: m.createdAt,
	}))
}
```
Add the needed imports to the file's existing import lines: `bucketDaily` + `type DailyCount` from `@/features/metrics/compute`.

- [ ] **Step 2: Gate + commit** — `npx tsc --noEmit` 0; `npx eslint features/metrics` clean; `npx vitest run` green.
```bash
git add features/metrics/queries.ts
git commit -m "feat(dashboard): getDailySends + getRecentReplies queries (org-scoped, additive)"
```

---

### Task 3: UI — canvas rebuild of `page.tsx` + new `dashboard-parts.tsx`

**Files:**
- Rewrite: `app/(app)/dashboard-parts.tsx` (DELETE `Kpi` + `FunnelBar`; KEEP `MetricStat` byte-identical — `/kampanie/[id]` imports it)
- Rewrite: `app/(app)/page.tsx`

Pre-check: `grep -n "\-\-accent" app/globals.css` to confirm the `--accent` CSS variable exists for the SVG (`var(--accent)`); if the token has a different name, use that name in the Sparkline.

- [ ] **Step 1: New `app/(app)/dashboard-parts.tsx`:**

```tsx
// app/(app)/dashboard-parts.tsx
import Link from "next/link"
import {cn} from "@/lib/cn"
import {buildSparklinePath, relativeTimePl, type DailyCount} from "@/features/metrics/compute"
import type {RecentReply} from "@/features/metrics/queries"

export function MetricStat({label, value}: {label: string; value: string}) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-fg-muted">{label}</span>
			<span className="text-base font-semibold tabular-nums">{value}</span>
		</div>
	)
}

export function HeroStat({label, value, sub}: {label: string; value: string; sub?: React.ReactNode}) {
	return (
		<div className="flex flex-col px-5 py-4">
			<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{label}</span>
			<span className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{value}</span>
			{sub ? <span className="mt-0.5 text-[11px] text-fg-faint">{sub}</span> : null}
		</div>
	)
}

export function HealthStat({color, label, value}: {color: string; label: string; value: string}) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-muted">
			<span className={cn("size-[5px] rounded-full", color)} />
			{label} <span className="tabular-nums text-fg">{value}</span>
		</span>
	)
}

// Server-rendered area sparkline; the slight x-stretch of the end dot under
// preserveAspectRatio="none" is accepted (matches the approved mock).
export function Sparkline({className, daily}: {className?: string; daily: DailyCount[]}) {
	const {line, area, end} = buildSparklinePath(daily.map((d) => d.count), 600, 64)
	if (!line) return null
	return (
		<svg className={className} viewBox="0 0 600 64" preserveAspectRatio="none" role="img" aria-label="Wysłane maile dziennie, ostatnie 30 dni">
			<defs>
				<linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
					<stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill="url(#spark-fill)" />
			<path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--accent)" /> : null}
		</svg>
	)
}

export function FunnelRow({label, count, max, tone = "accent"}: {label: string; count: number; max: number; tone?: "accent" | "won" | "lost"}) {
	const raw = max > 0 ? (count / max) * 100 : 0
	const pct = count > 0 ? Math.max(1.5, Math.round(raw * 10) / 10) : 0
	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-accent"
	return (
		<div className="grid grid-cols-[88px_1fr_44px] items-center gap-2.5 py-[5px] text-[12.5px]">
			<span className="text-fg-muted">{label}</span>
			<span className="relative h-[3px] overflow-hidden rounded-full bg-surface-3">
				<span className={cn("absolute inset-y-0 left-0 rounded-full", fill)} style={{width: `${pct}%`}} />
			</span>
			<span className="text-right text-xs tabular-nums text-fg">{count}</span>
		</div>
	)
}

export function ReplyRow({reply, now}: {reply: RecentReply; now: Date}) {
	const initials = reply.organizationName.trim().slice(0, 2).toUpperCase()
	return (
		<Link className="flex items-center gap-2.5 border-b border-border/60 py-[7px] text-[12.5px] transition-colors last:border-b-0 hover:bg-surface-2/50" href={`/kampanie/${reply.campaignId}`}>
			<span className="grid size-[22px] flex-none place-items-center rounded-full border border-border bg-surface-2 text-[9px] font-bold text-fg-muted">{initials}</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium text-fg">{reply.organizationName}</span>
				<span className="block truncate text-[11px] text-fg-faint">{reply.campaignName}</span>
			</span>
			<span className="flex-none text-[11px] text-fg-faint">{relativeTimePl(reply.at, now)}</span>
		</Link>
	)
}
```

- [ ] **Step 2: New `app/(app)/page.tsx`:**

```tsx
// app/(app)/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {getOrgMetrics, getDailySends, getRecentReplies} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import {HeroStat, HealthStat, Sparkline, FunnelRow, ReplyRow} from "./dashboard-parts"

export default async function DashboardPage() {
	const {orgId} = await requireOrg()
	const now = new Date()
	const [m, daily, replies] = await Promise.all([getOrgMetrics(orgId), getDailySends(orgId, 30, now), getRecentReplies(orgId, 6)])
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
		<section className="flex flex-col gap-4">
			<div className="flex items-baseline justify-between">
				<h1 className="text-lg font-semibold">Pulpit</h1>
				<span className="text-[11px] text-fg-faint">ostatnie 30 dni</span>
			</div>

			<Card className="divide-y divide-border">
				<div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
					<HeroStat label="Leady" value={formatInt(m.leadsTotal)} sub={`w ${m.campaignsTotal} kampaniach`} />
					<HeroStat label="Wysłane" value={formatInt(m.mailsSent)} sub={`do ${formatInt(m.rates.contacted)} leadów`} />
					<HeroStat label="Odpowiedzi" value={formatInt(m.breakdown.replied)} sub={<><span className="font-medium text-success">{formatPct(m.rates.replyRate)}</span> wskaźnik</>} />
					<HeroStat label="Wygrane" value={formatInt(wonCount)} sub="lejek: Wygrany" />
				</div>

				<div className="px-5 py-4">
					<div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
						<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Wysłane maile · dziennie</span>
						<span className="flex flex-wrap gap-4">
							<HealthStat color="bg-danger" label="odbicia" value={`${formatInt(m.breakdown.bounced)} · ${formatPct(m.rates.bounceRate)}`} />
							<HealthStat color="bg-warning" label="rezygnacje" value={`${formatInt(m.breakdown.unsubscribed)} · ${formatPct(m.rates.unsubRate)}`} />
							<HealthStat color="bg-fg-faint" label="błędy" value={formatInt(m.breakdown.failed)} />
						</span>
					</div>
					<Sparkline className="h-16 w-full" daily={daily} />
				</div>

				<div className="grid divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
					<div className="px-5 py-4">
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Lejek sprzedaży</div>
						{m.funnel.map((f) => (
							<FunnelRow key={f.stage} label={STAGE_LABEL[f.stage]} count={f.count} max={funnelMax} tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "accent"} />
						))}
					</div>
					<div className="px-5 py-4">
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Ostatnie odpowiedzi</div>
						{replies.length === 0 ? (
							<p className="text-sm text-fg-muted">Brak odpowiedzi.</p>
						) : (
							replies.map((r) => <ReplyRow key={`${r.campaignLeadId}-${r.at.getTime()}`} reply={r} now={now} />)
						)}
					</div>
				</div>

				<div className="px-5 py-4">
					<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Kampanie</div>
					{m.campaigns.length === 0 ? (
						<p className="text-sm text-fg-muted">Brak kampanii.</p>
					) : (
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
								{m.campaigns.map((c) => (
									<tr className="border-b border-border last:border-b-0" key={c.id}>
										<td className="py-2 pr-3"><Link className="font-medium text-fg hover:text-accent" href={`/kampanie/${c.id}`}>{c.name}</Link></td>
										<td className="py-2 pr-3"><Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge></td>
										<td className="py-2 pr-3 text-right tabular-nums">{formatInt(c.contacted)}</td>
										<td className="py-2 pr-3">
											<span className="inline-flex items-center gap-2">
												<span className="tabular-nums">{formatInt(c.replied)} <span className="text-fg-muted">· {formatPct(c.replyRate)}</span></span>
												<span className="relative h-[3px] w-[52px] overflow-hidden rounded-full bg-surface-3">
													<span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{width: `${Math.min(100, Math.round((c.replyRate ?? 0) * 1000))}%`}} />
												</span>
											</span>
										</td>
										<td className="py-2 pr-3 text-right tabular-nums">{formatInt(c.bounced)}</td>
										<td className="py-2 text-right tabular-nums">{formatInt(c.unsubscribed)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</Card>

			<p className="text-xs text-fg-faint">Bez śledzenia otwarć i kliknięć (open-pixel wyłączony). Wskaźniki liczone względem leadów, do których wyszła min. 1 wiadomość.</p>
		</section>
	)
}
```
Notes: the reply-rate mini-bar deliberately scales rate x10 (10% reply rate = full bar) so single-digit rates stay visible — matches the approved mock. If `c.status` is typed `string` (not `CampaignStatus`) in `buildCampaignRows`, cast at the two map lookups (`c.status as CampaignStatus`) like the repo does in lead-inbox; do NOT change the metrics types. If `m.rates.replyRate` is a fraction 0..1, the x1000 math above is correct — verify against `rate()` in compute.ts (it returns count/denominator).

- [ ] **Step 3: Consumer check** — `grep -rn "Kpi\|FunnelBar" app features` must show ZERO remaining imports/uses outside `dashboard-parts.tsx` history (MetricStat still used by `app/(app)/kampanie/[id]/page.tsx` — unchanged).
- [ ] **Step 4: Gates + commit** — `npx tsc --noEmit` 0; `npx eslint "app/(app)/page.tsx" "app/(app)/dashboard-parts.tsx"` clean; `npx vitest run` green.
```bash
git add "app/(app)/page.tsx" "app/(app)/dashboard-parts.tsx"
git commit -m "feat(dashboard): variant-B canvas - hero strip, 30d sparkline, thin funnel, replies feed, Badge statuses"
```

---

### Task 4: Final — gates, docs, chip hygiene (controller does this)

- [ ] Full `tsc`/`vitest`/`eslint`; `next build` only if dev OFF (else defer note).
- [ ] ROADMAP: add the dashboard-redesign DONE line; spec/plan refs.
- [ ] `graphify update .`; commit docs.
- [ ] The spawned chip `task_4906ea35` covered BOTH dashboard + skrzynki enum leaks — the dashboard half is now fixed; replace the chip with a skrzynki-only version (spawn new, dismiss old).

---

## Self-review notes

- Spec coverage: §1 compute/queries = Tasks 1-2; §2 canvas UI incl. hero/sparkline/health/funnel/feed/table + enum-leak fix = Task 3; §4 testing = Task 1 + gates; scope OUT respected (no period switcher, no client JS, MetricStat untouched).
- Type consistency: `DailyCount` defined once in compute and imported by queries/parts; `RecentReply` defined in queries and imported by parts; `buildSparklinePath` returns `{line, area, end}` consumed by `Sparkline`; `bucketDaily(dates, days, now, tz)` signature matches both tests and `getDailySends`.
- Known risk handled: `--accent` CSS var existence is pre-checked in Task 3; `replyRate` fraction-vs-percent verified against `rate()` before the bar math ships.
