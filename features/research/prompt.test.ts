// features/research/prompt.test.ts
import {describe, it, expect} from "vitest"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"

const lead = {organizationName: "Liceum X", contactPersonName: null, city: "Kraków", website: "x.pl", aiHook: null, honorific: null, customFields: null}

describe("prompt", () => {
	it("renders builtin tokens and strips missing markers", () => {
		const ctx = leadToRenderContext(lead, "", [])
		const out = buildResearchPrompt("Znajdź dyrektora {{nazwaPlacowki}} w {{miasto}}. Hook: {{hookAI}}", ctx)
		expect(out).toContain("Liceum X")
		expect(out).toContain("Kraków")
		expect(out).not.toContain("[brak:")
	})
})
