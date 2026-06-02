// features/replies/gmail-history.test.ts
import {describe, it, expect, vi, beforeAll} from "vitest"

const getProfile = vi.fn(async () => ({data: {historyId: "1000"}}))
const historyList = vi.fn()
const messagesGet = vi.fn(async ({id}: {id: string}) => ({
	data: {labelIds: ["INBOX"], snippet: `snippet-${id}`, payload: {headers: [{name: "From", value: `s-${id}@szkola.pl`}, {name: "Subject", value: `Re ${id}`}]}},
}))
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
			gmail: vi.fn(() => ({users: {getProfile, history: {list: historyList}, messages: {get: messagesGet}}})),
		},
	}
})

beforeAll(() => {
	process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
	process.env.GOOGLE_MAILBOX_CLIENT_ID = "id"
	process.env.GOOGLE_MAILBOX_CLIENT_SECRET = "secret"
	process.env.GOOGLE_MAILBOX_REDIRECT_URI = "http://localhost/cb"
})

const account = {email: "me@firma.pl", displayName: null, accessTokenEnc: "", refreshTokenEnc: "", tokenExpiresAt: null}

describe("getProfileHistoryId", () => {
	it("returns the profile historyId", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {getProfileHistoryId} = await import("@/features/replies/gmail-history")
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		expect(await getProfileHistoryId(acc as never)).toBe("1000")
	})
})

describe("listAddedSince", () => {
	it("paginates and maps added messages with metadata", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {listAddedSince} = await import("@/features/replies/gmail-history")
		historyList
			.mockResolvedValueOnce({data: {history: [{messagesAdded: [{message: {id: "m1", threadId: "t-1"}}]}], historyId: "1100", nextPageToken: "p2"}})
			.mockResolvedValueOnce({data: {history: [{messagesAdded: [{message: {id: "m2", threadId: "t-2"}}]}], historyId: "1200"}})
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		const res = await listAddedSince(acc as never, "1000")
		expect(res.expired).toBe(false)
		expect(res.newHistoryId).toBe("1200")
		expect(res.added).toEqual([
			{gmailMessageId: "m1", threadId: "t-1", from: "s-m1@szkola.pl", subject: "Re m1", labelIds: ["INBOX"], snippet: "snippet-m1", autoSubmitted: null, precedence: null, failedRecipients: null},
			{gmailMessageId: "m2", threadId: "t-2", from: "s-m2@szkola.pl", subject: "Re m2", labelIds: ["INBOX"], snippet: "snippet-m2", autoSubmitted: null, precedence: null, failedRecipients: null},
		])
	})

	it("reports expired on a 404 history error", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {listAddedSince} = await import("@/features/replies/gmail-history")
		historyList.mockRejectedValueOnce(Object.assign(new Error("Not Found"), {code: 404, status: 404}))
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		const res = await listAddedSince(acc as never, "5")
		expect(res.expired).toBe(true)
		expect(res.added).toEqual([])
	})

	it("rethrows non-404 errors", async () => {
		const {encryptSecret} = await import("@/lib/crypto")
		const {listAddedSince} = await import("@/features/replies/gmail-history")
		historyList.mockRejectedValueOnce(Object.assign(new Error("Server Error"), {code: 500, status: 500}))
		const acc = {...account, accessTokenEnc: encryptSecret("a"), refreshTokenEnc: encryptSecret("r")}
		await expect(listAddedSince(acc as never, "5")).rejects.toThrow("Server Error")
	})
})
