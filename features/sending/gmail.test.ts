// features/sending/gmail.test.ts
import {describe, it, expect, vi, beforeAll} from "vitest"

interface SendArg {
	userId: string
	requestBody: {raw: string}
}

const sendMock = vi.fn(async (_arg: SendArg) => ({data: {id: "gmail-1", threadId: "thread-1"}}))
const setCredentials = vi.fn()
const on = vi.fn()

vi.mock("googleapis", () => {
	class OAuth2 {
		setCredentials = setCredentials
		on = on
	}
	return {
		google: {
			auth: {OAuth2},
			gmail: vi.fn(() => ({users: {messages: {send: sendMock}}})),
		},
	}
})

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
	process.env.GOOGLE_MAILBOX_CLIENT_ID = "id"
	process.env.GOOGLE_MAILBOX_CLIENT_SECRET = "secret"
	process.env.GOOGLE_MAILBOX_REDIRECT_URI = "http://localhost/cb"
})

describe("sendEmail", () => {
	it("sends base64url raw to userId 'me' and maps ids", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {sendEmail} = await import("@/features/sending/gmail")
		const account = {
			email: "mailbox@me.pl",
			displayName: "Salon",
			accessTokenEnc: encryptSecret("access"),
			refreshTokenEnc: encryptSecret("refresh"),
			tokenExpiresAt: null,
		}
		const res = await sendEmail(account as never, {to: "c@d.pl", subject: "Hi", text: "Hello"})
		expect(res).toEqual({gmailMessageId: "gmail-1", gmailThreadId: "thread-1"})
		const arg = sendMock.mock.calls[0]?.[0]
		expect(arg?.userId).toBe("me")
		expect(arg?.requestBody.raw).not.toMatch(/[+/=]/)
	})
})
