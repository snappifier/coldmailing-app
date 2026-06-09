// components/ui/button-variants.test.ts
import {describe, it, expect} from "vitest"
import {buttonVariant} from "@/components/ui/button-variants"

describe("buttonVariant", () => {
	it("returns the primary classes", () => {
		expect(buttonVariant("primary")).toContain("bg-primary")
	})
	it("defaults to secondary for an unknown variant", () => {
		expect(buttonVariant(undefined)).toContain("bg-surface-2")
	})
	it("has a danger variant", () => {
		expect(buttonVariant("danger")).toContain("text-danger")
	})
})
