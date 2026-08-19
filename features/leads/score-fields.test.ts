import {describe, it, expect} from "vitest"
import {parseScoreFields} from "@/features/leads/score-fields"

function from(obj: Record<string, string>) {
	return (name: string) => (name in obj ? obj[name] : null)
}

describe("parseScoreFields", () => {
	it("parses + clamps score 0-100 and priority/siteQuality 1-5", () => {
		const r = parseScoreFields(from({score: "150", priority: "9", siteQuality: "0", aiHook: " hak ", aiNotes: "bo X"}))
		expect(r).toEqual({score: 100, priority: 5, siteQuality: 1, aiHook: "hak", aiNotes: "bo X"})
	})

	it("rounds and keeps in-range values", () => {
		const r = parseScoreFields(from({score: "73.6", priority: "3", siteQuality: "4"}))
		expect(r.score).toBe(74)
		expect(r.priority).toBe(3)
		expect(r.siteQuality).toBe(4)
	})

	it("maps empty / missing / non-numeric to null", () => {
		const r = parseScoreFields(from({score: "", priority: "abc", aiHook: "  "}))
		expect(r).toEqual({score: null, priority: null, siteQuality: null, aiHook: null, aiNotes: null})
	})
})
