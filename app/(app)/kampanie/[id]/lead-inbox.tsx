"use client"
// app/(app)/kampanie/[id]/lead-inbox.tsx

import {markDoNotContact} from "@/features/suppression/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"

interface Row {
	id: string
	org: string
	status: string
	inboundKind: string | null
	snippet: string | null
}

const BADGE: Record<string, string> = {
	REPLY: "odpowiedź",
	BOUNCE: "odbicie",
	AUTO_REPLY: "auto",
	OPT_OUT_SUSPECT: "możliwa rezygnacja",
}

export function LeadInbox({rows}: {rows: Row[]}) {
	if (rows.length === 0) return <p className="text-sm text-fg-muted">Brak leadów z przychodzącą wiadomością.</p>
	return (
		<ul className="flex flex-col gap-1 text-sm">
			{rows.map((r) => (
				<li className="flex items-center justify-between gap-3 border-b border-border py-1" key={r.id}>
					<span className="min-w-0">
						<span className="font-medium">{r.org}</span> · {r.status}
						{r.inboundKind ? <span className="ml-1 rounded bg-surface-2 px-1 text-xs text-fg">{BADGE[r.inboundKind] ?? r.inboundKind}</span> : null}
						{r.snippet ? <span className="ml-2 truncate text-fg-muted">{r.snippet}</span> : null}
					</span>
					<ConfirmButton action={markDoNotContact.bind(null, r.id)} confirm={{title: "Oznaczyć: nie kontaktować?", body: "Adres trafi na listę wykluczeń, a sekwencja zostanie zatrzymana.", confirmLabel: "Nie kontaktować", danger: true}} toast="Oznaczono: nie kontaktować">Nie kontaktować</ConfirmButton>
				</li>
			))}
		</ul>
	)
}
