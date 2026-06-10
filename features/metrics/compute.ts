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

// Non-breaking space for thousands grouping (U+00A0) so numbers never wrap mid-value.
const NBSP = String.fromCharCode(160)

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
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
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
