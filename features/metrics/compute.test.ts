import {describe, it, expect} from "vitest"
import {summarizeStatuses, contacted, rate, computeRates, formatPct, formatInt, buildCampaignRows, orderFunnel, bucketDaily, relativeTimePl, buildSparklinePath, groupWeekly} from "@/features/metrics/compute"

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

describe("groupWeekly", () => {
	it("groups by Monday-based weeks, drops the leading partial week, keeps the trailing one", () => {
		// 2026-08-01 is a Saturday; 2026-08-03 the first Monday.
		const daily = [
			{date: "2026-08-01", count: 1},
			{date: "2026-08-02", count: 1},
			{date: "2026-08-03", count: 2},
			{date: "2026-08-04", count: 3},
			{date: "2026-08-05", count: 0},
			{date: "2026-08-06", count: 1},
			{date: "2026-08-07", count: 0},
			{date: "2026-08-08", count: 0},
			{date: "2026-08-09", count: 4},
			{date: "2026-08-10", count: 5},
			{date: "2026-08-11", count: 1},
		]
		expect(groupWeekly(daily)).toEqual([
			{date: "2026-08-03", count: 10},
			{date: "2026-08-10", count: 6},
		])
	})
	it("returns empty when no Monday is present", () => {
		expect(groupWeekly([{date: "2026-08-01", count: 5}])).toEqual([])
	})
})

describe("buildSparklinePath", () => {
	it("returns empty strings, no points and null end for no data", () => {
		expect(buildSparklinePath([], 600, 64)).toEqual({line: "", area: "", points: [], end: null})
	})
	it("scales the peak to the top padding and closes the area", () => {
		const {line, area, points, end} = buildSparklinePath([0, 5, 10], 600, 64, 4)
		expect(line.startsWith("M0 60")).toBe(true)
		expect(line).toContain("L300 32")
		expect(line).toContain("L600 4")
		expect(area.endsWith("L600 64 L0 64 Z")).toBe(true)
		expect(points).toEqual([
			{x: 0, y: 60},
			{x: 300, y: 32},
			{x: 600, y: 4},
		])
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
