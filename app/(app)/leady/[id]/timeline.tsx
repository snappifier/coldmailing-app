// app/(app)/leady/[id]/timeline.tsx
import type {TimelineItem} from "@/features/pipeline/types"
import {deleteLeadActivity} from "@/features/pipeline/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {EmptyState} from "@/components/ui/empty-state"

const MANUAL = new Set(["NOTE", "CALL", "MEETING", "OFFER_SENT"])

export function LeadTimeline({items}: {items: TimelineItem[]}) {
	if (items.length === 0) return <EmptyState title="Brak aktywności" />
	return (
		<div className="flex flex-col gap-2">
			{items.map((it) => (
				<Card className="flex items-center justify-between gap-3 px-3.5 py-3" key={`${it.source}-${it.id}`}>
					<div className="min-w-0">
						<span className="text-sm font-medium">{it.title}</span>
						{it.detail ? <p className="mt-0.5 text-[12px] text-fg-faint">{it.detail}</p> : null}
						<p className="mt-0.5 text-[12px] text-fg-faint">{new Date(it.at).toLocaleString("pl-PL")}</p>
					</div>
					{it.source === "activity" && MANUAL.has(it.kind) ? (
						<div className="flex-none">
							<ConfirmButton action={deleteLeadActivity.bind(null, it.id)} confirm={{title: "Usunąć wpis?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto wpis">Usuń</ConfirmButton>
						</div>
					) : null}
				</Card>
			))}
		</div>
	)
}
