// lib/inngest/replies.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {getProfileHistoryId, listAddedSince} from "@/features/replies/gmail-history"
import {getTrackedThreads, recordInbound} from "@/features/replies/queries"
import {matchReplies} from "@/features/replies/match"
import {classifyInbound} from "@/features/replies/classify"
import {getDetector} from "@/features/replies/optout"

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

		const org = await prisma.organization.findUnique({where: {id: account.organizationId}, select: {optOutMode: true, optOutDetector: true}})
		const mode = org?.optOutMode ?? "OFF"
		const detector = getDetector(org?.optOutDetector ?? "KEYWORD")

		for (const match of matches) {
			const msg = result.added.find((a) => a.gmailMessageId === match.gmailMessageId)
			if (!msg) continue
			const base = classifyInbound({
				from: msg.from,
				subject: msg.subject,
				labelIds: msg.labelIds,
				autoSubmitted: msg.autoSubmitted,
				precedence: msg.precedence,
				failedRecipients: msg.failedRecipients,
			})
			let kind: "REPLY" | "BOUNCE" | "AUTO_REPLY" | "OPT_OUT_SUSPECT" = base
			let autoSuppress = false
			if (base === "REPLY" && mode !== "OFF") {
				const verdict = await step.run(`detect-${match.campaignLeadId}`, () => detector.detect(msg.snippet))
				if (verdict.optOut) {
					kind = "OPT_OUT_SUSPECT"
					autoSuppress = mode === "AUTO"
				}
			}
			const lead = await prisma.campaignLead.findUnique({where: {id: match.campaignLeadId}, include: {lead: {select: {email: true}}}})
			await step.run(`record-${match.campaignLeadId}`, () =>
				recordInbound({
					organizationId: account.organizationId,
					campaignLeadId: match.campaignLeadId,
					emailAccountId: account.id,
					mailboxEmail: account.email,
					gmailMessageId: match.gmailMessageId,
					gmailThreadId: match.threadId,
					kind,
					subject: msg.subject,
					snippet: msg.snippet,
					autoSuppress,
					leadEmail: lead?.lead.email ?? null,
				}),
			)
			if (kind === "REPLY" || kind === "OPT_OUT_SUSPECT") {
				await step.sendEvent(`replied-${match.campaignLeadId}`, {name: "campaign/lead.replied", data: {campaignLeadId: match.campaignLeadId}})
			}
		}

		if (result.newHistoryId) {
			await step.run("advance-cursor", () => prisma.emailAccount.update({where: {id: account.id}, data: {lastHistoryId: result.newHistoryId}}))
		}
		return {replies: matches.length}
	},
)
