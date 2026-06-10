"use client"
// app/(app)/kampanie/[id]/sending-controls.tsx

import {useActionState} from "react"
import {activateCampaign, pauseCampaign, setSendingMailbox} from "@/features/campaigns/sending-actions"
import type {ActivateResult} from "@/features/campaigns/activation"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

interface Props {
	campaignId: string
	mailboxes: {id: string; email: string}[]
	currentMailboxId: string | null
	canManageSending: boolean
}

export function SendingControls({campaignId, mailboxes, currentMailboxId, canManageSending}: Props) {
	const [activateState, activateAction, activatePending] = useActionState<ActivateResult | null, FormData>(
		() => activateCampaign(campaignId),
		null,
	)

	return (
		<div>
			<h2 className="mb-2 text-sm font-semibold text-fg">Wysyłka</h2>
			<div className="flex flex-wrap items-end gap-2">
				{canManageSending ? (
					<>
						<form
							className="flex items-end gap-2"
							action={(formData) => setSendingMailbox(campaignId, String(formData.get("emailAccountId") ?? ""))}
						>
							<Select name="emailAccountId" defaultValue={currentMailboxId ?? ""}>
								<option value="">— skrzynka wysyłkowa —</option>
								{mailboxes.map((m) => (
									<option key={m.id} value={m.id}>
										{m.email}
									</option>
								))}
							</Select>
							<Button type="submit">Zapisz skrzynkę</Button>
						</form>
						<form action={activateAction}>
							<Button variant="primary" type="submit" disabled={activatePending}>Aktywuj wysyłkę</Button>
						</form>
					</>
				) : null}
				<ConfirmButton action={pauseCampaign.bind(null, campaignId)} confirm={{title: "Wstrzymać kampanię?", body: "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później.", confirmLabel: "Wstrzymaj", danger: false}} variant="secondary" size="md" toast="Wstrzymano kampanię">
					Pauza
				</ConfirmButton>
			</div>
			{activateState && !activateState.ok ? <p className="mt-2 text-sm text-danger">{activateState.error}</p> : null}
			{activateState && activateState.ok ? <p className="mt-2 text-sm text-success">Wysyłka aktywowana.</p> : null}
			{mailboxes.length === 0 ? (
				<p className="mt-2 text-sm text-fg-muted">
					Brak skrzynek.{" "}
					<a className="text-fg underline underline-offset-2" href="/skrzynki">
						Połącz skrzynkę
					</a>
					.
				</p>
			) : null}
		</div>
	)
}
