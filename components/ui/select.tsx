// components/ui/select.tsx
import {forwardRef, type SelectHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({className, children, ...props}, ref) {
	return (
		<div className={cn("relative", className)}>
			<select
				ref={ref}
				className="w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-2 py-2 pl-2.5 pr-8 text-[13px] text-fg transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-hidden focus:border-border-focus focus:bg-surface-1"
				{...props}
			>
				{children}
			</select>
			<svg className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
		</div>
	)
})
