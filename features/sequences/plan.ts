// features/sequences/plan.ts
export type SequenceCondition = "ALWAYS" | "SEND_IF_NO_REPLY"

export interface StepDef {
	order: number
	condition: SequenceCondition
	delayDays: number
}

export type SendDecision = "SEND" | "SKIP"

// SEND if the step is ALWAYS, or SEND_IF_NO_REPLY and the lead has not replied. Otherwise SKIP.
export function decideStep(condition: SequenceCondition, repliedAt: Date | null): SendDecision {
	if (condition === "ALWAYS") return "SEND"
	return repliedAt ? "SKIP" : "SEND"
}

export type NextPlan =
	| {done: true; finalStatus: "DONE" | "REPLIED"}
	| {done: false; nextOrder: number; delayDays: number}

// Given the steps and the cursor AFTER advancing past the processed step, decide whether the
// sequence is finished (and its terminal status) or which step comes next and its delay.
// If the lead replied and every remaining step is SEND_IF_NO_REPLY, finish as REPLIED immediately
// (no point waking only to skip). Steps may be unsorted and orders may have gaps.
export function planNext(args: {steps: StepDef[]; currentStep: number; repliedAt: Date | null}): NextPlan {
	const remaining = args.steps.filter((s) => s.order >= args.currentStep).sort((a, b) => a.order - b.order)
	if (remaining.length === 0) return {done: true, finalStatus: args.repliedAt ? "REPLIED" : "DONE"}
	if (args.repliedAt && remaining.every((s) => s.condition === "SEND_IF_NO_REPLY")) {
		return {done: true, finalStatus: "REPLIED"}
	}
	const next = remaining[0]
	return {done: false, nextOrder: next.order, delayDays: next.delayDays}
}
