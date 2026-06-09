"use client"
// components/ui/confirm-button.tsx
import {useTransition} from "react"
import {Button} from "@/components/ui/button"
import {Spinner} from "@/components/ui/spinner"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"
import type {ConfirmOptions} from "@/components/ui/confirm-state"
import type {ButtonVariant} from "@/components/ui/button-variants"

interface Props {
	action: () => Promise<unknown>
	confirm: ConfirmOptions
	children: React.ReactNode
	variant?: ButtonVariant
	size?: "sm" | "md"
	toast?: string
	className?: string
}

export function ConfirmButton({action, confirm, children, variant = "danger", size = "sm", toast, className}: Props) {
	const ask = useConfirm()
	const notify = useToast()
	const [pending, start] = useTransition()

	async function onClick() {
		if (!(await ask(confirm))) return
		start(async () => {
			await action()
			if (toast) notify(toast)
		})
	}

	return (
		<Button className={className} type="button" variant={variant} size={size} disabled={pending} onClick={onClick}>
			{pending ? <Spinner className="size-3.5" /> : null}
			{children}
		</Button>
	)
}
