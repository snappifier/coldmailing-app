// features/sequences/draft-send.test.ts
import {describe, it, expect} from "vitest"
import {resolveDraftDecision} from "@/features/sequences/draft-send"

const done = {status: "DONE", subject: "Cześć", body: "Treść maila"}

describe("resolveDraftDecision", () => {
	it("returns 'template' when the flag is off (even with a DONE draft)", () => {
		expect(resolveDraftDecision(false, done)).toBe("template")
		expect(resolveDraftDecision(false, null)).toBe("template")
	})

	it("returns 'draft' when the flag is on and the draft is DONE with non-empty subject + body", () => {
		expect(resolveDraftDecision(true, done)).toBe("draft")
	})

	it("returns 'wait' when the flag is on but there is no draft", () => {
		expect(resolveDraftDecision(true, null)).toBe("wait")
	})

	it("returns 'wait' when the flag is on and the draft is not DONE", () => {
		expect(resolveDraftDecision(true, {status: "QUEUED", subject: "x", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "RUNNING", subject: "x", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "FAILED", subject: "x", body: "y"})).toBe("wait")
	})

	it("returns 'wait' when DONE but subject or body is blank/whitespace", () => {
		expect(resolveDraftDecision(true, {status: "DONE", subject: "   ", body: "y"})).toBe("wait")
		expect(resolveDraftDecision(true, {status: "DONE", subject: "x", body: ""})).toBe("wait")
	})
})
