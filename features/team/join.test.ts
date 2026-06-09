// features/team/join.test.ts
import {describe, it, expect} from "vitest"
import {resolveJoin} from "@/features/team/join"

describe("resolveJoin", () => {
	it("existing membership wins over everything", () => {
		expect(resolveJoin({hasMembership: true, invitation: {organizationId: "o1", role: "ADMIN"}, isOwnerEmail: true})).toEqual({kind: "existing"})
	})
	it("invitation is consumed when no membership", () => {
		expect(resolveJoin({hasMembership: false, invitation: {organizationId: "o1", role: "ADMIN"}, isOwnerEmail: false})).toEqual({kind: "consume", organizationId: "o1", role: "ADMIN"})
	})
	it("invitation wins over owner-email (explicit role beats bootstrap)", () => {
		expect(resolveJoin({hasMembership: false, invitation: {organizationId: "o1", role: "MEMBER"}, isOwnerEmail: true})).toEqual({kind: "consume", organizationId: "o1", role: "MEMBER"})
	})
	it("owner-email bootstraps when nothing else matches", () => {
		expect(resolveJoin({hasMembership: false, invitation: null, isOwnerEmail: true})).toEqual({kind: "bootstrap"})
	})
	it("otherwise rejected", () => {
		expect(resolveJoin({hasMembership: false, invitation: null, isOwnerEmail: false})).toEqual({kind: "reject"})
	})
})
