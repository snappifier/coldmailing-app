"use client"
// app/(app)/leady/[id]/lead-edit-form.tsx

import {useActionState, useState} from "react"
import {updateLead, type LeadActionResult} from "@/features/leads/actions"

interface Props {
	lead: {
		id: string
		organizationName: string
		email: string | null
		website: string | null
		contactPersonName: string | null
		contactRole: string | null
		city: string | null
		honorific: "PAN" | "PANI" | null
	}
	customFields: {key: string; value: string}[]
}

export function LeadEditForm({lead, customFields}: Props) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(updateLead, null)
	const [rows, setRows] = useState<{key: string; value: string}[]>(customFields.length ? customFields : [{key: "", value: ""}])

	return (
		<form className="flex max-w-xl flex-col gap-3" action={action}>
			<input type="hidden" name="id" value={lead.id} />
			<label className="flex flex-col text-sm">
				Nazwa placówki
				<input className="rounded border border-zinc-300 px-2 py-1" name="organizationName" defaultValue={lead.organizationName} required />
			</label>
			<label className="flex flex-col text-sm">
				Email
				<input className="rounded border border-zinc-300 px-2 py-1" name="email" defaultValue={lead.email ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				WWW
				<input className="rounded border border-zinc-300 px-2 py-1" name="website" defaultValue={lead.website ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Osoba
				<input className="rounded border border-zinc-300 px-2 py-1" name="contactPersonName" defaultValue={lead.contactPersonName ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Rola
				<input className="rounded border border-zinc-300 px-2 py-1" name="contactRole" defaultValue={lead.contactRole ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Miasto
				<input className="rounded border border-zinc-300 px-2 py-1" name="city" defaultValue={lead.city ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Zwrot (honorific)
				<select className="rounded border border-zinc-300 px-2 py-1" name="honorific" defaultValue={lead.honorific ?? ""}>
					<option value="">—</option>
					<option value="PAN">Pan</option>
					<option value="PANI">Pani</option>
				</select>
			</label>

			<fieldset className="flex flex-col gap-2 rounded border border-zinc-200 p-2">
				<legend className="text-xs text-zinc-500">Pola własne (customFields)</legend>
				{rows.map((row, i) => (
					<div className="flex gap-2" key={i}>
						<input
							className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm"
							name="cf_key"
							placeholder="klucz"
							value={row.key}
							onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, key: e.target.value} : r)))}
						/>
						<input
							className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
							name="cf_value"
							placeholder="wartość"
							value={row.value}
							onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, value: e.target.value} : r)))}
						/>
					</div>
				))}
				<button className="self-start text-xs text-blue-600" type="button" onClick={() => setRows([...rows, {key: "", value: ""}])}>
					+ dodaj pole
				</button>
			</fieldset>

			<button className="w-32 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
			{state && state.ok ? <span className="text-sm text-green-700">Zapisano.</span> : null}
		</form>
	)
}
