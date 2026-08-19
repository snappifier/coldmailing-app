import {google, type gmail_v1} from "googleapis"
import {oauthClientFor, type SendableAccount} from "@/features/sending/gmail"
import type {AddedMessage} from "@/features/replies/match"

export type FetchedMessage = AddedMessage & {subject: string}

export interface HistoryResult {
	added: FetchedMessage[]
	newHistoryId: string | null
	expired: boolean
}

function gmailFor(account: SendableAccount) {
	return google.gmail({version: "v1", auth: oauthClientFor(account)})
}

export async function getProfileHistoryId(account: SendableAccount): Promise<string | null> {
	const res = await gmailFor(account).users.getProfile({userId: "me"})
	return res.data.historyId ?? null
}

// Read the messageAdded delta since startHistoryId. expired=true when Gmail rejects a stale cursor (404).
export async function listAddedSince(account: SendableAccount, startHistoryId: string): Promise<HistoryResult> {
	const gmail = gmailFor(account)
	const added: FetchedMessage[] = []
	let newHistoryId: string | null = null
	let pageToken: string | undefined = undefined
	try {
		do {
			const params: gmail_v1.Params$Resource$Users$History$List = {userId: "me", startHistoryId, historyTypes: ["messageAdded"], pageToken}
			const res = await gmail.users.history.list(params)
			newHistoryId = res.data.historyId ?? newHistoryId
			for (const h of res.data.history ?? []) {
				for (const m of h.messagesAdded ?? []) {
					const id = m.message?.id
					const threadId = m.message?.threadId
					if (!id || !threadId) continue
					const meta = await gmail.users.messages.get({
						userId: "me",
						id,
						format: "metadata",
						metadataHeaders: ["From", "Subject", "Auto-Submitted", "Precedence", "X-Failed-Recipients"],
					})
					const headers = meta.data.payload?.headers ?? []
					const hv = (name: string) => headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? null
					added.push({
						gmailMessageId: id,
						threadId,
						from: hv("From") ?? "",
						subject: hv("Subject") ?? "",
						labelIds: meta.data.labelIds ?? [],
						snippet: meta.data.snippet ?? "",
						autoSubmitted: hv("Auto-Submitted"),
						precedence: hv("Precedence"),
						failedRecipients: hv("X-Failed-Recipients"),
					})
				}
			}
			pageToken = res.data.nextPageToken ?? undefined
		} while (pageToken)
		return {added, newHistoryId, expired: false}
	} catch (err: unknown) {
		const e = err as {code?: number; status?: number}
		if (e.status === 404 || e.code === 404) return {added, newHistoryId: null, expired: true}
		throw err
	}
}
