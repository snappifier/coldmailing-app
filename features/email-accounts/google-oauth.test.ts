import {describe, it, expect, beforeAll} from "vitest"
import {signState, verifyState} from "@/features/email-accounts/google-oauth"

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
})

describe("oauth state", () => {
	it("round-trips the orgId", () => {
		const s = signState("org-123")
		expect(verifyState(s)).toBe("org-123")
	})
	it("rejects a tampered state", () => {
		const s = signState("org-123")
		expect(verifyState(s.slice(0, -2) + "xx")).toBeNull()
	})
})
