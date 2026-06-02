// features/replies/queries.ts
import {prisma} from "@/lib/prisma"
import type {InboundKind} from "@/generated/prisma/client"

// threadId -> campaignLeadId for this mailbox's outbound messages whose lead is not terminal (replied/unsubscribed/bounced).
export async function getTrackedThreads(emailAccountId: string): Promise<Record<string, string>> {
	const rows = await prisma.message.findMany({
		where: {
			emailAccountId,
			direction: "OUTBOUND",
			gmailThreadId: {not: null},
			campaignLead: {status: {notIn: ["REPLIED", "UNSUBSCRIBED", "BOUNCED"]}},
		},
		select: {gmailThreadId: true, campaignLeadId: true},
	})
	const map: Record<string, string> = {}
	for (const r of rows) {
		if (r.gmailThreadId) map[r.gmailThreadId] = r.campaignLeadId
	}
	return map
}

export interface RecordInboundInput {
	organizationId: string
	campaignLeadId: string
	emailAccountId: string
	mailboxEmail: string
	gmailMessageId: string
	gmailThreadId: string
	kind: InboundKind
	subject: string
	snippet: string
	autoSuppress: boolean
	leadEmail: string | null
}

// Persist the inbound message with its classification and apply the per-type side effects atomically.
export async function recordInbound(input: RecordInboundInput): Promise<void> {
	await prisma.$transaction(async (tx) => {
		await tx.message.create({
			data: {
				organizationId: input.organizationId,
				campaignLeadId: input.campaignLeadId,
				emailAccountId: input.emailAccountId,
				direction: "INBOUND",
				inboundKind: input.kind,
				subject: input.subject,
				body: input.snippet,
				intendedTo: input.mailboxEmail,
				actualTo: input.mailboxEmail,
				gmailMessageId: input.gmailMessageId,
				gmailThreadId: input.gmailThreadId,
			},
		})
		if (input.kind === "BOUNCE") {
			await tx.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "BOUNCED"}})
		} else if (input.kind === "REPLY" || input.kind === "OPT_OUT_SUSPECT") {
			await tx.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "REPLIED", repliedAt: new Date()}})
		}
		// AUTO_REPLY: record only, no status change.
		if (input.autoSuppress && input.leadEmail) {
			await tx.suppression.upsert({
				where: {organizationId_email: {organizationId: input.organizationId, email: input.leadEmail}},
				update: {},
				create: {organizationId: input.organizationId, email: input.leadEmail, reason: "UNSUBSCRIBED"},
			})
			await tx.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "UNSUBSCRIBED"}})
		}
	})
}
