import {describe, it, expect} from "vitest"
import {Role} from "@/generated/prisma/client"
import {ROLE_ORDER, hasRole} from "@/features/team/roles"

describe("hasRole", () => {
	it("ROLE_ORDER is total over Role", () => {
		for (const r of Object.values(Role)) expect(typeof ROLE_ORDER[r]).toBe("number")
	})
	it("ladder: every role passes its own minimum", () => {
		for (const r of Object.values(Role)) expect(hasRole(r, r)).toBe(true)
	})
	it("OWNER >= ADMIN >= MEMBER", () => {
		expect(hasRole("OWNER", "ADMIN")).toBe(true)
		expect(hasRole("OWNER", "MEMBER")).toBe(true)
		expect(hasRole("ADMIN", "MEMBER")).toBe(true)
		expect(hasRole("ADMIN", "OWNER")).toBe(false)
		expect(hasRole("MEMBER", "ADMIN")).toBe(false)
		expect(hasRole("MEMBER", "OWNER")).toBe(false)
	})
})
