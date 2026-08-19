import {describe, it, expect} from "vitest"
import {renderTemplate, type RenderContext} from "@/features/templates/render"

function ctx(over: Partial<RenderContext> = {}): RenderContext {
	return {
		lead: {
			organizationName: "I LO Zamość",
			contactPersonName: "Jan Kowalski",
			city: "Zamość",
			website: "https://1lo.com.pl",
			aiHook: "świetne wyniki maturalne",
			honorific: "PAN",
			customFields: {branza: "edukacja"},
		},
		senderName: "Krystian",
		placeholders: [{key: "branza", source: null, fallback: null}],
		...over,
	}
}

describe("renderTemplate", () => {
	it("resolves built-in tokens", () => {
		const r = renderTemplate("{{osoba}} z {{nazwaPlacowki}} ({{miasto}})", ctx())
		expect(r.rendered).toBe("Jan Kowalski z I LO Zamość (Zamość)")
		expect(r.missing).toEqual([])
	})

	it("resolves {{zwrot}} by honorific and flags null", () => {
		expect(renderTemplate("{{zwrot}}", ctx({lead: {...ctx().lead, honorific: "PANI"}})).rendered).toBe("Pani")
		const none = renderTemplate("{{zwrot}}", ctx({lead: {...ctx().lead, honorific: null}}))
		expect(none.rendered).toBe("[brak: zwrot]")
		expect(none.missing).toEqual(["zwrot"])
	})

	it("resolves {{podpisNadawcy}} from senderName", () => {
		expect(renderTemplate("{{podpisNadawcy}}", ctx()).rendered).toBe("Krystian")
		expect(renderTemplate("{{podpisNadawcy}}", ctx({senderName: "Pozdrawiam,\nZespół Acme"})).rendered).toBe("Pozdrawiam,\nZespół Acme")
	})

	it("flags {{podpisNadawcy}} as missing when senderName is empty", () => {
		const r = renderTemplate("{{podpisNadawcy}}", ctx({senderName: ""}))
		expect(r.rendered).toBe("[brak: podpisNadawcy]")
		expect(r.missing).toEqual(["podpisNadawcy"])
	})

	it("resolves gendered forms by honorific", () => {
		expect(renderTemplate("{{Szanowny|Szanowna}} Panie", ctx()).rendered).toBe("Szanowny Panie")
		expect(renderTemplate("{{Szanowny|Szanowna}}", ctx({lead: {...ctx().lead, honorific: "PANI"}})).rendered).toBe("Szanowna")
		const none = renderTemplate("{{Szanowny|Szanowna}}", ctx({lead: {...ctx().lead, honorific: null}}))
		expect(none.rendered).toBe("Szanowny")
		expect(none.missing).toEqual(["Szanowny|Szanowna"])
	})

	it("resolves custom placeholder from customFields", () => {
		expect(renderTemplate("Branża: {{branza}}", ctx()).rendered).toBe("Branża: edukacja")
	})

	it("uses fallback then flags missing custom placeholder", () => {
		const withFallback = ctx({lead: {...ctx().lead, customFields: {}}, placeholders: [{key: "branza", source: null, fallback: "oświata"}]})
		expect(renderTemplate("{{branza}}", withFallback).rendered).toBe("oświata")
		const noFallback = ctx({lead: {...ctx().lead, customFields: {}}})
		const r = renderTemplate("{{branza}}", noFallback)
		expect(r.rendered).toBe("[brak: branza]")
		expect(r.missing).toEqual(["branza"])
	})

	it("flags unknown tokens and tolerates whitespace and repeats", () => {
		const r = renderTemplate("{{ osoba }} {{cos}} {{cos}}", ctx())
		expect(r.rendered).toBe("Jan Kowalski [brak: cos] [brak: cos]")
		expect(r.missing).toEqual(["cos", "cos"])
	})
})
