// features/research-types/targets.test.ts
import {describe, it, expect} from "vitest"
import {derivedTypeForTarget, CUSTOM_TYPES, TARGET_OPTIONS, LEAD_TARGETS} from "@/features/research-types/targets"

describe("targets", () => {
	it("derives the locked type from a known Lead target", () => {
		expect(derivedTypeForTarget("honorific")).toBe("GENDER")
		expect(derivedTypeForTarget("siteQuality")).toBe("NUMBER")
		expect(derivedTypeForTarget("contactPersonName")).toBe("TEXT")
		expect(derivedTypeForTarget("email")).toBe("EMAIL")
	})

	it("has no derived type for CUSTOM", () => {
		expect(derivedTypeForTarget("CUSTOM")).toBeNull()
	})

	it("exposes CUSTOM and all targets as options, and never offers GENDER as a CUSTOM type", () => {
		expect(TARGET_OPTIONS).toContain("CUSTOM")
		expect(TARGET_OPTIONS).toContain("honorific")
		expect((CUSTOM_TYPES as readonly string[]).includes("GENDER")).toBe(false)
	})

	it("exposes score as a NUMBER target", () => {
		expect(LEAD_TARGETS.score).toBe("NUMBER")
		expect(derivedTypeForTarget("score")).toBe("NUMBER")
		expect(TARGET_OPTIONS).toContain("score")
	})
})
