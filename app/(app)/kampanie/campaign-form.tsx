"use client"
// app/(app)/kampanie/campaign-form.tsx

import {useActionState} from "react"
import {createCampaign, type CampaignResult} from "@/features/campaigns/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function CampaignForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<CampaignResult | null, FormData>(createCampaign, null)
	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-border pb-4" action={action}>
			<Input name="name" placeholder="Nazwa kampanii" required />
			<Select name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</Select>
			<Button variant="primary" type="submit" disabled={pending}>Utwórz</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
