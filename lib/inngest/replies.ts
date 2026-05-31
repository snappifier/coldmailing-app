// lib/inngest/replies.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {getProfileHistoryId, listAddedSince} from "@/features/replies/gmail-history"
import {getTrackedThreads, recordReply} from "@/features/replies/queries"
import {matchReplies} from "@/features/replies/match"

// Every 5 minutes: fan out one poll per connected mailbox that granted the read scope.
export const scanMailboxesForReplies = inngest.createFunction(
	{id: "scan-mailboxes-for-replies", triggers: {cron: "*/5 * * * *"}},
	async ({step}) => {
		const mailboxes = await step.run("list-mailboxes", () =>
			prisma.emailAccount.findMany({
				where: {status: "CONNECTED", scope: {contains: "gmail.readonly"}},
				select: {id: true},
			}),
		)
		if (mailboxes.length === 0) return {scanned: 0}
		await step.sendEvent("fan-out-polls", mailboxes.map((m) => ({name: "campaign/mailbox.poll", data: {emailAccountId: m.id}})))
		return {scanned: mailboxes.length}
	},
)

export const pollMailboxReplies = inngest.createFunction(
	{
		id: "poll-mailbox-replies",
		triggers: {event: "campaign/mailbox.poll"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
		retries: 3,
	},
	async ({event, step}) => {
		const {emailAccountId} = event.data as {emailAccountId: string}
		const account = await prisma.emailAccount.findUnique({where: {id: emailAccountId}})
		if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

		// First run for this mailbox: set the baseline cursor and stop (nothing to diff yet).
		if (!account.lastHistoryId) {
			const hid = await step.run("baseline", () => getProfileHistoryId(account))
			if (hid) await step.run("save-baseline", () => prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: hid}}))
			return {baseline: hid}
		}

		const result = await step.run("list-history", () => listAddedSince(account, account.lastHistoryId!))
		if (result.expired) {
			const hid = await step.run("rebaseline", () => getProfileHistoryId(account))
			await step.run("save-rebaseline", () => prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: hid}}))
			return {rebaselined: hid}
		}

		const trackedThreads = await getTrackedThreads(account.id)
		const matches = matchReplies({mailboxEmail: account.email, added: result.added, trackedThreads})

		for (const match of matches) {
			const msg = result.added.find((a) => a.gmailMessageId === match.gmailMessageId)
			await step.run(`record-${match.campaignLeadId}`, () =>
				recordReply({
					organizationId: account.organizationId,
					campaignLeadId: match.campaignLeadId,
					emailAccountId: account.id,
					mailboxEmail: account.email,
					gmailMessageId: match.gmailMessageId,
					gmailThreadId: match.threadId,
					from: msg?.from ?? "",
					subject: msg?.subject ?? "",
				}),
			)
			await step.sendEvent(`replied-${match.campaignLeadId}`, {name: "campaign/lead.replied", data: {campaignLeadId: match.campaignLeadId}})
		}

		if (result.newHistoryId) {
			await step.run("advance-cursor", () => prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: result.newHistoryId}}))
		}
		return {replies: matches.length}
	},
)
