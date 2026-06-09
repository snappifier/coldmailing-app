// components/ui/toast-reducer.test.ts
import {describe, it, expect} from "vitest"
import {toastReducer, type ToastState} from "@/components/ui/toast-reducer"

const empty: ToastState = {toasts: []}

describe("toastReducer", () => {
	it("adds a toast", () => {
		const s = toastReducer(empty, {type: "add", toast: {id: "1", title: "Hi", variant: "success"}})
		expect(s.toasts).toHaveLength(1)
		expect(s.toasts[0].title).toBe("Hi")
	})
	it("removes a toast by id", () => {
		const s1 = toastReducer(empty, {type: "add", toast: {id: "1", title: "Hi", variant: "success"}})
		const s2 = toastReducer(s1, {type: "remove", id: "1"})
		expect(s2.toasts).toHaveLength(0)
	})
})
