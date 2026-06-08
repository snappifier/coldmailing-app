// features/research/lead-context.ts
export interface LeadContextInput {
	aiNotes: string | null
	score: number | null
	siteQuality: number | null
	region: string | null
	schoolType: string | null
	contactRole: string | null
	email: string | null
	phone: string | null
	customFields: unknown
}

function present(value: unknown): boolean {
	return value !== null && value !== undefined && String(value).trim() !== ""
}

// Plain-text block of the lead's already-gathered research, appended to a CONTENT prompt so the model
// can reuse prior research instead of re-searching. Sent only to the model, never to a customer email.
export function buildLeadContextBlock(lead: LeadContextInput): string {
	const lines: string[] = []
	const add = (label: string, value: unknown) => {
		if (present(value)) lines.push(`- ${label}: ${value}`)
	}
	add("Notatki researchu", lead.aiNotes)
	add("Ocena (score)", lead.score)
	add("Jakość strony", lead.siteQuality)
	add("Region", lead.region)
	add("Typ placówki", lead.schoolType)
	add("Rola kontaktu", lead.contactRole)
	add("Email", lead.email)
	add("Telefon", lead.phone)
	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	for (const [key, value] of Object.entries(cf)) {
		if (present(value)) lines.push(`- ${key}: ${value}`)
	}
	if (lines.length === 0) return ""
	return `Co już wiemy o tym leadzie (wykorzystaj te dane; researchuj ponownie tylko jeśli to konieczne):\n${lines.join("\n")}`
}
