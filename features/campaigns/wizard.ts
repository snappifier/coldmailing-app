export const WIZARD_FOLDER = "__kreator__"

export interface WizardMessage {
	subject: string
	body: string
	delayDays: number
	condition: "ALWAYS" | "SEND_IF_NO_REPLY"
}

export type WizardMessagesResult = {ok: true; messages: WizardMessage[]} | {ok: false; error: string}

// Flat FormData fields subject_0..3 / body_0..3 / delay_1..3 -> validated message list.
// Slot 0 is the opener (ALWAYS, delay 0); empty follow-up slots are skipped (the UI may remove a
// middle follow-up), half-filled ones are an error.
export function parseWizardMessages(fields: Record<string, unknown>): WizardMessagesResult {
	const messages: WizardMessage[] = []
	for (let i = 0; i <= 3; i++) {
		const subject = typeof fields[`subject_${i}`] === "string" ? (fields[`subject_${i}`] as string).trim() : ""
		const body = typeof fields[`body_${i}`] === "string" ? (fields[`body_${i}`] as string).trim() : ""
		if (i === 0) {
			if (!subject) return {ok: false, error: "Podaj temat wiadomości"}
			if (!body) return {ok: false, error: "Podaj treść wiadomości"}
			messages.push({subject, body, delayDays: 0, condition: "ALWAYS"})
			continue
		}
		if (!subject && !body) continue
		if (!subject || !body) return {ok: false, error: `Uzupełnij temat i treść follow-upu ${i}`}
		const delay = Number(fields[`delay_${i}`])
		if (!Number.isInteger(delay) || delay < 1 || delay > 30) return {ok: false, error: `Follow-up ${i}: opóźnienie musi być liczbą 1–30 dni`}
		messages.push({subject, body, delayDays: delay, condition: "SEND_IF_NO_REPLY"})
	}
	return {ok: true, messages}
}

export function buildWizardTemplateName(campaignName: string, index: number): string {
	return `${campaignName} — krok ${index + 1}`
}
