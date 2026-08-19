import {describe, it, expect} from "vitest"
import {resolveSenderName, sanitizeSignature, MAX_SIGNATURE_LEN} from "@/features/templates/sender"

describe("resolveSenderName", () => {
	it("uses the signature (trimmed) when set", () => {
		expect(resolveSenderName({signature: "  Pozdrawiam,\nJan  ", fallback: "Mailbox"})).toBe("Pozdrawiam,\nJan")
	})

	it("falls back to the mailbox name (trimmed) when the signature is empty", () => {
		expect(resolveSenderName({signature: "", fallback: "  Acme Mailbox  "})).toBe("Acme Mailbox")
	})

	it("falls back when the signature is whitespace-only", () => {
		expect(resolveSenderName({signature: "   \n  ", fallback: "Acme Mailbox"})).toBe("Acme Mailbox")
	})

	it("returns empty string when both are empty/null", () => {
		expect(resolveSenderName({signature: "", fallback: ""})).toBe("")
		expect(resolveSenderName({signature: null, fallback: null})).toBe("")
	})
})

describe("sanitizeSignature", () => {
	it("trims", () => {
		expect(sanitizeSignature("  hi  ")).toBe("hi")
	})

	it("caps length at MAX_SIGNATURE_LEN", () => {
		const long = "x".repeat(MAX_SIGNATURE_LEN + 50)
		expect(sanitizeSignature(long).length).toBe(MAX_SIGNATURE_LEN)
	})
})
