import {describe, it, expect} from "vitest"
import {matchReplies} from "@/features/replies/match"

const tracked = {"t-1": "lead-1", "t-2": "lead-2"}

describe("matchReplies", () => {
	it("matches an inbound message on a tracked thread", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [{gmailMessageId: "m1", threadId: "t-1", from: "Dyrektor <dyr@szkola.pl>", labelIds: ["INBOX"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null}],
			trackedThreads: tracked,
		})
		expect(out).toEqual([{campaignLeadId: "lead-1", gmailMessageId: "m1", threadId: "t-1"}])
	})

	it("ignores our own sent messages (SENT label or self From)", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [
				{gmailMessageId: "s1", threadId: "t-1", from: "me@firma.pl", labelIds: ["SENT"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null},
				{gmailMessageId: "s2", threadId: "t-2", from: "Me <me@firma.pl>", labelIds: ["INBOX"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null},
			],
			trackedThreads: tracked,
		})
		expect(out).toEqual([])
	})

	it("ignores untracked threads", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [{gmailMessageId: "m9", threadId: "t-999", from: "x@y.pl", labelIds: ["INBOX"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null}],
			trackedThreads: tracked,
		})
		expect(out).toEqual([])
	})

	it("dedups to the first reply per lead", () => {
		const out = matchReplies({
			mailboxEmail: "me@firma.pl",
			added: [
				{gmailMessageId: "m1", threadId: "t-1", from: "a@szkola.pl", labelIds: ["INBOX"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null},
				{gmailMessageId: "m2", threadId: "t-1", from: "a@szkola.pl", labelIds: ["INBOX"], snippet: "", autoSubmitted: null, precedence: null, failedRecipients: null},
			],
			trackedThreads: tracked,
		})
		expect(out).toEqual([{campaignLeadId: "lead-1", gmailMessageId: "m1", threadId: "t-1"}])
	})
})
