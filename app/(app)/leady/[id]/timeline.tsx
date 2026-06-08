// app/(app)/leady/[id]/timeline.tsx
import type {TimelineItem} from "@/features/pipeline/types"
import {deleteLeadActivity} from "@/features/pipeline/actions"

const MANUAL = new Set(["NOTE", "CALL", "MEETING", "OFFER_SENT"])

export function LeadTimeline({items}: {items: TimelineItem[]}) {
	if (items.length === 0) return <p className="text-sm text-zinc-400">Brak aktywności.</p>
	return (
		<ul className="flex flex-col gap-2">
			{items.map((it) => (
				<li className="rounded border border-zinc-100 p-2 text-sm" key={`${it.source}-${it.id}`}>
					<div className="flex items-center justify-between">
						<span className="font-medium">{it.title}</span>
						<span className="text-xs text-zinc-400">{new Date(it.at).toLocaleString("pl-PL")}</span>
					</div>
					{it.detail ? <div className="text-zinc-600">{it.detail}</div> : null}
					{it.source === "activity" && MANUAL.has(it.kind) ? (
						<form action={deleteLeadActivity.bind(null, it.id)}>
							<button className="text-xs text-red-600" type="submit">
								Usuń
							</button>
						</form>
					) : null}
				</li>
			))}
		</ul>
	)
}
