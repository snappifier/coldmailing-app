"use client"
// app/(app)/leady/[id]/activity-form.tsx

import {useActionState} from "react"
import {addLeadActivity, type PipelineActionResult} from "@/features/pipeline/actions"

export function ActivityForm({leadId}: {leadId: string}) {
	const [state, action, pending] = useActionState<PipelineActionResult | null, FormData>(addLeadActivity, null)
	return (
		<form className="flex flex-col gap-2 rounded border border-border p-2" action={action}>
			<input type="hidden" name="leadId" value={leadId} />
			<select className="rounded border border-border px-2 py-1 text-sm" name="kind" defaultValue="NOTE">
				<option value="NOTE">Notatka</option>
				<option value="CALL">Telefon</option>
				<option value="MEETING">Spotkanie</option>
				<option value="OFFER_SENT">Oferta wysłana</option>
			</select>
			<textarea className="rounded border border-border px-2 py-1 text-sm" name="body" rows={2} placeholder="Treść wpisu" />
			<button className="self-start rounded bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj wpis
			</button>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
		</form>
	)
}
