"use client"
// app/(app)/suppression/suppression-form.tsx

import {useActionState} from "react"
import {addSuppression, type SuppressionResult} from "@/features/suppression/actions"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"

export function SuppressionForm() {
	const [state, action, pending] = useActionState<SuppressionResult | null, FormData>(addSuppression, null)
	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<Input name="email" placeholder="email@do-zablokowania.pl" required />
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj do wykluczeń
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
