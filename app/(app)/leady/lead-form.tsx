"use client"
// app/(app)/leady/lead-form.tsx

import {useActionState} from "react"
import {createLead, type LeadActionResult} from "@/features/leads/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function LeadForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(createLead, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-border pb-4" action={action}>
			<Input name="organizationName" placeholder="Nazwa placówki" required />
			<Input name="email" placeholder="Email" />
			<Input name="website" placeholder="WWW" />
			<Input name="contactPersonName" placeholder="Osoba" />
			<Input name="city" placeholder="Miasto" />
			<Select name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</Select>
			<Button className="shrink-0" variant="primary" type="submit" disabled={pending}>
				Dodaj lead
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
