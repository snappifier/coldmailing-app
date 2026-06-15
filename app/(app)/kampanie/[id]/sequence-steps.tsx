"use client"
// app/(app)/kampanie/[id]/sequence-steps.tsx

import {useActionState, useState, useTransition} from "react"
import {addSequenceStep, updateSequenceStep, moveSequenceStep, deleteSequenceStep, type StepResult} from "@/features/campaigns/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {Select} from "@/components/ui/select"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {ChevronUpIcon, ChevronDownIcon} from "@/components/ui/icons"
import {useToast} from "@/components/ui/use-toast"
import {CONDITION_LABEL} from "@/features/enums/labels"
import type {SequenceCondition} from "@/generated/prisma/client"

export interface StepRow {
	id: string
	order: number
	delayDays: number
	condition: string
	templateId: string
	templateName: string
	useLeadDraft: boolean
}

interface Props {
	campaignId: string
	templates: {id: string; name: string}[]
	steps: StepRow[]
	campaignActive: boolean
}

function StepFields({templates, defaults}: {templates: {id: string; name: string}[]; defaults?: StepRow}) {
	return (
		<>
			<Select className="w-56" name="templateId" defaultValue={defaults?.templateId ?? ""}>
				<option value="">— szablon —</option>
				{templates.map((t) => (
					<option key={t.id} value={t.id}>
						{t.name}
					</option>
				))}
			</Select>
			<Input className="w-24" name="delayDays" type="number" min={0} defaultValue={defaults?.delayDays ?? 0} aria-label="Dni opóźnienia" />
			<Select className="w-52" name="condition" defaultValue={defaults?.condition ?? "SEND_IF_NO_REPLY"}>
				<option value="ALWAYS">{CONDITION_LABEL["ALWAYS"]}</option>
				<option value="SEND_IF_NO_REPLY">{CONDITION_LABEL["SEND_IF_NO_REPLY"]}</option>
			</Select>
			<label className="flex items-center gap-1.5 text-sm text-fg">
				<input type="checkbox" name="useLeadDraft" defaultChecked={defaults?.useLeadDraft ?? false} />
				Wyślij draft AI
			</label>
		</>
	)
}

export function SequenceSteps({campaignId, templates, steps, campaignActive}: Props) {
	const toast = useToast()
	const [editingId, setEditingId] = useState<string | null>(null)
	const [moveError, setMoveError] = useState<string | null>(null)
	const [moving, startMove] = useTransition()
	const [addState, addAction, addPending] = useActionState<StepResult | null, FormData>(addSequenceStep, null)
	const [updState, updAction, updPending] = useActionState<StepResult | null, FormData>(
		async (prev, formData) => {
			const res = await updateSequenceStep(prev, formData)
			if (res?.ok) {
				toast("Zapisano krok")
				setEditingId(null)
			}
			return res
		},
		null,
	)

	function move(stepId: string, dir: "up" | "down") {
		startMove(async () => {
			const res = await moveSequenceStep(stepId, dir, campaignId)
			setMoveError(res.ok ? null : res.error)
		})
	}

	const reorderHint = campaignActive ? "Wstrzymaj kampanię, aby zmienić kolejność" : undefined

	return (
		<div className="flex flex-col gap-3">
			{steps.length > 0 ? (
				<Card className="divide-y divide-border">
					{steps.map((s, i) => (
						<div className="px-3.5 py-2.5" key={s.id}>
							{editingId === s.id ? (
								<form className="flex flex-wrap items-center gap-2" action={updAction}>
									<input type="hidden" name="campaignId" value={campaignId} />
									<input type="hidden" name="stepId" value={s.id} />
									<span className="grid size-[22px] flex-none place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg-muted">{s.order + 1}</span>
									<StepFields templates={templates} defaults={s} />
									<span className="ml-auto flex flex-none gap-2">
										<Button variant="ghost" type="button" onClick={() => setEditingId(null)}>Anuluj</Button>
										<Button variant="primary" type="submit" disabled={updPending}>Zapisz</Button>
									</span>
									{updState && !updState.ok ? <span className="w-full text-sm text-danger">{updState.error}</span> : null}
								</form>
							) : (
								<div className="flex items-center gap-3">
									<span className="grid size-[22px] flex-none place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg-muted">{s.order + 1}</span>
									<span className="min-w-0">
										<span className="text-sm font-medium text-fg">{s.useLeadDraft ? "draft AI" : s.templateName}</span>
										{s.useLeadDraft ? <Badge className="ml-1.5" variant="neutral">draft</Badge> : null}
										<span className="block text-[12px] text-fg-faint">
											{s.delayDays === 0 ? "od razu" : `po ${s.delayDays} dniach`} · {CONDITION_LABEL[s.condition as SequenceCondition]}
										</span>
									</span>
									<span className="ml-auto flex flex-none items-center gap-1">
										<Button variant="ghost" size="sm" type="button" disabled={campaignActive || moving || i === 0} title={reorderHint ?? "Przesuń wyżej"} aria-label="Przesuń wyżej" onClick={() => move(s.id, "up")}><ChevronUpIcon className="size-3.5" /></Button>
										<Button variant="ghost" size="sm" type="button" disabled={campaignActive || moving || i === steps.length - 1} title={reorderHint ?? "Przesuń niżej"} aria-label="Przesuń niżej" onClick={() => move(s.id, "down")}><ChevronDownIcon className="size-3.5" /></Button>
										<Button variant="ghost" size="sm" type="button" onClick={() => setEditingId(s.id)}>Edytuj</Button>
										<ConfirmButton action={deleteSequenceStep.bind(null, s.id, campaignId)} confirm={{title: "Usunąć krok sekwencji?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto krok">Usuń</ConfirmButton>
									</span>
								</div>
							)}
						</div>
					))}
				</Card>
			) : (
				<p className="text-sm text-fg-muted">Brak kroków.</p>
			)}
			{moveError ? <p className="text-sm text-danger">{moveError}</p> : null}
			{campaignActive && steps.length > 1 ? <p className="text-[11.5px] text-fg-faint">Wstrzymaj kampanię, aby zmienić kolejność kroków.</p> : null}
			<form className="flex flex-wrap items-center gap-2 border-t border-border pt-4" action={addAction}>
				<input type="hidden" name="campaignId" value={campaignId} />
				<StepFields templates={templates} />
				<Button variant="primary" type="submit" disabled={addPending}>Dodaj krok</Button>
				{addState && !addState.ok ? <span className="text-sm text-danger">{addState.error}</span> : null}
			</form>
		</div>
	)
}
