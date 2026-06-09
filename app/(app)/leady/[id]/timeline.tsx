// app/(app)/leady/[id]/timeline.tsx
import type {TimelineItem} from "@/features/pipeline/types"
import {deleteLeadActivity} from "@/features/pipeline/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"

const MANUAL = new Set(["NOTE", "CALL", "MEETING", "OFFER_SENT"])

export function LeadTimeline({items}: {items: TimelineItem[]}) {
	if (items.length === 0) return <p className="text-sm text-fg-faint">Brak aktywności.</p>
	return (
		<ul className="flex flex-col gap-2">
			{items.map((it) => (
				<li className="rounded border border-border p-2 text-sm" key={`${it.source}-${it.id}`}>
					<div className="flex items-center justify-between">
						<span className="font-medium">{it.title}</span>
						<span className="text-xs text-fg-faint">{new Date(it.at).toLocaleString("pl-PL")}</span>
					</div>
					{it.detail ? <div className="text-fg-muted">{it.detail}</div> : null}
					{it.source === "activity" && MANUAL.has(it.kind) ? (
						<ConfirmButton action={deleteLeadActivity.bind(null, it.id)} confirm={{title: "Usunąć wpis?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto wpis">Usuń</ConfirmButton>
					) : null}
				</li>
			))}
		</ul>
	)
}
