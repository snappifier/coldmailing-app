// lib/inngest/sending.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"

const h = vi.hoisted(() => ({
	cLead: null as any,
	campaign: null as any,
	account: null as any,
	steps: [] as any[],
	messages: [] as any[],
	sendEmail: vi.fn(async () => ({gmailMessageId: "gm", gmailThreadId: "gt"})),
}))

const LEAD_ENTITY = {
	email: "lead@example.com",
	organizationName: "Org",
	contactPersonName: null,
	city: null,
	website: null,
	aiHook: null,
	honorific: null,
	customFields: null,
}

vi.mock("@/features/sending/gmail", () => ({sendEmail: (...a: any[]) => (h.sendEmail as any)(...a)}))
vi.mock("@/features/templates/render", () => ({renderTemplate: (t: string) => ({rendered: t})}))
vi.mock("@/features/sending/recipient", () => ({resolveRecipient: (email: string) => ({to: email})}))
vi.mock("@/lib/prisma", () => ({
	prisma: {
		campaignLead: {
			findUnique: vi.fn(async () => ({...h.cLead, campaign: h.campaign, lead: LEAD_ENTITY})),
			update: vi.fn(async ({data}: any) => {
				Object.assign(h.cLead, data)
			}),
			updateMany: vi.fn(async ({where, data}: any) => {
				const blocked = where.status?.notIn?.includes(h.cLead.status)
				if (!blocked) Object.assign(h.cLead, data)
				return {count: blocked ? 0 : 1}
			}),
		},
		sequenceStep: {findMany: vi.fn(async () => h.steps)},
		placeholder: {findMany: vi.fn(async () => [])},
		emailAccount: {findUnique: vi.fn(async () => h.account)},
		message: {count: vi.fn(async () => 0), create: vi.fn(async ({data}: any) => {h.messages.push(data)})},
		suppression: {findUnique: vi.fn(async () => null)},
	},
}))

import {runLeadSequenceHandler, type SequenceStepTools} from "@/lib/inngest/sending"

function step(order: number, condition: "ALWAYS" | "SEND_IF_NO_REPLY", delayDays: number) {
	return {order, condition, delayDays, template: {subject: "S", body: "B"}}
}

function tools(onSleep?: (id: string) => void): SequenceStepTools {
	return {
		sleepUntil: async (id) => {
			if (onSleep) onSleep(id)
		},
		run: async (_id, fn) => fn(),
	}
}

beforeEach(() => {
	h.cLead = {id: "cl1", campaignId: "camp1", status: "ACTIVE", currentStep: 0, nextSendAt: new Date("2026-06-01T06:00:00Z"), repliedAt: null}
	h.campaign = {status: "ACTIVE", organizationId: "org1", sendingEmailAccountId: "acc1"}
	// all-day, all-week window + high daily limit so window/limit gates never defer in tests
	h.account = {id: "acc1", status: "CONNECTED", displayName: "Test", timezone: "Europe/Warsaw", sendWindowStartMin: 0, sendWindowEndMin: 1440, sendDays: 127, dailyLimit: 100, minGapSec: 0, maxGapSec: 0}
	h.steps = []
	h.messages.length = 0
	h.sendEmail.mockClear()
})

describe("runLeadSequenceHandler", () => {
	it("sends every step when there is no reply, then finalizes DONE", async () => {
		h.steps = [step(0, "SEND_IF_NO_REPLY", 0), step(1, "SEND_IF_NO_REPLY", 0)]
		await runLeadSequenceHandler("cl1", tools())
		expect(h.sendEmail).toHaveBeenCalledTimes(2)
		expect(h.messages).toHaveLength(2)
		expect(h.cLead.status).toBe("DONE")
	})

	it("skips a SEND_IF_NO_REPLY step after a reply and finalizes REPLIED", async () => {
		h.steps = [step(0, "SEND_IF_NO_REPLY", 0), step(1, "SEND_IF_NO_REPLY", 0)]
		await runLeadSequenceHandler("cl1", tools((id) => {
			if (id === "slot-1") {
				h.cLead.repliedAt = new Date("2026-06-02T10:00:00Z")
				h.cLead.status = "REPLIED"
			}
		}))
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.cLead.status).toBe("REPLIED")
	})

	it("still sends an ALWAYS step after a reply (lead stays REPLIED)", async () => {
		h.steps = [step(0, "SEND_IF_NO_REPLY", 0), step(1, "ALWAYS", 0)]
		await runLeadSequenceHandler("cl1", tools((id) => {
			if (id === "slot-1") {
				h.cLead.repliedAt = new Date("2026-06-02T10:00:00Z")
				h.cLead.status = "REPLIED"
			}
		}))
		expect(h.sendEmail).toHaveBeenCalledTimes(2)
		expect(h.cLead.status).toBe("REPLIED")
	})

	it("stops sending when the campaign is paused mid-sequence", async () => {
		h.steps = [step(0, "SEND_IF_NO_REPLY", 0), step(1, "SEND_IF_NO_REPLY", 0)]
		await runLeadSequenceHandler("cl1", tools((id) => {
			if (id === "slot-1") h.campaign.status = "PAUSED"
		}))
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.cLead.status).toBe("ACTIVE")
	})

	it("propagates send error (does NOT stomp status to FAILED) so Inngest can retry", async () => {
		h.steps = [step(0, "SEND_IF_NO_REPLY", 0)]
		h.sendEmail.mockRejectedValueOnce(new Error("smtp down"))
		await expect(runLeadSequenceHandler("cl1", tools())).rejects.toThrow("smtp down")
		expect(h.cLead.status).toBe("ACTIVE")
	})

	it("resumes mid-sequence from the persisted currentStep without resending earlier steps", async () => {
		h.steps = [
			{order: 0, condition: "SEND_IF_NO_REPLY", delayDays: 0, template: {subject: "step0", body: "b0"}},
			{order: 1, condition: "SEND_IF_NO_REPLY", delayDays: 0, template: {subject: "step1", body: "b1"}},
		]
		h.cLead.currentStep = 1 // step 0 already sent before a pause; resumed here
		await runLeadSequenceHandler("cl1", tools())
		expect(h.sendEmail).toHaveBeenCalledTimes(1)
		expect(h.messages).toHaveLength(1)
		expect(h.messages[0].subject).toBe("step1")
		expect(h.cLead.status).toBe("DONE")
		expect(h.cLead.currentStep).toBe(2)
	})
})
