"use client"
// app/(app)/leady/[id]/lead-edit-form.tsx

import {useActionState, useState} from "react"
import {updateLead, type LeadActionResult} from "@/features/leads/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {Card, CardBody} from "@/components/ui/card"

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
		score: number | null
		priority: number | null
		siteQuality: number | null
		aiHook: string | null
		aiNotes: string | null
	}
	customFields: {key: string; value: string}[]
}

export function LeadEditForm({lead, customFields}: Props) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(updateLead, null)
	const [rows, setRows] = useState<{key: string; value: string}[]>(customFields.length ? customFields : [{key: "", value: ""}])

	return (
		<form className="flex max-w-xl flex-col gap-3" action={action}>
			<input type="hidden" name="id" value={lead.id} />
			<Field label="Nazwa placówki">
				<Input name="organizationName" defaultValue={lead.organizationName} required />
			</Field>
			<Field label="Email">
				<Input name="email" defaultValue={lead.email ?? ""} />
			</Field>
			<Field label="WWW">
				<Input name="website" defaultValue={lead.website ?? ""} />
			</Field>
			<Field label="Osoba">
				<Input name="contactPersonName" defaultValue={lead.contactPersonName ?? ""} />
			</Field>
			<Field label="Rola">
				<Input name="contactRole" defaultValue={lead.contactRole ?? ""} />
			</Field>
			<Field label="Miasto">
				<Input name="city" defaultValue={lead.city ?? ""} />
			</Field>
			<Field label="Forma grzecznościowa">
				<Select name="honorific" defaultValue={lead.honorific ?? ""}>
					<option value="">—</option>
					<option value="PAN">Pan</option>
					<option value="PANI">Pani</option>
				</Select>
			</Field>

			<div className="flex flex-wrap gap-3">
				<Field label="Ocena (0-100)">
					<Input className="w-24" name="score" type="number" min={0} max={100} defaultValue={lead.score ?? ""} />
				</Field>
				<Field label="Priorytet (1-5)">
					<Input className="w-20" name="priority" type="number" min={1} max={5} defaultValue={lead.priority ?? ""} />
				</Field>
				<Field label="Jakość strony (1-5)">
					<Input className="w-24" name="siteQuality" type="number" min={1} max={5} defaultValue={lead.siteQuality ?? ""} />
				</Field>
			</div>
			<Field label="Hook AI">
				<Input name="aiHook" defaultValue={lead.aiHook ?? ""} />
			</Field>
			<Field label="Uzasadnienie / notatki AI">
				<Textarea name="aiNotes" defaultValue={lead.aiNotes ?? ""} />
			</Field>

			<Card>
				<CardBody className="flex flex-col gap-2">
					<span className="text-xs text-fg-muted">Pola własne</span>
					{rows.map((row, i) => (
						<div className="flex gap-2" key={i}>
							<Input
								className="w-40"
								name="cf_key"
								placeholder="klucz"
								value={row.key}
								onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, key: e.target.value} : r)))}
							/>
							<Input
								className="flex-1"
								name="cf_value"
								placeholder="wartość"
								value={row.value}
								onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, value: e.target.value} : r)))}
							/>
							<button
								className="shrink-0 px-1 text-sm text-danger"
								type="button"
								aria-label="Usuń pole"
								onClick={() => setRows(rows.filter((_, j) => j !== i))}
							>
								×
							</button>
						</div>
					))}
					<button className="self-start text-xs text-accent" type="button" onClick={() => setRows([...rows, {key: "", value: ""}])}>
						+ dodaj pole
					</button>
				</CardBody>
			</Card>

			<Button className="w-32" variant="primary" type="submit" disabled={pending}>
				Zapisz
			</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
			{state && state.ok ? <p className="text-sm text-success">Zapisano.</p> : null}
		</form>
	)
}
