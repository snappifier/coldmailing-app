// lib/crypto.test.ts
import {describe, it, expect, beforeAll} from "vitest"
import {encryptSecret, decryptSecret} from "@/lib/crypto"

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
})

describe("crypto", () => {
	it("round-trips a secret", () => {
		const enc = encryptSecret("ya29.some-token")
		expect(enc).not.toContain("ya29")
		expect(decryptSecret(enc)).toBe("ya29.some-token")
	})

	it("produces different ciphertext each call (random iv)", () => {
		expect(encryptSecret("x")).not.toBe(encryptSecret("x"))
	})

	it("throws on tampered ciphertext", () => {
		const enc = encryptSecret("secret")
		const parts = enc.split(":")
		parts[2] = Buffer.from("tampered").toString("base64")
		expect(() => decryptSecret(parts.join(":"))).toThrow()
	})
})
