// features/pipeline/group.test.ts
import {describe, it, expect} from "vitest"
import type {DealStage} from "@/generated/prisma/client"
import {groupLeadsByStage} from "./group"

const lead = (id: string, dealStage: DealStage) => ({id, dealStage})

describe("groupLeadsByStage", () => {
	it("returns all 7 stages in canonical order, even when empty", () => {
		const cols = groupLeadsByStage([])
		expect(cols.map((c) => c.stage)).toEqual(["NEW", "AUDIT", "PROPOSAL", "MEETING", "OFFER", "WON", "LOST"])
		expect(cols.every((c) => c.leads.length === 0)).toBe(true)
	})
	it("buckets leads into their stage, preserving order", () => {
		const cols = groupLeadsByStage([lead("a", "NEW"), lead("b", "WON"), lead("c", "NEW")])
		const byStage = Object.fromEntries(cols.map((c) => [c.stage, c.leads.map((l) => l.id)]))
		expect(byStage.NEW).toEqual(["a", "c"])
		expect(byStage.WON).toEqual(["b"])
		expect(byStage.AUDIT).toEqual([])
	})
})
