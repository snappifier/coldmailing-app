// features/sending/recipient.ts
export interface ResolvedRecipient {
	to: string
	overridden: boolean
}

// When SEND_OVERRIDE_TO is set, every email is rerouted to it (dev safety guard).
export function resolveRecipient(leadEmail: string, overrideTo: string | null | undefined): ResolvedRecipient {
	const override = (overrideTo ?? "").trim()
	if (override) return {to: override, overridden: true}
	return {to: leadEmail, overridden: false}
}
