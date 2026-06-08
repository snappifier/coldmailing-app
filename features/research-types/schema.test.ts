// features/research-types/schema.test.ts
import {describe, it, expect} from "vitest"
import {researchTypeSchema} from "@/features/research-types/schema"

const valid = {
	name: "Licea",
	prompt: "Znajdź dyrektora {{nazwaPlacowki}}",
	outputFields: [
		{key: "dyrektorImie", label: "Imię dyrektora", target: "contactPersonName", type: "TEXT", required: true},
		{key: "dyrektorPlec", label: "Płeć", target: "honorific", type: "GENDER", required: false},
		{key: "email", label: "Email", target: "email", type: "EMAIL", required: true},
		{key: "jakoscWww", label: "Jakość", target: "siteQuality", type: "NUMBER", required: false},
		{key: "sekretariatTel", label: "Tel", target: "CUSTOM", type: "TEXT", required: false},
	],
}

describe("researchTypeSchema", () => {
	it("accepts the example Licea type and applies defaults", () => {
		const r = researchTypeSchema.parse(valid)
		expect(r.modelId).toBeNull()
		expect(r.webSearchEnabled).toBe(false)
		expect(r.outputFields[0].description).toBeNull()
		expect(r.outputFields[1].required).toBe(false)
	})

	it("rejects zero output fields", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: []}).success).toBe(false)
	})

	it("rejects a bad key", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "zła nazwa", label: "x", target: "CUSTOM", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a reserved CUSTOM key", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "miasto", label: "x", target: "CUSTOM", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a forbidden target", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "ds", label: "x", target: "dealStage", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a type mismatched with a known target", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "q", label: "x", target: "siteQuality", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects GENDER on a CUSTOM field", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "g", label: "x", target: "CUSTOM", type: "GENDER"}]}).success).toBe(false)
	})

	it("rejects duplicate keys", () => {
		const fields = [
			{key: "dup", label: "a", target: "aiHook", type: "TEXT"},
			{key: "dup", label: "b", target: "aiNotes", type: "TEXT"},
		]
		expect(researchTypeSchema.safeParse({...valid, outputFields: fields}).success).toBe(false)
	})

	it("rejects the same non-CUSTOM target used twice", () => {
		const fields = [
			{key: "a", label: "a", target: "aiHook", type: "TEXT"},
			{key: "b", label: "b", target: "aiHook", type: "TEXT"},
		]
		expect(researchTypeSchema.safeParse({...valid, outputFields: fields}).success).toBe(false)
	})

	it("defaults kind to RESEARCH", () => {
		expect(researchTypeSchema.parse(valid).kind).toBe("RESEARCH")
	})

	it("rejects a SCORING type without a score output", () => {
		expect(researchTypeSchema.safeParse({...valid, kind: "SCORING"}).success).toBe(false)
	})

	it("accepts a SCORING type with a score output", () => {
		const fields = [{key: "ocena", label: "Ocena", target: "score", type: "NUMBER"}]
		expect(researchTypeSchema.safeParse({...valid, kind: "SCORING", outputFields: fields}).success).toBe(true)
	})
})
