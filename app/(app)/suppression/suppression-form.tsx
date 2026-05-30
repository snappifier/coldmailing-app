"use client"
// app/(app)/suppression/suppression-form.tsx

import {useActionState} from "react"
import {addSuppression, type SuppressionResult} from "@/features/suppression/actions"

export function SuppressionForm() {
	const [state, action, pending] = useActionState<SuppressionResult | null, FormData>(addSuppression, null)
	return (
		<form className="flex items-end gap-2" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="email" placeholder="email@do-zablokowania.pl" required />
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj do suppression
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
