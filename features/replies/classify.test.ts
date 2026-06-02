// features/replies/classify.test.ts
import {describe, it, expect} from "vitest"
import {classifyInbound, type InboundFacts} from "@/features/replies/classify"

const base: InboundFacts = {from: "lead@example.com", subject: "Re: oferta", labelIds: [], autoSubmitted: null, precedence: null, failedRecipients: null}

describe("classifyInbound", () => {
	it("BOUNCE from mailer-daemon", () => {
		expect(classifyInbound({...base, from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>"})).toBe("BOUNCE")
	})
	it("BOUNCE via X-Failed-Recipients", () => {
		expect(classifyInbound({...base, failedRecipients: "dead@nope.com"})).toBe("BOUNCE")
	})
	it("BOUNCE via subject", () => {
		expect(classifyInbound({...base, subject: "Delivery Status Notification (Failure)"})).toBe("BOUNCE")
	})
	it("AUTO_REPLY via Auto-Submitted", () => {
		expect(classifyInbound({...base, autoSubmitted: "auto-replied"})).toBe("AUTO_REPLY")
	})
	it("AUTO_REPLY via Precedence bulk", () => {
		expect(classifyInbound({...base, precedence: "bulk"})).toBe("AUTO_REPLY")
	})
	it("AUTO_REPLY via subject (Polish OOO)", () => {
		expect(classifyInbound({...base, subject: "Automatyczna odpowiedz: jestem nieobecny"})).toBe("AUTO_REPLY")
	})
	it("REPLY otherwise", () => {
		expect(classifyInbound(base)).toBe("REPLY")
	})
	it("Auto-Submitted 'no' is still a REPLY", () => {
		expect(classifyInbound({...base, autoSubmitted: "no"})).toBe("REPLY")
	})
	it("BOUNCE from postmaster", () => {
		expect(classifyInbound({...base, from: "postmaster@mx.example.com"})).toBe("BOUNCE")
	})
	it("BOUNCE via returned-mail subject", () => {
		expect(classifyInbound({...base, subject: "Returned mail: User unknown"})).toBe("BOUNCE")
	})
	it("AUTO_REPLY via Precedence junk", () => {
		expect(classifyInbound({...base, precedence: "junk"})).toBe("AUTO_REPLY")
	})
	it("AUTO_REPLY via Polish 'nieobecny' subject", () => {
		expect(classifyInbound({...base, subject: "Jestem nieobecny do 5 czerwca"})).toBe("AUTO_REPLY")
	})
})
