// features/pipeline/timeline.test.ts
import {describe, it, expect} from "vitest"
import {activityToTimelineItem, buildTimeline, messageToTimelineItem} from "./timeline"

const d = (s: string) => new Date(s)

describe("messageToTimelineItem", () => {
	it("maps OUTBOUND to 'Wysłano: <subject>'", () => {
		const item = messageToTimelineItem({id: "m1", direction: "OUTBOUND", inboundKind: null, subject: "Krok 0", sentAt: d("2026-06-01"), createdAt: d("2026-06-01")})
		expect(item.title).toBe("Wysłano: Krok 0")
		expect(item.source).toBe("message")
	})
	it("maps each inbound kind to a title", () => {
		const mk = (k: "REPLY" | "BOUNCE" | "AUTO_REPLY" | "OPT_OUT_SUSPECT") =>
			messageToTimelineItem({id: "x", direction: "INBOUND", inboundKind: k, subject: "Re", sentAt: null, createdAt: d("2026-06-02")}).title
		expect(mk("REPLY")).toBe("Odpowiedź")
		expect(mk("BOUNCE")).toBe("Odbicie")
		expect(mk("AUTO_REPLY")).toBe("Autoresponder")
		expect(mk("OPT_OUT_SUSPECT")).toBe("Możliwa rezygnacja")
	})
})

describe("activityToTimelineItem", () => {
	it("maps STAGE_CHANGE with Polish stage labels", () => {
		const item = activityToTimelineItem({id: "a1", kind: "STAGE_CHANGE", body: null, fromStage: "NEW", toStage: "AUDIT", createdAt: d("2026-06-03")})
		expect(item.title).toBe("Etap: Nowy -> Audyt")
	})
	it("maps NOTE with body as detail", () => {
		const item = activityToTimelineItem({id: "a2", kind: "NOTE", body: "rozmowa ok", fromStage: null, toStage: null, createdAt: d("2026-06-03")})
		expect(item.title).toBe("Notatka")
		expect(item.detail).toBe("rozmowa ok")
	})
})

describe("buildTimeline", () => {
	it("merges activities + messages and sorts by time descending", () => {
		const acts = [{id: "a", kind: "NOTE" as const, body: "x", fromStage: null, toStage: null, createdAt: d("2026-06-01")}]
		const msgs = [{id: "m", direction: "OUTBOUND" as const, inboundKind: null, subject: "s", sentAt: d("2026-06-05"), createdAt: d("2026-06-05")}]
		expect(buildTimeline(acts, msgs).map((i) => i.id)).toEqual(["m", "a"])
	})
})
