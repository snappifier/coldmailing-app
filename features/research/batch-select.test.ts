// features/research/batch-select.test.ts
import {describe, it, expect} from "vitest"
import {buildLeadWhere} from "@/features/research/batch-select"

describe("buildLeadWhere", () => {
	it("scopes to the org with no criteria", () => {
		expect(buildLeadWhere("org1", {})).toEqual({organizationId: "org1"})
	})

	it("adds the offering-line filter", () => {
		expect(buildLeadWhere("org1", {offeringLineId: "line1"})).toEqual({organizationId: "org1", offeringLineId: "line1"})
	})

	it("adds a case-insensitive OR over name/email/contact for q", () => {
		const where = buildLeadWhere("org1", {q: "abc"})
		expect(where.organizationId).toBe("org1")
		expect(where.OR).toEqual([
			{organizationName: {contains: "abc", mode: "insensitive"}},
			{email: {contains: "abc", mode: "insensitive"}},
			{contactPersonName: {contains: "abc", mode: "insensitive"}},
		])
	})

	it("combines line + q", () => {
		const where = buildLeadWhere("org1", {offeringLineId: "line1", q: "abc"})
		expect(where.offeringLineId).toBe("line1")
		expect(where.OR).toHaveLength(3)
	})

	it("ignores empty-string q and line", () => {
		expect(buildLeadWhere("org1", {q: "", offeringLineId: ""})).toEqual({organizationId: "org1"})
	})
})
