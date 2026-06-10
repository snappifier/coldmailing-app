// components/ui/badge.tsx
import {cn} from "@/lib/cn"

export type BadgeVariant = "neutral" | "ok" | "warn" | "bad" | "info"

const MAP: Record<BadgeVariant, string> = {
	neutral: "bg-surface-3 text-fg-muted border border-border",
	ok: "bg-success-quiet text-success",
	warn: "bg-warning-quiet text-warning",
	bad: "bg-danger-quiet text-danger",
	info: "bg-surface-3 text-fg border border-border",
}

export function Badge({variant = "neutral", dot, className, children}: {variant?: BadgeVariant; dot?: boolean; className?: string; children: React.ReactNode}) {
	return (
		<span className={cn("inline-flex h-[21px] items-center gap-1.5 rounded-[999px] px-2 text-[11.5px] font-medium", MAP[variant], className)}>
			{dot ? <span className="size-[5px] rounded-full bg-current" /> : null}
			{children}
		</span>
	)
}
