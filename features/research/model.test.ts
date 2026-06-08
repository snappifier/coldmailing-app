// features/research/model.test.ts
import {describe, it, expect} from "vitest"
import {resolveModel, tuningForModel} from "@/features/research/model"

describe("model", () => {
	it("falls back to the default opus model", () => {
		expect(resolveModel(null)).toBe("claude-opus-4-8")
		expect(resolveModel("")).toBe("claude-opus-4-8")
		expect(resolveModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6")
	})

	it("enables effort+thinking for opus/sonnet but not haiku", () => {
		expect(tuningForModel("claude-opus-4-8").output_config?.effort).toBe("high")
		expect(tuningForModel("claude-sonnet-4-6").thinking?.type).toBe("adaptive")
		expect(tuningForModel("claude-haiku-4-5")).toEqual({})
	})
})
