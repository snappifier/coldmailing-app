// features/replies/queries.ts
import {prisma} from "@/lib/prisma"

// threadId -> campaignLeadId for this mailbox's outbound messages whose lead has not replied/unsubscribed.
export async function getTrackedThreads(emailAccountId: string): Promise<Record<string, string>> {
	const rows = await prisma.message.findMany({
		where: {
			emailAccountId,
			direction: "OUTBOUND",
			gmailThreadId: {not: null},
			campaignLead: {status: {notIn: ["REPLIED", "UNSUBSCRIBED"]}},
		},
		select: {gmailThreadId: true, campaignLeadId: true},
	})
	const map: Record<string, string> = {}
	for (const r of rows) {
		if (r.gmailThreadId) map[r.gmailThreadId] = r.campaignLeadId
	}
	return map
}

export interface RecordReplyInput {
	organizationId: string
	campaignLeadId: string
	emailAccountId: string
	mailboxEmail: string
	gmailMessageId: string
	gmailThreadId: string
	from: string
	subject: string
}

// Log the inbound reply and flip the lead to REPLIED, atomically.
export async function recordReply(input: RecordReplyInput): Promise<void> {
	await prisma.$transaction([
		prisma.message.create({
			data: {
				organizationId: input.organizationId,
				campaignLeadId: input.campaignLeadId,
				emailAccountId: input.emailAccountId,
				direction: "INBOUND",
				subject: input.subject,
				body: input.from,
				intendedTo: input.mailboxEmail,
				actualTo: input.mailboxEmail,
				gmailMessageId: input.gmailMessageId,
				gmailThreadId: input.gmailThreadId,
			},
		}),
		prisma.campaignLead.update({where: {id: input.campaignLeadId}, data: {status: "REPLIED", repliedAt: new Date()}}),
	])
}
