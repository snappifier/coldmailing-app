// features/replies/classify.ts
export type DeterministicKind = "REPLY" | "BOUNCE" | "AUTO_REPLY"

export interface InboundFacts {
	from: string
	subject: string
	labelIds: string[]
	autoSubmitted: string | null
	precedence: string | null
	failedRecipients: string | null
}

const BOUNCE_FROM = /mailer-daemon|postmaster/i
const BOUNCE_SUBJECT = /delivery status notification|undelivered|delivery failed|delivery has failed|failure notice|returned mail|nie dostarczono/i
const AUTO_SUBJECT = /out of office|automatyczna odpowied|autoreply|auto-reply|nieobecno/i
const AUTO_PRECEDENCE = /auto_reply|bulk|junk/i

// Deterministic, header-based classification. OPT_OUT is a later refinement of REPLY (the detector).
export function classifyInbound(f: InboundFacts): DeterministicKind {
	if (BOUNCE_FROM.test(f.from) || f.failedRecipients || BOUNCE_SUBJECT.test(f.subject)) return "BOUNCE"
	const auto = f.autoSubmitted ? f.autoSubmitted.toLowerCase() : ""
	if ((auto !== "" && auto !== "no") || (f.precedence !== null && AUTO_PRECEDENCE.test(f.precedence)) || AUTO_SUBJECT.test(f.subject)) {
		return "AUTO_REPLY"
	}
	return "REPLY"
}
