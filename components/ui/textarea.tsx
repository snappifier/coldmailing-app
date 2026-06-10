// components/ui/textarea.tsx
import {forwardRef, type TextareaHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({className, ...props}, ref) {
	return (
		<textarea
			ref={ref}
			className={cn(
				"w-full min-h-24 resize-y rounded-md border border-border bg-surface-2 p-2.5 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-fg-faint transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-hidden focus:border-border-focus focus:bg-surface-1",
				className,
			)}
			{...props}
		/>
	)
})
