import {describe, it, expect} from "vitest"
import {parseTime, formatTime, maskToDays, daysToMask, isValidTimezone, validateEmailAccountSettings} from "@/features/email-accounts/settings"

describe("parseTime / formatTime", () => {
	it("parses HH:MM to minutes and back", () => {
		expect(parseTime("08:00")).toBe(480)
		expect(parseTime("23:59")).toBe(1439)
		expect(parseTime("00:00")).toBe(0)
		expect(formatTime(480)).toBe("08:00")
		expect(formatTime(1439)).toBe("23:59")
	})
	it("rejects invalid times", () => {
		expect(parseTime("24:00")).toBeNull()
		expect(parseTime("8:60")).toBeNull()
		expect(parseTime("abc")).toBeNull()
		expect(parseTime("")).toBeNull()
	})
})

describe("maskToDays / daysToMask", () => {
	it("round-trips the Mon..Sun bitmask (bit0=Mon)", () => {
		expect(maskToDays(31)).toEqual([true, true, true, true, true, false, false])
		expect(daysToMask([true, true, true, true, true, false, false])).toBe(31)
		expect(maskToDays(127)).toEqual([true, true, true, true, true, true, true])
		expect(daysToMask([false, false, false, false, false, false, false])).toBe(0)
	})
})

describe("isValidTimezone", () => {
	it("accepts real IANA zones, rejects junk", () => {
		expect(isValidTimezone("Europe/Warsaw")).toBe(true)
		expect(isValidTimezone("UTC")).toBe(true)
		expect(isValidTimezone("Mars/Phobos")).toBe(false)
		expect(isValidTimezone("")).toBe(false)
	})
})

describe("validateEmailAccountSettings", () => {
	const ok = {dailyLimit: 40, windowStartMin: 480, windowEndMin: 960, sendDays: 31, minGapSec: 180, maxGapSec: 600, timezone: "Europe/Warsaw"}
	it("returns the update payload on valid input", () => {
		const r = validateEmailAccountSettings(ok)
		expect(r).toEqual({ok: true, value: {dailyLimit: 40, sendWindowStartMin: 480, sendWindowEndMin: 960, sendDays: 31, minGapSec: 180, maxGapSec: 600, timezone: "Europe/Warsaw"}})
	})
	it("rejects bad daily limit", () => {
		expect(validateEmailAccountSettings({...ok, dailyLimit: 0}).ok).toBe(false)
		expect(validateEmailAccountSettings({...ok, dailyLimit: 1001}).ok).toBe(false)
	})
	it("rejects start >= end or unparsed window", () => {
		expect(validateEmailAccountSettings({...ok, windowStartMin: 960, windowEndMin: 480}).ok).toBe(false)
		expect(validateEmailAccountSettings({...ok, windowStartMin: null}).ok).toBe(false)
	})
	it("rejects maxGap < minGap", () => {
		expect(validateEmailAccountSettings({...ok, minGapSec: 600, maxGapSec: 180}).ok).toBe(false)
	})
	it("rejects zero send days", () => {
		expect(validateEmailAccountSettings({...ok, sendDays: 0}).ok).toBe(false)
	})
	it("rejects an invalid timezone", () => {
		expect(validateEmailAccountSettings({...ok, timezone: "Nope/Nope"}).ok).toBe(false)
	})
})
