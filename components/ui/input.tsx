// components/ui/input.tsx
import {forwardRef, type InputHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

const base = "w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-fg-faint transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-hidden focus:border-border-focus focus:bg-surface-1"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({className, ...props}, ref) {
	return <input ref={ref} className={cn(base, className)} {...props} />
})
