import {forwardRef, type ButtonHTMLAttributes} from "react"
import {cn} from "@/lib/cn"
import {buttonVariant, type ButtonVariant} from "@/components/ui/button-variants"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	size?: "sm" | "md"
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({variant, size = "md", className, ...props}, ref) {
	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center gap-2 rounded-md font-medium tracking-[-0.01em] transition-[transform,background,border-color,opacity] duration-150 ease-out active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none",
				size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
				buttonVariant(variant),
				className,
			)}
			{...props}
		/>
	)
})
