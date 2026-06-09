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
		const nbsp = String.fromCharCode(160)
		expect(formatInt(1312)).toBe(`1${nbsp}312`)
		expect(formatInt(42)).toBe("42")
		expect(formatInt(1000000)).toBe(`1${nbsp}000${nbsp}000`)
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
