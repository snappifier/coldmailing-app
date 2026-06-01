// features/sending/schedule.test.ts
import {describe, it, expect} from "vitest"
import {localParts, isWithinWindow, nextWindowOpen, planSchedule, scheduleFollowupSlot} from "@/features/sending/schedule"

const TZ = "Europe/Warsaw"
const acct = {timezone: TZ, sendWindowStartMin: 480, sendWindowEndMin: 960, sendDays: 31, dailyLimit: 3, minGapSec: 300, maxGapSec: 300}

describe("localParts", () => {
	it("reads local weekday and minutes (UTC+2 summer)", () => {
		const p = localParts(new Date("2026-06-01T06:00:00Z"), TZ) // Mon 08:00 local
		expect(p).toEqual({weekdayIso: 1, minutes: 480})
	})
})

describe("isWithinWindow", () => {
	it("true inside Mon-Fri 08-16", () => {
		expect(isWithinWindow(new Date("2026-06-01T07:00:00Z"), TZ, 480, 960, 31)).toBe(true) // Mon 09:00
	})
	it("false before open", () => {
		expect(isWithinWindow(new Date("2026-06-01T05:00:00Z"), TZ, 480, 960, 31)).toBe(false) // Mon 07:00
	})
	it("false on Saturday", () => {
		expect(isWithinWindow(new Date("2026-06-06T09:00:00Z"), TZ, 480, 960, 31)).toBe(false) // Sat
	})
})

describe("nextWindowOpen", () => {
	it("returns now when already open", () => {
		const now = new Date("2026-06-01T07:00:00Z") // Mon 09:00 local
		expect(nextWindowOpen(now, TZ, 480, 960, 31).toISOString()).toBe(now.toISOString())
	})
	it("jumps to today's open when before open", () => {
		const now = new Date("2026-06-01T04:00:00Z") // Mon 06:00 local
		expect(nextWindowOpen(now, TZ, 480, 960, 31).toISOString()).toBe("2026-06-01T06:00:00.000Z") // Mon 08:00 local
	})
	it("skips the weekend", () => {
		const now = new Date("2026-06-06T09:00:00Z") // Sat
		const open = nextWindowOpen(now, TZ, 480, 960, 31)
		expect(localParts(open, TZ)).toEqual({weekdayIso: 1, minutes: 480}) // Mon 08:00
	})
})

describe("planSchedule", () => {
	const rng = () => 0 // gap = minGapSec exactly (300s)

	it("spaces sends by the gap within the window", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const plan = planSchedule({leadIds: ["a", "b"], now, account: acct, sentTodayCount: 0, rng})
		expect(plan[0].nextSendAt.toISOString()).toBe("2026-06-01T06:00:00.000Z")
		expect(plan[1].nextSendAt.toISOString()).toBe("2026-06-01T06:05:00.000Z") // +300s
	})

	it("rolls to the next day when the daily limit is hit", () => {
		const now = new Date("2026-06-01T06:00:00Z")
		const plan = planSchedule({leadIds: ["a", "b", "c", "d"], now, account: acct, sentTodayCount: 0, rng})
		// dailyLimit 3 -> 4th lead is next day at 08:00 local
		expect(localParts(plan[3].nextSendAt, TZ)).toEqual({weekdayIso: 2, minutes: 480})
	})

	it("accounts for sends already made today", () => {
		const now = new Date("2026-06-01T06:00:00Z")
		const plan = planSchedule({leadIds: ["a", "b"], now, account: acct, sentTodayCount: 2, rng})
		// only 1 slot left today (limit 3 - 2) -> 2nd lead rolls to next day
		expect(localParts(plan[1].nextSendAt, TZ)).toEqual({weekdayIso: 2, minutes: 480})
	})
})

describe("scheduleFollowupSlot", () => {
	const rng0 = () => 0 // gap = minGapSec (300s)

	it("adds delay + gap and stays within the window", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const slot = scheduleFollowupSlot(now, 0, acct, rng0)
		expect(slot.toISOString()).toBe("2026-06-01T06:05:00.000Z") // +300s, still in window
	})

	it("applies whole-day delays", () => {
		const now = new Date("2026-06-01T06:00:00Z") // Mon 08:00 local
		const slot = scheduleFollowupSlot(now, 2, acct, rng0) // Wed 08:05 local
		expect(localParts(slot, TZ)).toEqual({weekdayIso: 3, minutes: 485})
	})

	it("snaps a weekend landing to Monday open", () => {
		const now = new Date("2026-06-04T06:00:00Z") // Thu 08:00 local
		const slot = scheduleFollowupSlot(now, 2, acct, rng0) // Sat -> Mon 08:00
		expect(localParts(slot, TZ)).toEqual({weekdayIso: 1, minutes: 480})
	})
})
