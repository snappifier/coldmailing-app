import {createHmac, timingSafeEqual} from "node:crypto"
import {google} from "googleapis"
import {encryptSecret} from "@/lib/crypto"

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
// Read-only identity scope so we can read the connected mailbox address (gmail.send alone cannot).
export const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email"
// Read scope for reply detection (Phase 5a): read message metadata + history.
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

function hmac(payload: string): string {
	const key = process.env.TOKEN_ENCRYPTION_KEY
	if (!key) throw new Error("TOKEN_ENCRYPTION_KEY is not set")
	return createHmac("sha256", Buffer.from(key, "base64")).update(payload).digest("base64url")
}

// state = base64url(orgId).signature  — signed so the callback can trust the org.
export function signState(orgId: string): string {
	const payload = Buffer.from(orgId, "utf8").toString("base64url")
	return `${payload}.${hmac(payload)}`
}

export function verifyState(state: string): string | null {
	const [payload, sig] = state.split(".")
	if (!payload || !sig) return null
	const expected = hmac(payload)
	const a = Buffer.from(sig)
	const b = Buffer.from(expected)
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null
	return Buffer.from(payload, "base64url").toString("utf8")
}

function client() {
	return new google.auth.OAuth2(
		process.env.GOOGLE_MAILBOX_CLIENT_ID,
		process.env.GOOGLE_MAILBOX_CLIENT_SECRET,
		process.env.GOOGLE_MAILBOX_REDIRECT_URI,
	)
}

export function buildConsentUrl(state: string): string {
	return client().generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: [GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE, GMAIL_READONLY_SCOPE],
		state,
	})
}

export interface ExchangedMailbox {
	email: string
	accessTokenEnc: string
	refreshTokenEnc: string
	tokenExpiresAt: Date | null
	scope: string | null
}

// Exchange the code, read the mailbox address, return encrypted, DB-ready fields.
export async function exchangeCodeToMailbox(code: string): Promise<ExchangedMailbox> {
	const c = client()
	const {tokens} = await c.getToken(code)
	c.setCredentials(tokens)
	const oauth2 = google.oauth2({version: "v2", auth: c})
	const profile = await oauth2.userinfo.get()
	const email = profile.data.email
	if (!email) throw new Error("Could not read mailbox email")
	if (!tokens.access_token || !tokens.refresh_token) throw new Error("Missing tokens (re-consent with prompt=consent)")
	return {
		email,
		accessTokenEnc: encryptSecret(tokens.access_token),
		refreshTokenEnc: encryptSecret(tokens.refresh_token),
		tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
		scope: tokens.scope ?? null,
	}
}
