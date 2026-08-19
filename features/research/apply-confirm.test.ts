import {describe, it, expect, vi, beforeEach} from "vitest"

const h = vi.hoisted(() => ({
	takenEmail: null as string | null,
	updateManyArgs: null as any,
	activityArgs: null as any,
}))

vi.mock("@/lib/prisma", () => ({
	prisma: {
		lead: {
			findFirst: vi.fn(async ({where}: any) => (h.takenEmail && where.email === h.takenEmail ? {id: "other"} : null)),
			updateMany: vi.fn(async (args: any) => {
				h.updateManyArgs = args
				return {count: 1}
			}),
		},
		leadActivity: {create: vi.fn(async (args: any) => {h.activityArgs = args})},
		$transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
	},
}))

import {applyProposedToLead} from "@/features/research/apply-confirm"
import type {ProposedField} from "@/features/research/types"

const prop = (over: Partial<ProposedField>): ProposedField => ({key: "k", target: "contactRole", label: "L", value: "v", current: null, ...over})

beforeEach(() => {
	h.takenEmail = null
	h.updateManyArgs = null
	h.activityArgs = null
	vi.clearAllMocks()
})

describe("applyProposedToLead", () => {
	it("is a no-op for empty proposed", async () => {
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: []})
		expect(res).toEqual({applied: 0, emailSkipped: false})
		expect(h.updateManyArgs).toBeNull()
	})

	it("applies non-email proposals and logs the activity", async () => {
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: [prop({target: "city", value: "Kraków"})]})
		expect(res.applied).toBe(1)
		expect(res.emailSkipped).toBe(false)
		expect(h.updateManyArgs.where).toEqual({id: "l1", organizationId: "org1"})
		expect(h.updateManyArgs.data.city).toBe("Kraków")
		expect(h.activityArgs.data.kind).toBe("RESEARCH")
	})

	it("drops a colliding email and flags emailSkipped", async () => {
		h.takenEmail = "taken@x.pl"
		const res = await applyProposedToLead({
			orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {},
			proposed: [prop({target: "email", value: "taken@x.pl"}), prop({target: "city", value: "Kraków"})],
		})
		expect(res.emailSkipped).toBe(true)
		expect(res.applied).toBe(1)
		expect(h.updateManyArgs.data.email).toBeUndefined()
		expect(h.updateManyArgs.data.city).toBe("Kraków")
	})

	it("returns applied:0 when the only proposal was a colliding email", async () => {
		h.takenEmail = "taken@x.pl"
		const res = await applyProposedToLead({orgId: "org1", userId: "u1", runId: "r1", leadId: "l1", existingCustom: {}, proposed: [prop({target: "email", value: "taken@x.pl"})]})
		expect(res).toEqual({applied: 0, emailSkipped: true})
		expect(h.updateManyArgs).toBeNull()
	})
})
