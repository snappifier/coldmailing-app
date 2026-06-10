"use client"
// app/(app)/suppression/suppression-form.tsx

import {useActionState, useRef} from "react"
import {addSuppression, type SuppressionResult} from "@/features/suppression/actions"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"

export function SuppressionForm({onSuccess}: {onSuccess?: () => void}) {
	const formRef = useRef<HTMLFormElement>(null)
	const toast = useToast()
	const [state, action, pending] = useActionState<SuppressionResult | null, FormData>(
		async (prev, formData) => {
			const res = await addSuppression(prev, formData)
			if (res.ok) {
				toast("Dodano wykluczenie")
				formRef.current?.reset()
				onSuccess?.()
			}
			return res
		},
		null,
	)
	return (
		<form className="flex flex-col gap-3" ref={formRef} action={action}>
			<Field label="E-mail">
				<Input name="email" placeholder="email@do-zablokowania.pl" required />
			</Field>
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj do wykluczeń
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
