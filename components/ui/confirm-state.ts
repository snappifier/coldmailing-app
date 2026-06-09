// components/ui/confirm-state.ts
export interface ConfirmOptions {
	title: string
	body?: string
	confirmLabel?: string
	cancelLabel?: string
	danger?: boolean
}
export interface ResolvedConfirm extends Required<Omit<ConfirmOptions, "body">> {
	body: string
}
export function defaultConfirmOptions(o: ConfirmOptions): ResolvedConfirm {
	return {
		title: o.title,
		body: o.body ?? "",
		confirmLabel: o.confirmLabel ?? "Potwierdź",
		cancelLabel: o.cancelLabel ?? "Anuluj",
		danger: o.danger ?? false,
	}
}
