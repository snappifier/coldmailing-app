"use client"

import {useActionState} from "react"
import {assignLeads, type StepResult} from "@/features/campaigns/actions"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function AssignLeadsForm({campaignId, offeringLines}: {campaignId: string; offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<StepResult | null, FormData>(assignLeads, null)

	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Przypisz leady</div>
			<form className="flex flex-wrap items-center gap-2" action={action}>
				<input type="hidden" name="campaignId" value={campaignId} />
				<Select className="w-64" name="offeringLineId" defaultValue="">
					<option value="">— wszystkie leady —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
				<Button variant="primary" type="submit" disabled={pending}>Przypisz</Button>
				{state ? (state.ok ? <span className="text-sm text-success">Przypisano.</span> : <span className="text-sm text-danger">{state.error}</span>) : null}
			</form>
		</div>
	)
}
