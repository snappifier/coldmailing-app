"use client"
// app/(app)/linie/offering-line-form.tsx

import {useActionState} from "react"
import {createOfferingLine, type ActionResult} from "@/features/offering-lines/actions"

export function OfferingLineForm() {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(createOfferingLine, null)

	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<label className="flex flex-col text-sm">
				Nazwa
				<input className="rounded border border-border px-2 py-1" name="name" required />
			</label>
			<label className="flex flex-col text-sm">
				Opis
				<input className="rounded border border-border px-2 py-1" name="description" />
			</label>
			<button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj
			</button>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
		</form>
	)
}
