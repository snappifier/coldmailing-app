"use client"
// app/(app)/kampanie/[id]/campaign-header-actions.tsx

import {useActionState} from "react"
import {activateCampaign, pauseCampaign} from "@/features/campaigns/sending-actions"
import type {ActivateResult} from "@/features/campaigns/activation"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Button} from "@/components/ui/button"

interface Props {
	campaignId: string
	status: string
	canManageSending: boolean
	hasMailbox: boolean
}

export function CampaignHeaderActions({campaignId, status, canManageSending, hasMailbox}: Props) {
	const [state, action, pending] = useActionState<ActivateResult | null, FormData>(() => activateCampaign(campaignId), null)

	return (
		<div className="flex flex-none items-center gap-3">
			{state && !state.ok ? <span className="text-[12.5px] text-danger">{state.error}</span> : null}
			{status === "ACTIVE" ? (
				<ConfirmButton
					action={pauseCampaign.bind(null, campaignId)}
					confirm={{title: "Wstrzymać kampanię?", body: "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później.", confirmLabel: "Wstrzymaj", danger: false}}
					variant="secondary"
					size="md"
					toast="Wstrzymano kampanię"
				>
					Pauza
				</ConfirmButton>
			) : canManageSending ? (
				<form className="flex items-center gap-2.5" action={action}>
					{!hasMailbox ? <span className="text-[11.5px] text-fg-faint">ustaw skrzynkę, aby aktywować</span> : null}
					<Button variant="primary" type="submit" disabled={pending || !hasMailbox}>Aktywuj wysyłkę</Button>
				</form>
			) : null}
		</div>
	)
}
