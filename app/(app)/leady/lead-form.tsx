"use client"
// app/(app)/leady/lead-form.tsx

import {useActionState} from "react"
import {createLead, type LeadActionResult} from "@/features/leads/actions"

export function LeadForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(createLead, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-zinc-200 pb-4" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="organizationName" placeholder="Nazwa placówki" required />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="email" placeholder="Email" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="website" placeholder="WWW" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="contactPersonName" placeholder="Osoba" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="city" placeholder="Miasto" />
			<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</select>
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj lead
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
