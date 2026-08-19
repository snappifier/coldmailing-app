import {describe, it, expect} from "vitest"
import {parseWizardMessages, buildWizardTemplateName, WIZARD_FOLDER} from "@/features/campaigns/wizard"

describe("parseWizardMessages", () => {
	it("parses the first message with ALWAYS/delay 0 and follow-ups with SEND_IF_NO_REPLY", () => {
		const res = parseWizardMessages({subject_0: " Temat ", body_0: "Treść", subject_1: "Fu", body_1: "Fu treść", delay_1: "4"})
		expect(res).toEqual({
			ok: true,
			messages: [
				{subject: "Temat", body: "Treść", delayDays: 0, condition: "ALWAYS"},
				{subject: "Fu", body: "Fu treść", delayDays: 4, condition: "SEND_IF_NO_REPLY"},
			],
		})
	})
	it("requires subject and body on the first message", () => {
		expect(parseWizardMessages({subject_0: "", body_0: "x"})).toEqual({ok: false, error: "Podaj temat wiadomości"})
		expect(parseWizardMessages({subject_0: "x", body_0: " "})).toEqual({ok: false, error: "Podaj treść wiadomości"})
	})
	it("skips fully empty follow-up slots but rejects half-filled ones", () => {
		const res = parseWizardMessages({subject_0: "a", body_0: "b", subject_2: "tylko temat", body_2: "", delay_2: "3"})
		expect(res.ok).toBe(false)
	})
	it("bounds follow-up delay to 1-30 integer days", () => {
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "0"}).ok).toBe(false)
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "31"}).ok).toBe(false)
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "2.5"}).ok).toBe(false)
	})
	it("builds campaign-scoped template names and exposes the folder sentinel", () => {
		expect(buildWizardTemplateName("Q3 Małopolska", 0)).toBe("Q3 Małopolska — krok 1")
		expect(WIZARD_FOLDER).toBe("__kreator__")
	})
})
