// features/replies/queries.test.ts
import {describe, it, expect, vi, beforeEach} from "vitest"
import type {InboundKind} from "@/generated/prisma/client"

const tx = {
	message: {
		findFirst: vi.fn(),
		create: vi.fn(),
	},
	campaignLead: {
		update: vi.fn(),
	},
	suppression: {
		upsert: vi.fn(),
	},
}

vi.mock("@/lib/prisma", () => ({
	prisma: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		$transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => cb(tx)),
	},
}))

import {recordInbound} from "@/features/replies/queries"

const baseInput = {
	organizationId: "org1",
	campaignLeadId: "cl1",
	emailAccountId: "acc1",
	mailboxEmail: "me@example.com",
	gmailMessageId: "gm1",
	gmailThreadId: "gt1",
	kind: "REPLY" as InboundKind,
	subject: "Re: test",
	snippet: "hello",
	autoSuppress: false,
	leadEmail: "lead@example.com",
}

beforeEach(() => {
	vi.clearAllMocks()
	tx.message.create.mockResolvedValue({})
	tx.campaignLead.update.mockResolvedValue({})
	tx.suppression.upsert.mockResolvedValue({})
})

describe("recordInbound", () => {
	it("skips creating a duplicate inbound when one already exists", async () => {
		tx.message.findFirst.mockResolvedValue({id: "existing"})
		await recordInbound(baseInput)
		expect(tx.message.create).not.toHaveBeenCalled()
		expect(tx.campaignLead.update).not.toHaveBeenCalled()
	})

	it("records a new inbound and applies the side effect", async () => {
		tx.message.findFirst.mockResolvedValue(null)
		await recordInbound(baseInput)
		expect(tx.message.create).toHaveBeenCalledTimes(1)
		expect(tx.campaignLead.update).toHaveBeenCalledWith(
			expect.objectContaining({data: expect.objectContaining({status: "REPLIED"})}),
		)
	})
})
