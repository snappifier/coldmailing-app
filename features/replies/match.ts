export interface AddedMessage {
	gmailMessageId: string
	threadId: string
	from: string
	labelIds: string[]
	snippet: string
	autoSubmitted: string | null
	precedence: string | null
	failedRecipients: string | null
}

export interface MatchInput {
	mailboxEmail: string
	added: AddedMessage[]
	trackedThreads: Record<string, string> // threadId -> campaignLeadId
}

export interface ReplyMatch {
	campaignLeadId: string
	gmailMessageId: string
	threadId: string
}

// Pure: pick inbound messages on tracked threads, excluding our own sends, one per lead.
export function matchReplies(input: MatchInput): ReplyMatch[] {
	const mailbox = input.mailboxEmail.toLowerCase()
	const seen = new Set<string>()
	const out: ReplyMatch[] = []
	for (const m of input.added) {
		if (m.labelIds.includes("SENT")) continue
		if (m.from.toLowerCase().includes(mailbox)) continue
		const campaignLeadId = input.trackedThreads[m.threadId]
		if (!campaignLeadId || seen.has(campaignLeadId)) continue
		seen.add(campaignLeadId)
		out.push({campaignLeadId, gmailMessageId: m.gmailMessageId, threadId: m.threadId})
	}
	return out
}
