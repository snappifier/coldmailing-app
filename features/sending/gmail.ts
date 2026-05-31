// features/sending/gmail.ts
import {google} from "googleapis"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {encryptSecret, decryptSecret} from "@/lib/crypto"
import {buildRawMessage} from "@/features/sending/mime"

export interface SendableAccount {
	id?: string
	email: string
	displayName: string | null
	accessTokenEnc: string
	refreshTokenEnc: string
	tokenExpiresAt: Date | null
}

export interface SendInput {
	to: string
	subject: string
	text: string
}

export function oauthClientFor(account: SendableAccount) {
	const client = new google.auth.OAuth2(
		process.env.GOOGLE_MAILBOX_CLIENT_ID,
		process.env.GOOGLE_MAILBOX_CLIENT_SECRET,
		process.env.GOOGLE_MAILBOX_REDIRECT_URI,
	)
	client.setCredentials({
		access_token: decryptSecret(account.accessTokenEnc),
		refresh_token: decryptSecret(account.refreshTokenEnc),
		expiry_date: account.tokenExpiresAt ? account.tokenExpiresAt.getTime() : undefined,
	})
	// Persist refreshed tokens (refresh_token only returned on first consent).
	client.on("tokens", (tokens) => {
		if (!account.id) return
		const data: Prisma.EmailAccountUpdateInput = {}
		if (tokens.access_token) data.accessTokenEnc = encryptSecret(tokens.access_token)
		if (tokens.refresh_token) data.refreshTokenEnc = encryptSecret(tokens.refresh_token)
		if (tokens.expiry_date) data.tokenExpiresAt = new Date(tokens.expiry_date)
		if (Object.keys(data).length > 0) {
			void prisma.emailAccount.update({where: {id: account.id}, data}).catch(() => {})
		}
	})
	return client
}

export async function sendEmail(account: SendableAccount, input: SendInput): Promise<{gmailMessageId: string; gmailThreadId: string}> {
	const auth = oauthClientFor(account)
	const gmail = google.gmail({version: "v1", auth})
	const raw = buildRawMessage({
		from: account.displayName ? `${account.displayName} <${account.email}>` : account.email,
		to: input.to,
		subject: input.subject,
		text: input.text,
	})
	const res = await gmail.users.messages.send({userId: "me", requestBody: {raw}})
	return {gmailMessageId: res.data.id ?? "", gmailThreadId: res.data.threadId ?? ""}
}
