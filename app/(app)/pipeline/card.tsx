"use client"
// app/(app)/pipeline/card.tsx

import {useRouter} from "next/navigation"
import type {PipelineLead} from "@/features/pipeline/types"

export function LeadCard({lead}: {lead: PipelineLead}) {
	const router = useRouter()
	const sub = [lead.city, lead.lineName].filter(Boolean).join(" · ")
	return (
		<div
			draggable
			onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
			onClick={() => router.push(`/leady/${lead.id}`)}
			className="cursor-pointer rounded border border-zinc-200 bg-white p-2 text-xs shadow-sm hover:border-zinc-300"
		>
			<div className="font-semibold">{lead.organizationName}</div>
			<div className="text-zinc-500">{sub || "—"}</div>
			<div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
				<span>{lead.sequenceStatus ?? ""}</span>
					<span>{lead.score != null ? `score ${lead.score}` : ""}</span>
				<span>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString("pl-PL") : ""}</span>
			</div>
		</div>
	)
}
