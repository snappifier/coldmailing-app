import {describe, it, expect} from "vitest"
import {isNavActive} from "@/features/nav/active"

describe("isNavActive", () => {
	it("matches the home route only on exact /", () => {
		expect(isNavActive("/", "/")).toBe(true)
		expect(isNavActive("/leady", "/")).toBe(false)
	})
	it("matches a section and its sub-routes", () => {
		expect(isNavActive("/leady", "/leady")).toBe(true)
		expect(isNavActive("/leady/123", "/leady")).toBe(true)
		expect(isNavActive("/kampanie", "/leady")).toBe(false)
	})
})
