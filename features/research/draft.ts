export interface DraftSchema {
	type: "object"
	additionalProperties: false
	properties: {subject: {type: "string"}; body: {type: "string"}}
	required: ["subject", "body"]
}

export function buildDraftSchema(): DraftSchema {
	return {type: "object", additionalProperties: false, properties: {subject: {type: "string"}, body: {type: "string"}}, required: ["subject", "body"]}
}

export function coerceDraft(findings: Record<string, unknown>): {ok: true; subject: string; body: string} | {ok: false} {
	const subject = typeof findings.subject === "string" ? findings.subject.trim() : ""
	const body = typeof findings.body === "string" ? findings.body.trim() : ""
	if (!subject || !body) return {ok: false}
	return {ok: true, subject, body}
}
