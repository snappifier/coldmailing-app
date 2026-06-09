"use client"
// app/(app)/linie/offering-line-form.tsx

import {useActionState} from "react"
import {createOfferingLine, type ActionResult} from "@/features/offering-lines/actions"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"

export function OfferingLineForm() {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(createOfferingLine, null)

	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<label className="flex flex-col text-sm">
				Nazwa
				<Input name="name" required />
			</label>
			<label className="flex flex-col text-sm">
				Opis
				<Input name="description" />
			</label>
			<Button variant="primary" type="submit" disabled={pending}>
				Dodaj
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
