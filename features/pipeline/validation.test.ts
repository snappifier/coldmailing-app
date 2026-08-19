import {describe, it, expect} from "vitest"
import {addActivitySchema} from "./validation"

describe("addActivitySchema", () => {
	it("accepts a NOTE with a body", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "NOTE", body: "hej"}).success).toBe(true)
	})
	it("rejects STAGE_CHANGE (not user-creatable)", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "STAGE_CHANGE", body: "x"}).success).toBe(false)
	})
	it("rejects an empty/whitespace body", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "NOTE", body: "   "}).success).toBe(false)
	})
})
