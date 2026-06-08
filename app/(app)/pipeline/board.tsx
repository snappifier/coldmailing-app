"use client"
// app/(app)/pipeline/board.tsx

import {useRouter} from "next/navigation"
import {useState} from "react"
import type {DealStage} from "@/generated/prisma/client"
import {STAGE_LABEL, type PipelineLead} from "@/features/pipeline/types"
import {moveLeadStage} from "@/features/pipeline/actions"
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
			className={`flex w-56 shrink-0 flex-col gap-2 rounded-lg p-2 ${over ? "bg-blue-50" : "bg-zinc-100"}`}
		>
			<button
				type="button"
				onClick={() => collapsible && setOpen(!open)}
				className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-500"
			>
				<span>
					{STAGE_LABEL[stage]} · {leads.length}
				</span>
				{collapsible ? <span>{open ? "−" : "+"}</span> : null}
			</button>
			{open ? (
				<>
					{shown.map((lead) => (
						<LeadCard key={lead.id} lead={lead} />
					))}
					{!expanded && leads.length > CAP ? (
						<button type="button" onClick={() => setExpanded(true)} className="text-xs text-blue-600">
							+ {leads.length - CAP} więcej
						</button>
					) : null}
					{leads.length === 0 ? <div className="text-xs text-zinc-400">—</div> : null}
				</>
			) : null}
		</div>
	)
}
