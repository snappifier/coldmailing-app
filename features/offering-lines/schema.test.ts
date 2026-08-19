import {describe, it, expect} from "vitest"
import {offeringLineSchema} from "@/features/offering-lines/schema"

describe("offeringLineSchema", () => {
	it("accepts a valid name and trims it", () => {
		const parsed = offeringLineSchema.parse({name: "  Strony dla szkół  ", description: ""})
		expect(parsed.name).toBe("Strony dla szkół")
		expect(parsed.description).toBeNull()
	})

	it("rejects an empty name", () => {
		const result = offeringLineSchema.safeParse({name: "   "})
		expect(result.success).toBe(false)
	})
})
