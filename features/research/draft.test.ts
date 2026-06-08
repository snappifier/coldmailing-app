// features/research/draft.test.ts
import {describe, it, expect} from "vitest"
import {buildDraftSchema, coerceDraft} from "@/features/research/draft"

describe("buildDraftSchema", () => {
	it("requires subject and body, no extra props", () => {
		const s = buildDraftSchema()
		expect(s.required).toEqual(["subject", "body"])
		expect(s.additionalProperties).toBe(false)
		expect(s.properties.subject.type).toBe("string")
		expect(s.properties.body.type).toBe("string")
	})
})

describe("coerceDraft", () => {
	it("trims and accepts a valid draft", () => {
		expect(coerceDraft({subject: " Cześć ", body: " Treść maila ", extra: 1})).toEqual({ok: true, subject: "Cześć", body: "Treść maila"})
	})

	it("rejects empty or whitespace subject/body", () => {
		expect(coerceDraft({subject: "", body: "x"})).toEqual({ok: false})
		expect(coerceDraft({subject: "x", body: "   "})).toEqual({ok: false})
		expect(coerceDraft({subject: 5, body: "x"})).toEqual({ok: false})
		expect(coerceDraft({})).toEqual({ok: false})
	})
})
