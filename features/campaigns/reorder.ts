// features/campaigns/reorder.ts
export interface OrderedStep {
	id: string
	order: number
}
export interface SwapPlan {
	a: OrderedStep
	b: OrderedStep
}

// Plans an up/down swap for stepId. Input may be unsorted and orders may have gaps
// (delete leaves gaps; the engine cursor is gap-safe). Returns the two rows with
// EXCHANGED order values, or null when the move hits a boundary or the id is unknown.
export function planSwap(steps: OrderedStep[], stepId: string, dir: "up" | "down"): SwapPlan | null {
	const sorted = [...steps].sort((x, y) => x.order - y.order)
	const i = sorted.findIndex((s) => s.id === stepId)
	if (i === -1) return null
	const j = dir === "up" ? i - 1 : i + 1
	if (j < 0 || j >= sorted.length) return null
	const cur = sorted[i]
	const other = sorted[j]
	return {a: {id: cur.id, order: other.order}, b: {id: other.id, order: cur.order}}
}
