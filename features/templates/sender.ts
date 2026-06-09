// features/templates/sender.ts

export const MAX_SIGNATURE_LEN = 2000

// Single source of truth for the {{podpisNadawcy}} value: the org signature if set,
// otherwise the sending mailbox name, otherwise empty (renders as [brak: podpisNadawcy]).
export function resolveSenderName(opts: {signature: string | null; fallback: string | null}): string {
	return (opts.signature ?? "").trim() || (opts.fallback ?? "").trim() || ""
}

export function sanitizeSignature(input: string): string {
	return input.trim().slice(0, MAX_SIGNATURE_LEN)
}
