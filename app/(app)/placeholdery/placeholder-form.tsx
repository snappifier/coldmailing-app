"use client"
// app/(app)/placeholdery/placeholder-form.tsx

import {useActionState} from "react"
import {createPlaceholder, type PlaceholderResult} from "@/features/placeholders/actions"

export function PlaceholderForm() {
	const [state, action, pending] = useActionState<PlaceholderResult | null, FormData>(createPlaceholder, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-border pb-4" action={action}>
			<input className="rounded border border-border px-2 py-1 text-sm" name="key" placeholder="klucz (np. branza)" required />
			<input className="rounded border border-border px-2 py-1 text-sm" name="label" placeholder="Etykieta" required />
			<select className="rounded border border-border px-2 py-1 text-sm" name="type" defaultValue="TEXT">
				<option value="TEXT">TEXT</option>
				<option value="CHOICE">CHOICE</option>
			</select>
			<input className="rounded border border-border px-2 py-1 text-sm" name="options" placeholder="opcje CHOICE: a, b, c" />
			<input className="rounded border border-border px-2 py-1 text-sm" name="fallback" placeholder="fallback" />
			<input className="rounded border border-border px-2 py-1 text-sm" name="source" placeholder="source (opcjonalnie)" />
			<button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj
			</button>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
		</form>
	)
}
