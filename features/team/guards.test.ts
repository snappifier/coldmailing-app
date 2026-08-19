import {describe, it, expect} from "vitest"
import {ownerCount, canChangeRole, canRemoveMember} from "@/features/team/guards"

const team = [
	{membershipId: "m1", role: "OWNER" as const},
	{membershipId: "m2", role: "ADMIN" as const},
	{membershipId: "m3", role: "MEMBER" as const},
]
const twoOwners = [...team, {membershipId: "m4", role: "OWNER" as const}]

describe("team guards", () => {
	it("ownerCount counts owners", () => {
		expect(ownerCount(team)).toBe(1)
		expect(ownerCount(twoOwners)).toBe(2)
	})
	it("cannot demote the last owner", () => {
		expect(canChangeRole(team, "m1", "ADMIN")).toBe(false)
		expect(canChangeRole(team, "m1", "OWNER")).toBe(true)
	})
	it("can demote an owner when another remains", () => {
		expect(canChangeRole(twoOwners, "m1", "MEMBER")).toBe(true)
	})
	it("non-owner role changes are free", () => {
		expect(canChangeRole(team, "m2", "MEMBER")).toBe(true)
		expect(canChangeRole(team, "m3", "OWNER")).toBe(true)
	})
	it("cannot remove the last owner; others removable", () => {
		expect(canRemoveMember(team, "m1")).toBe(false)
		expect(canRemoveMember(twoOwners, "m1")).toBe(true)
		expect(canRemoveMember(team, "m2")).toBe(true)
		expect(canRemoveMember(team, "m3")).toBe(true)
	})
	it("unknown target is rejected", () => {
		expect(canChangeRole(team, "nope", "ADMIN")).toBe(false)
		expect(canRemoveMember(team, "nope")).toBe(false)
	})
})
