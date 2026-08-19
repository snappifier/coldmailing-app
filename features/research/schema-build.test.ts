import {describe, it, expect} from "vitest"
import {buildFindingsSchema} from "@/features/research/schema-build"

const f = (over: Record<string, unknown>) => ({key: "k", label: "L", target: "CUSTOM", type: "TEXT", required: false, description: null, ...over})

describe("buildFindingsSchema", () => {
	it("maps types and collects required keys", () => {
		const s = buildFindingsSchema([
			f({key: "imie", target: "contactPersonName", type: "TEXT", required: true}),
			f({key: "plec", target: "honorific", type: "GENDER"}),
			f({key: "jakosc", target: "siteQuality", type: "NUMBER"}),
			f({key: "mail", target: "email", type: "EMAIL"}),
			f({key: "flaga", target: "CUSTOM", type: "BOOLEAN"}),
		] as never)
		expect(s.type).toBe("object")
		expect(s.additionalProperties).toBe(false)
		expect(s.required).toEqual(["imie"])
		expect((s.properties.plec as {enum: string[]}).enum).toEqual(["PAN", "PANI"])
		expect((s.properties.jakosc as {type: string}).type).toBe("number")
		expect((s.properties.mail as {format: string}).format).toBe("email")
		expect((s.properties.flaga as {type: string}).type).toBe("boolean")
	})

	it("treats ENUM-without-options as a plain string", () => {
		const s = buildFindingsSchema([f({key: "x", target: "CUSTOM", type: "ENUM"})] as never)
		expect((s.properties.x as {type: string}).type).toBe("string")
		expect((s.properties.x as {enum?: unknown}).enum).toBeUndefined()
	})
})
