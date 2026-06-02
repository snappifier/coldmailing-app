"use client"
// app/(app)/kampanie/[id]/lead-inbox.tsx

import {markDoNotContact} from "@/features/suppression/actions"

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
	if (rows.length === 0) return <p className="text-sm text-zinc-500">Brak leadów z przychodzącą wiadomością.</p>
	return (
		<ul className="flex flex-col gap-1 text-sm">
			{rows.map((r) => (
				<li className="flex items-center justify-between gap-3 border-b border-zinc-100 py-1" key={r.id}>
					<span className="min-w-0">
						<span className="font-medium">{r.org}</span> · {r.status}
						{r.inboundKind ? <span className="ml-1 rounded bg-zinc-100 px-1 text-xs text-zinc-700">{BADGE[r.inboundKind] ?? r.inboundKind}</span> : null}
						{r.snippet ? <span className="ml-2 truncate text-zinc-500">{r.snippet}</span> : null}
					</span>
					<form action={markDoNotContact.bind(null, r.id)}>
						<button className="shrink-0 text-red-600" type="submit">
							Nie kontaktować
						</button>
					</form>
				</li>
			))}
		</ul>
	)
}
