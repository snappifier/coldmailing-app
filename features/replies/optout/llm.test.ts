// features/replies/optout/llm.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"

const {create} = vi.hoisted(() => ({create: vi.fn()}))
vi.mock("@anthropic-ai/sdk", () => ({
	default: class {
		messages = {create}
	},
}))

import {llmDetector} from "@/features/replies/optout/llm"

beforeEach(() => {
	create.mockReset()
	process.env.ANTHROPIC_API_KEY = "test-key"
})

describe("llmDetector", () => {
	it("parses the model JSON into a result", async () => {
		create.mockResolvedValue({content: [{type: "text", text: '{"optOut": true, "score": 0.9}'}]})
		expect(await llmDetector.detect("nie dla nas, dzieki")).toEqual({optOut: true, score: 0.9})
	})
	it("fails safe to not-opt-out without an API key", async () => {
		delete process.env.ANTHROPIC_API_KEY
		expect(await llmDetector.detect("cokolwiek")).toEqual({optOut: false, score: 0})
		expect(create).not.toHaveBeenCalled()
	})
	it("fails safe on an API error", async () => {
		create.mockRejectedValue(new Error("boom"))
		expect(await llmDetector.detect("cokolwiek")).toEqual({optOut: false, score: 0})
	})
})
