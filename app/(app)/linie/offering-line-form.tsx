"use client"

import {useActionState, useRef} from "react"
import {createOfferingLine, type ActionResult} from "@/features/offering-lines/actions"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"

export function OfferingLineForm({onSuccess}: {onSuccess?: () => void}) {
	const formRef = useRef<HTMLFormElement>(null)
	const toast = useToast()
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(
		async (prev, formData) => {
			const res = await createOfferingLine(prev, formData)
			if (res.ok) {
				toast("Dodano linię")
				formRef.current?.reset()
				onSuccess?.()
			}
			return res
		},
		null,
	)

	return (
		<form className="flex flex-col gap-3" ref={formRef} action={action}>
			<Field label="Nazwa">
				<Input name="name" required />
			</Field>
			<Field label="Opis">
				<Input name="description" />
			</Field>
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj linię
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
