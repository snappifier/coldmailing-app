// features/leads/dedupe.test.ts
import {describe, it, expect} from "vitest"
import {partitionLeads} from "@/features/leads/dedupe"

describe("partitionLeads", () => {
	const base = {
		organizationName: "X",
		website: null,
		contactPersonName: null,
		contactRole: null,
		phone: null,
		city: null,
		region: null,
		schoolType: null,
		honorific: null,
		customFields: null,
	}

	it("splits into insert/duplicate/suppressed by email", () => {
		const leads = [
			{...base, email: "a@b.pl"},
			{...base, email: "dup@b.pl"},
			{...base, email: "block@b.pl"},
			{...base, email: "a@b.pl"}, // duplicate within batch
			{...base, email: null}, // no email -> always insert
		]
		const result = partitionLeads(leads, {existingEmails: new Set(["dup@b.pl"]), suppressedEmails: new Set(["block@b.pl"])})
		expect(result.toInsert.map((l) => l.email)).toEqual(["a@b.pl", null])
		expect(result.duplicateCount).toBe(2) // dup@b.pl (existing) + second a@b.pl (in-batch)
		expect(result.suppressedCount).toBe(1)
	})
})
