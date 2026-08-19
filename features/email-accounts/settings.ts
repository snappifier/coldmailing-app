export const TIMEZONES = [
	"Europe/Warsaw",
	"Europe/London",
	"Europe/Berlin",
	"Europe/Paris",
	"Europe/Kyiv",
	"UTC",
	"America/New_York",
	"America/Los_Angeles",
]

export function parseTime(hhmm: string): number | null {
	const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim())
	if (!m) return null
	return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

export function formatTime(min: number): string {
	const h = Math.floor(min / 60)
	const m = min % 60
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function maskToDays(mask: number): boolean[] {
	return Array.from({length: 7}, (_, i) => ((mask >> i) & 1) === 1)
}

export function daysToMask(days: boolean[]): number {
	return days.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0)
}

export function isValidTimezone(tz: string): boolean {
	try {
		Intl.DateTimeFormat(undefined, {timeZone: tz})
		return true
	} catch {
		return false
	}
}

export interface SettingsInput {
	dailyLimit: number
	windowStartMin: number | null
	windowEndMin: number | null
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export interface SettingsFields {
	dailyLimit: number
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}

export function validateEmailAccountSettings(input: SettingsInput): {ok: true; value: SettingsFields} | {ok: false; error: string} {
	const {dailyLimit, windowStartMin, windowEndMin, sendDays, minGapSec, maxGapSec, timezone} = input
	if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) {
		return {ok: false, error: "Dzienny limit musi być z zakresu 1-1000"}
	}
	if (windowStartMin === null || windowEndMin === null || windowStartMin < 0 || windowEndMin > 1440 || windowStartMin >= windowEndMin) {
		return {ok: false, error: "Okno wysyłki: początek musi być wcześniejszy niż koniec"}
	}
	if (!Number.isInteger(minGapSec) || !Number.isInteger(maxGapSec) || minGapSec < 0 || maxGapSec < minGapSec || maxGapSec > 86400) {
		return {ok: false, error: "Odstęp: min i maks z zakresu 0-86400 s, min nie większy niż maks"}
	}
	if (!Number.isInteger(sendDays) || sendDays < 1 || sendDays > 127) {
		return {ok: false, error: "Wybierz co najmniej jeden dzień wysyłki"}
	}
	if (!isValidTimezone(timezone)) {
		return {ok: false, error: "Nieprawidłowa strefa czasowa"}
	}
	return {ok: true, value: {dailyLimit, sendWindowStartMin: windowStartMin, sendWindowEndMin: windowEndMin, sendDays, minGapSec, maxGapSec, timezone}}
}
