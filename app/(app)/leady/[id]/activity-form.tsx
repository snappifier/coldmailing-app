"use client"

import {useActionState} from "react"
import {addLeadActivity, type PipelineActionResult} from "@/features/pipeline/actions"
import {Select} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {Button} from "@/components/ui/button"

export function ActivityForm({leadId}: {leadId: string}) {
	const [state, action, pending] = useActionState<PipelineActionResult | null, FormData>(addLeadActivity, null)
	return (
		<form className="flex flex-col gap-2 rounded border border-border p-2" action={action}>
			<input type="hidden" name="leadId" value={leadId} />
			<Select name="kind" defaultValue="NOTE">
				<option value="NOTE">Notatka</option>
				<option value="CALL">Telefon</option>
				<option value="MEETING">Spotkanie</option>
				<option value="OFFER_SENT">Oferta wysłana</option>
			</Select>
			<Textarea name="body" rows={2} placeholder="Treść wpisu" />
			<Button className="self-start" variant="primary" type="submit" disabled={pending}>
				Dodaj wpis
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
