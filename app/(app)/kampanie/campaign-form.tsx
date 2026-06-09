"use client"
// app/(app)/kampanie/campaign-form.tsx

import {useActionState} from "react"
import {createCampaign, type CampaignResult} from "@/features/campaigns/actions"

export function CampaignForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<CampaignResult | null, FormData>(createCampaign, null)
	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-border pb-4" action={action}>
			<input className="rounded border border-border px-2 py-1 text-sm" name="name" placeholder="Nazwa kampanii" required />
			<select className="rounded border border-border px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</select>
			<button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={pending}>
				Utwórz
			</button>
			{state && !state.ok ? <span className="text-sm text-danger">{state.error}</span> : null}
		</form>
	)
}
