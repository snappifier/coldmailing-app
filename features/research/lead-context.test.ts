import {describe, it, expect} from "vitest"
import {buildLeadContextBlock} from "@/features/research/lead-context"

const empty = {aiNotes: null, score: null, siteQuality: null, region: null, schoolType: null, contactRole: null, email: null, phone: null, customFields: null}

describe("buildLeadContextBlock", () => {
	it("returns an empty string when nothing is known", () => {
		expect(buildLeadContextBlock(empty)).toBe("")
	})

	it("includes only non-empty known fields", () => {
		const block = buildLeadContextBlock({...empty, aiNotes: "dyrektor lubi sport", score: 80, siteQuality: null})
		expect(block).toContain("Notatki researchu: dyrektor lubi sport")
		expect(block).toContain("Ocena (score): 80")
		expect(block).not.toContain("Jakość strony")
	})

	it("formats each non-empty customFields entry and skips empty ones", () => {
		const block = buildLeadContextBlock({...empty, customFields: {dyrektorImie: "Anna", pustePole: ""}})
		expect(block).toContain("dyrektorImie: Anna")
		expect(block).not.toContain("pustePole")
	})
})
