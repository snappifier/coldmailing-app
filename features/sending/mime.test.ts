import {describe, it, expect} from "vitest"
import {buildRawMessage} from "@/features/sending/mime"

function fromBase64Url(s: string): string {
	const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
	return Buffer.from(b64, "base64").toString("utf8")
}

describe("buildRawMessage", () => {
	it("is base64url (no +, /, =)", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Hi", text: "Hello"})
		expect(raw).not.toMatch(/[+/=]/)
	})

	it("includes the headers and the decoded body round-trips", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Oferta", text: "Dzień dobry, Pani Anno"})
		const msg = fromBase64Url(raw)
		expect(msg).toContain("From: a@b.pl")
		expect(msg).toContain("To: c@d.pl")
		expect(msg).toContain('Content-Type: text/plain; charset="UTF-8"')
		// body is base64-encoded UTF-8 -> find it after the blank line and decode
		const body = msg.split("\r\n\r\n")[1].trim()
		expect(Buffer.from(body, "base64").toString("utf8")).toBe("Dzień dobry, Pani Anno")
	})

	it("RFC 2047-encodes a non-ASCII subject", () => {
		const raw = buildRawMessage({from: "a@b.pl", to: "c@d.pl", subject: "Zapytanie ąęó", text: "x"})
		const msg = fromBase64Url(raw)
		expect(msg).toMatch(/Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/)
	})
})
