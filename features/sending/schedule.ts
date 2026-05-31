// features/sending/schedule.ts
export interface LocalParts {
	weekdayIso: number // 1=Mon..7=Sun
	minutes: number // minutes into the local day
}

export interface PacingAccount {
	timezone: string
	sendWindowStartMin: number
	sendWindowEndMin: number
	sendDays: number // bitmask bit0=Mon..bit6=Sun
	dailyLimit: number
	minGapSec: number
	maxGapSec: number
}

const WD: Record<string, number> = {Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7}

export function localParts(date: Date, timeZone: string): LocalParts {
	const fmt = new Intl.DateTimeFormat("en-US", {timeZone, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit"})
	const parts = fmt.formatToParts(date)
	const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
	let hour = parseInt(get("hour"), 10)
	if (hour === 24) hour = 0 // some ICU builds emit 24 at midnight under hour12:false
	return {weekdayIso: WD[get("weekday")] ?? 1, minutes: hour * 60 + parseInt(get("minute"), 10)}
}

function isSendDay(weekdayIso: number, mask: number): boolean {
	return ((mask >> (weekdayIso - 1)) & 1) === 1
}

export function isWithinWindow(date: Date, tz: string, startMin: number, endMin: number, mask: number): boolean {
	const p = localParts(date, tz)
	return isSendDay(p.weekdayIso, mask) && p.minutes >= startMin && p.minutes < endMin
}

function shiftMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000)
}

// Next instant at/after `from` where the window is open. Approximate (minute-shift), DST-naive.
export function nextWindowOpen(from: Date, tz: string, startMin: number, endMin: number, mask: number): Date {
	let cursor = from
	for (let i = 0; i < 14; i++) {
		const p = localParts(cursor, tz)
		if (isSendDay(p.weekdayIso, mask) && p.minutes < endMin) {
			if (p.minutes < startMin) return shiftMinutes(cursor, startMin - p.minutes)
			return cursor // already within the window
		}
		// move to the next local day's open time
		cursor = shiftMinutes(cursor, 1440 - p.minutes + startMin)
	}
	return cursor
}

function localDayKey(date: Date, tz: string): string {
	return new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).format(date)
}

export interface PlanInput {
	leadIds: string[]
	now: Date
	account: PacingAccount
	sentTodayCount: number
	rng: () => number // [0,1)
}

export interface PlannedSend {
	leadId: string
	nextSendAt: Date
}

// Spread sends across the mailbox window: at most dailyLimit per local day, separated by a
// random gap in [minGapSec, maxGapSec], rolling to the next valid day when a day fills or a
// gap pushes past the window. Deterministic given `now` and `rng` (fully unit-testable).
export function planSchedule(input: PlanInput): PlannedSend[] {
	const {leadIds, now, account, sentTodayCount, rng} = input
	const {timezone: tz, sendWindowStartMin: start, sendWindowEndMin: end, sendDays: mask, dailyLimit, minGapSec, maxGapSec} = account
	const out: PlannedSend[] = []

	let cursor = nextWindowOpen(now, tz, start, end, mask)
	let dayKey = localDayKey(cursor, tz)
	let countToday = dayKey === localDayKey(now, tz) ? sentTodayCount : 0

	for (const leadId of leadIds) {
		// snap into an open window (a previous gap may have pushed us past the end or onto a closed day)
		cursor = nextWindowOpen(cursor, tz, start, end, mask)
		const ck = localDayKey(cursor, tz)
		if (ck !== dayKey) {
			dayKey = ck
			countToday = 0
		}
		// today's quota is spent -> jump just past this day's window, then to the next open day
		if (countToday >= dailyLimit) {
			const p = localParts(cursor, tz)
			cursor = nextWindowOpen(shiftMinutes(cursor, end - p.minutes + 1), tz, start, end, mask)
			dayKey = localDayKey(cursor, tz)
			countToday = 0
		}

		out.push({leadId, nextSendAt: new Date(cursor.getTime())})
		countToday += 1
		const gapSec = minGapSec + Math.floor(rng() * (maxGapSec - minGapSec + 1))
		cursor = new Date(cursor.getTime() + gapSec * 1000)
	}
	return out
}
