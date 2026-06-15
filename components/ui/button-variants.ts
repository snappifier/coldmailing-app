// components/ui/button-variants.ts
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

const VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-primary text-primary-fg hover:opacity-90",
	secondary: "bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong",
	ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
	danger: "bg-danger-quiet text-danger border border-transparent hover:bg-danger/15 hover:border-danger/30",
}

export function buttonVariant(v: ButtonVariant | undefined): string {
	return VARIANTS[v ?? "secondary"]
}
