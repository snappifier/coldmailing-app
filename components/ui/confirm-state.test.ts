// components/ui/confirm-state.test.ts
import {describe, it, expect} from "vitest"
import {defaultConfirmOptions} from "@/components/ui/confirm-state"

describe("defaultConfirmOptions", () => {
	it("fills sensible defaults", () => {
		const o = defaultConfirmOptions({title: "Na pewno?"})
		expect(o.confirmLabel).toBe("Potwierdź")
		expect(o.cancelLabel).toBe("Anuluj")
		expect(o.danger).toBe(false)
	})
	it("keeps provided values", () => {
		const o = defaultConfirmOptions({title: "X", confirmLabel: "Usuń", danger: true})
		expect(o.confirmLabel).toBe("Usuń")
		expect(o.danger).toBe(true)
	})
})
