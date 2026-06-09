"use client"
// app/(app)/kampanie/[id]/lead-inbox.tsx

import {markDoNotContact} from "@/features/suppression/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Badge} from "@/components/ui/badge"
import {LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT, INBOUND_KIND_LABEL, INBOUND_KIND_VARIANT} from "@/features/enums/labels"
import type {CampaignLeadStatus, InboundKind} from "@/generated/prisma/client"

interface Row {
	id: string
	org: string
	status: string
	inboundKind: string | null
	snippet: string | null
}

export function LeadInbox({rows}: {rows: Row[]}) {
	if (rows.length === 0) return <p className="text-sm text-fg-muted">Brak leadów z przychodzącą wiadomością.</p>
	return (
		<ul className="flex flex-col gap-1 text-sm">
			{rows.map((r) => (
				<li className="flex items-center justify-between gap-3 border-b border-border py-1" key={r.id}>
					<span className="flex min-w-0 flex-wrap items-center gap-1.5">
						<span className="font-medium">{r.org}</span>
						<Badge variant={LEAD_STATUS_VARIANT[r.status as CampaignLeadStatus]}>{LEAD_STATUS_LABEL[r.status as CampaignLeadStatus]}</Badge>
						{r.inboundKind ? <Badge variant={INBOUND_KIND_VARIANT[r.inboundKind as InboundKind]}>{INBOUND_KIND_LABEL[r.inboundKind as InboundKind]}</Badge> : null}
						{r.snippet ? <span className="inline-block max-w-[14rem] truncate align-bottom text-fg-muted">{r.snippet}</span> : null}
					</span>
					<ConfirmButton action={markDoNotContact.bind(null, r.id)} confirm={{title: "Oznaczyć: nie kontaktować?", body: "Adres trafi na listę wykluczeń, a sekwencja zostanie zatrzymana.", confirmLabel: "Nie kontaktować", danger: true}} toast="Oznaczono: nie kontaktować">Nie kontaktować</ConfirmButton>
				</li>
			))}
		</ul>
	)
}
