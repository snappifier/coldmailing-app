"use client"

import {useRouter} from "next/navigation"
import {useState} from "react"
import type {DealStage} from "@/generated/prisma/client"
import {STAGE_LABEL, type PipelineLead} from "@/features/pipeline/types"
import {moveLeadStage} from "@/features/pipeline/actions"
import {Button} from "@/components/ui/button"
import {ChevronUpIcon, ChevronDownIcon} from "@/components/ui/icons"
import {LeadCard} from "./card"

const CAP = 60

export function PipelineBoard({columns}: {columns: {stage: DealStage; leads: PipelineLead[]}[]}) {
	const router = useRouter()

	async function move(stage: DealStage, leadId: string) {
		const res = await moveLeadStage(leadId, stage)
		if (res.ok) router.refresh()
		else alert(res.error)
	}

	return (
		<div className="flex gap-2 overflow-x-auto pb-2">
			{columns.map((col) => (
				<Column key={col.stage} stage={col.stage} leads={col.leads} onDropLead={move} />
			))}
		</div>
	)
}

function Column({stage, leads, onDropLead}: {stage: DealStage; leads: PipelineLead[]; onDropLead: (s: DealStage, id: string) => void}) {
	const [over, setOver] = useState(false)
	const [expanded, setExpanded] = useState(false)
	const collapsible = stage === "WON" || stage === "LOST"
	const [open, setOpen] = useState(!collapsible)
	const shown = expanded ? leads : leads.slice(0, CAP)

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setOver(true)
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault()
				setOver(false)
				const id = e.dataTransfer.getData("text/plain")
				if (id) onDropLead(stage, id)
			}}
			className={`flex w-56 shrink-0 flex-col gap-2 rounded-lg p-2 ${over ? "bg-surface-3 ring-1 ring-border-strong" : "bg-surface-2"}`}
		>
			<button
				type="button"
				onClick={() => collapsible && setOpen(!open)}
				aria-label={collapsible ? (open ? `Zwiń kolumnę ${STAGE_LABEL[stage]}` : `Rozwiń kolumnę ${STAGE_LABEL[stage]}`) : undefined}
				className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-fg-muted"
			>
				<span>
					{STAGE_LABEL[stage]} · {leads.length}
				</span>
				{collapsible ? (open ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />) : null}
			</button>
			{open ? (
				<>
					{shown.map((lead) => (
						<LeadCard key={lead.id} lead={lead} />
					))}
					{!expanded && leads.length > CAP ? (
						<Button variant="ghost" size="sm" type="button" onClick={() => setExpanded(true)}>
							+ {leads.length - CAP} więcej
						</Button>
					) : null}
					{leads.length === 0 ? <p className="text-xs text-fg-faint">Brak leadów</p> : null}
				</>
			) : null}
		</div>
	)
}
