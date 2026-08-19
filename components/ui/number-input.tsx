"use client"
import {useRef, type InputHTMLAttributes} from "react"
import {cn} from "@/lib/cn"
import {ChevronUpIcon, ChevronDownIcon} from "@/components/ui/icons"

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">

export function NumberInput({className, disabled, ...props}: Props) {
	const ref = useRef<HTMLInputElement>(null)

	function step(dir: 1 | -1) {
		const el = ref.current
		if (!el) return
		if (dir === 1) el.stepUp()
		else el.stepDown()
	}

	const stepButton =
		"flex flex-1 items-center justify-center px-1 text-fg-faint transition-colors duration-150 hover:bg-surface-3 hover:text-fg disabled:pointer-events-none disabled:opacity-50"

	return (
		<div
			className={cn(
				"flex overflow-hidden rounded-md border border-border bg-surface-2 transition-[border-color,background] duration-150 hover:border-border-strong focus-within:border-border-focus focus-within:bg-surface-1",
				className,
			)}
		>
			<input ref={ref} className="w-full min-w-0 bg-transparent px-2.5 py-2 text-[13px] text-fg placeholder:text-fg-faint outline-hidden" type="number" disabled={disabled} {...props} />
			<div className="flex shrink-0 flex-col border-l border-border">
				<button className={stepButton} type="button" tabIndex={-1} aria-label="Zwiększ" disabled={disabled} onClick={() => step(1)}>
					<ChevronUpIcon className="size-3" />
				</button>
				<button className={cn(stepButton, "border-t border-border")} type="button" tabIndex={-1} aria-label="Zmniejsz" disabled={disabled} onClick={() => step(-1)}>
					<ChevronDownIcon className="size-3" />
				</button>
			</div>
		</div>
	)
}
