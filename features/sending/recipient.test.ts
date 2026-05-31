// features/sending/recipient.test.ts
import {describe, it, expect} from "vitest"
import {resolveRecipient} from "@/features/sending/recipient"

describe("resolveRecipient", () => {
	it("uses the override when set", () => {
		expect(resolveRecipient("lead@school.pl", "me@test.pl")).toEqual({to: "me@test.pl", overridden: true})
	})
	it("uses the lead email when override is empty/undefined", () => {
		expect(resolveRecipient("lead@school.pl", "")).toEqual({to: "lead@school.pl", overridden: false})
		expect(resolveRecipient("lead@school.pl", null)).toEqual({to: "lead@school.pl", overridden: false})
		expect(resolveRecipient("lead@school.pl", undefined)).toEqual({to: "lead@school.pl", overridden: false})
	})
})
