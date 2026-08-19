import {describe, it, expect} from "vitest"
import {placeholderSchema} from "@/features/placeholders/schema"

describe("placeholderSchema", () => {
	it("accepts a valid TEXT placeholder and defaults source/options to null", () => {
		const p = placeholderSchema.parse({key: " branza ", label: "Branża", type: "TEXT", fallback: ""})
		expect(p.key).toBe("branza")
		expect(p.options).toBeNull()
		expect(p.fallback).toBeNull()
	})

	it("rejects keys with non-word characters", () => {
		expect(placeholderSchema.safeParse({key: "zła nazwa", label: "x", type: "TEXT"}).success).toBe(false)
	})

	it("parses CHOICE options from comma string", () => {
		const p = placeholderSchema.parse({key: "ton", label: "Ton", type: "CHOICE", options: "formalny, luźny"})
		expect(p.options).toEqual(["formalny", "luźny"])
	})

	it("rejects a reserved built-in key", () => {
		expect(placeholderSchema.safeParse({key: "miasto", label: "Miasto", type: "TEXT"}).success).toBe(false)
	})
})
