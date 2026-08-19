import {cn} from "@/lib/cn"

const MAP = {
	warning: "bg-warning-quiet text-warning border-warning/25",
	info: "bg-surface-2 text-fg-muted border-border",
} as const

export function Note({variant = "warning", className, children}: {variant?: "warning" | "info"; className?: string; children: React.ReactNode}) {
	return <p className={cn("rounded-md border px-3 py-2.5 text-[12.5px] leading-snug", MAP[variant], className)}>{children}</p>
}
