// features/campaigns/activation.ts
export type ActivateResult = {ok: true} | {ok: false; error: string}

export interface ActivationFacts {
	sendingEmailAccountId: string | null
	hasStepZero: boolean
	pendingLeadCount: number
}

// Pure precondition check for campaign activation (unit-tested).
export function validateActivation(f: ActivationFacts): ActivateResult {
	if (!f.sendingEmailAccountId) return {ok: false, error: "Wybierz skrzynkę wysyłkową"}
	if (!f.hasStepZero) return {ok: false, error: "Dodaj pierwszy krok sekwencji"}
	if (f.pendingLeadCount <= 0) return {ok: false, error: "Brak leadów do wysłania"}
	return {ok: true}
}
