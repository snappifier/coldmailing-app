import {forwardRef, type InputHTMLAttributes} from "react"
import {cn} from "@/lib/cn"
import {CheckIcon} from "@/components/ui/icons"

// Native checkbox styled to the design system: appearance-none box + overlaid check.
// Checked = bg-accent (allowlisted checked-control state, like Switch ON); the global
// :focus-visible rule supplies the keyboard accent ring (no mouse-click ring).
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox({className, ...props}, ref) {
	return (
		<span className="relative inline-flex size-4 flex-none items-center justify-center">
			<input
				ref={ref}
				type="checkbox"
				className={cn("peer size-4 cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface-2 transition-colors checked:border-transparent checked:bg-accent", className)}
				{...props}
			/>
			<CheckIcon className="pointer-events-none invisible absolute size-3 text-white peer-checked:visible" />
		</span>
	)
})
