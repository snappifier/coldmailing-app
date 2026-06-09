"use client"
// components/ui/switch.tsx
import {cn} from "@/lib/cn"
export function Switch({checked, onChange, className}: {checked: boolean; onChange: (v: boolean) => void; className?: string}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-[22px] w-[38px] flex-none rounded-[999px] border transition-colors duration-200",
				checked ? "border-transparent bg-accent" : "border-border-strong bg-surface-3",
				"after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:transition-all after:duration-200",
				checked ? "after:left-[18px] after:bg-white" : "after:bg-fg-faint",
				className,
			)}
		/>
	)
}
