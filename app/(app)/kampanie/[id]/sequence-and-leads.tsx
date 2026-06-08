"use client"
// app/(app)/kampanie/[id]/sequence-and-leads.tsx

import {useActionState} from "react"
import {addSequenceStep, assignLeads, deleteSequenceStep, type StepResult} from "@/features/campaigns/actions"

interface Props {
	campaignId: string
	templates: {id: string; name: string}[]
	offeringLines: {id: string; name: string}[]
	steps: {id: string; order: number; delayDays: number; condition: string; templateName: string; useLeadDraft: boolean}[]
}

export function SequenceAndLeads({campaignId, templates, offeringLines, steps}: Props) {
	const [stepState, stepAction, stepPending] = useActionState<StepResult | null, FormData>(addSequenceStep, null)
	const [assignState, assignAction, assignPending] = useActionState<StepResult | null, FormData>(assignLeads, null)

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Sekwencja</h2>
				<ol className="mb-3 flex flex-col gap-1 text-sm">
					{steps.map((s) => (
						<li className="flex items-center justify-between border-b border-zinc-100 py-1" key={s.id}>
							<span>
								#{s.order + 1} · {s.useLeadDraft ? "draft AI" : s.templateName} · po {s.delayDays} dniach · {s.condition}
								{s.useLeadDraft ? <span className="ml-1 rounded bg-violet-100 px-1 text-xs text-violet-700">draft</span> : null}
							</span>
							<form action={deleteSequenceStep.bind(null, s.id, campaignId)}>
								<button className="text-red-600" type="submit">
									Usuń
								</button>
							</form>
						</li>
					))}
					{steps.length === 0 ? <li className="py-1 text-zinc-500">Brak kroków.</li> : null}
				</ol>
				<form className="flex flex-wrap items-end gap-2" action={stepAction}>
					<input type="hidden" name="campaignId" value={campaignId} />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="templateId" defaultValue="">
						<option value="">— szablon —</option>
						{templates.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
					<input className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm" name="delayDays" type="number" min={0} defaultValue={0} placeholder="dni" />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="condition" defaultValue="SEND_IF_NO_REPLY">
						<option value="ALWAYS">ALWAYS</option>
						<option value="SEND_IF_NO_REPLY">SEND_IF_NO_REPLY</option>
					</select>
					<label className="flex items-center gap-1 text-sm text-zinc-700">
						<input type="checkbox" name="useLeadDraft" />
						Wyślij draft AI (zamiast szablonu)
					</label>
					<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={stepPending}>
						Dodaj krok
					</button>
					{stepState && !stepState.ok ? <span className="text-sm text-red-600">{stepState.error}</span> : null}
				</form>
			</div>

			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Przypisz leady</h2>
				<form className="flex flex-wrap items-end gap-2" action={assignAction}>
					<input type="hidden" name="campaignId" value={campaignId} />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
						<option value="">— wszystkie leady —</option>
						{offeringLines.map((l) => (
							<option key={l.id} value={l.id}>
								{l.name}
							</option>
						))}
					</select>
					<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={assignPending}>
						Przypisz
					</button>
					{assignState ? (
						assignState.ok ? <span className="text-sm text-green-700">Przypisano.</span> : <span className="text-sm text-red-600">{assignState.error}</span>
					) : null}
				</form>
			</div>
		</div>
	)
}
