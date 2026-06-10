"use client"
// app/(app)/pipeline/card.tsx

import {useRouter} from "next/navigation"
import type {PipelineLead} from "@/features/pipeline/types"
import {Badge} from "@/components/ui/badge"
import {LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT} from "@/features/enums/labels"

export function LeadCard({lead}: {lead: PipelineLead}) {
	const router = useRouter()
	const sub = [lead.city, lead.lineName].filter(Boolean).join(" · ")
	return (
		<div
			draggable
			onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
			onClick={() => router.push(`/leady/${lead.id}`)}
			className="cursor-pointer rounded-lg border border-border bg-surface-1 p-2 text-xs shadow-card hover:border-border-strong"
		>
			<div className="font-semibold">{lead.organizationName}</div>
			<div className="text-fg-muted">{sub || "—"}</div>
			<div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-fg-faint">
				{lead.sequenceStatus != null ? (
					<Badge variant={LEAD_STATUS_VARIANT[lead.sequenceStatus]}>{LEAD_STATUS_LABEL[lead.sequenceStatus]}</Badge>
				) : (
					<span />
				)}
				<span>{lead.score != null ? `ocena ${lead.score}` : ""}</span>
				<span>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString("pl-PL") : ""}</span>
			</div>
		</div>
	)
}
