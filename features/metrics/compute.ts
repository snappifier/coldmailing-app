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
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
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
