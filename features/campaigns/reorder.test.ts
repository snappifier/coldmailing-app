import {describe, expect, it} from "vitest"
import {planSwap} from "@/features/campaigns/reorder"

const steps = [
	{id: "a", order: 0},
	{id: "b", order: 1},
	{id: "c", order: 2},
]

describe("planSwap", () => {
	it("swaps a middle step up", () => {
		expect(planSwap(steps, "b", "up")).toEqual({a: {id: "b", order: 0}, b: {id: "a", order: 1}})
	})
	it("swaps a middle step down", () => {
		expect(planSwap(steps, "b", "down")).toEqual({a: {id: "b", order: 2}, b: {id: "c", order: 1}})
	})
	it("returns null moving the first step up", () => {
		expect(planSwap(steps, "a", "up")).toBeNull()
	})
	it("returns null moving the last step down", () => {
		expect(planSwap(steps, "c", "down")).toBeNull()
	})
	it("returns null for an unknown id", () => {
		expect(planSwap(steps, "x", "up")).toBeNull()
	})
	it("works on unsorted input and gappy orders", () => {
		const gappy = [
			{id: "q", order: 7},
			{id: "p", order: 2},
		]
		expect(planSwap(gappy, "q", "up")).toEqual({a: {id: "q", order: 2}, b: {id: "p", order: 7}})
	})
})
