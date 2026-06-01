// features/sequences/plan.test.ts
import {describe, it, expect} from "vitest"
import {decideStep, planNext, type StepDef} from "@/features/sequences/plan"

const NOW = new Date("2026-06-01T10:00:00Z")
const steps: StepDef[] = [
	{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
	{order: 1, condition: "SEND_IF_NO_REPLY", delayDays: 3},
	{order: 2, condition: "ALWAYS", delayDays: 2},
]

describe("decideStep", () => {
	it("ALWAYS always sends", () => {
		expect(decideStep("ALWAYS", null)).toBe("SEND")
		expect(decideStep("ALWAYS", NOW)).toBe("SEND")
	})
	it("SEND_IF_NO_REPLY sends only without a reply", () => {
		expect(decideStep("SEND_IF_NO_REPLY", null)).toBe("SEND")
		expect(decideStep("SEND_IF_NO_REPLY", NOW)).toBe("SKIP")
	})
})

describe("planNext", () => {
	it("returns the next step + its delay when steps remain", () => {
		expect(planNext({steps, currentStep: 1, repliedAt: null})).toEqual({done: false, nextOrder: 1, delayDays: 3})
	})
	it("finishes DONE after the last step with no reply", () => {
		expect(planNext({steps, currentStep: 3, repliedAt: null})).toEqual({done: true, finalStatus: "DONE"})
	})
	it("finishes REPLIED after the last step when replied", () => {
		expect(planNext({steps, currentStep: 3, repliedAt: NOW})).toEqual({done: true, finalStatus: "REPLIED"})
	})
	it("finishes REPLIED early when every remaining step is SEND_IF_NO_REPLY and replied", () => {
		const noAlways: StepDef[] = [
			{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
			{order: 1, condition: "SEND_IF_NO_REPLY", delayDays: 3},
		]
		expect(planNext({steps: noAlways, currentStep: 1, repliedAt: NOW})).toEqual({done: true, finalStatus: "REPLIED"})
	})
	it("continues to a remaining ALWAYS step even after a reply", () => {
		expect(planNext({steps, currentStep: 2, repliedAt: NOW})).toEqual({done: false, nextOrder: 2, delayDays: 2})
	})
	it("picks the next existing order when orders have gaps", () => {
		const gapped: StepDef[] = [
			{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0},
			{order: 2, condition: "ALWAYS", delayDays: 1},
		]
		expect(planNext({steps: gapped, currentStep: 1, repliedAt: null})).toEqual({done: false, nextOrder: 2, delayDays: 1})
	})
})
