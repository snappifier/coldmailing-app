// features/campaigns/activation.test.ts
import {describe, it, expect} from "vitest"
import {validateActivation} from "@/features/campaigns/activation"

describe("validateActivation", () => {
	it("ok when mailbox, step 0 and a pending lead exist", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 3})).toEqual({ok: true})
	})
	it("fails without a sending mailbox", () => {
		expect(validateActivation({sendingEmailAccountId: null, hasStepZero: true, pendingLeadCount: 3}))
			.toEqual({ok: false, error: "Wybierz skrzynkę wysyłkową"})
	})
	it("fails without a first step", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: false, pendingLeadCount: 3}))
			.toEqual({ok: false, error: "Dodaj pierwszy krok sekwencji"})
	})
	it("fails without pending leads", () => {
		expect(validateActivation({sendingEmailAccountId: "m1", hasStepZero: true, pendingLeadCount: 0}))
			.toEqual({ok: false, error: "Brak leadów do wysłania"})
	})
})
