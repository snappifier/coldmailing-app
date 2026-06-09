"use client"
// app/(app)/kampanie/[id]/sending-controls.tsx

import {useActionState} from "react"
import {activateCampaign, pauseCampaign, setSendingMailbox} from "@/features/campaigns/sending-actions"
import type {ActivateResult} from "@/features/campaigns/activation"
import {ConfirmButton} from "@/components/ui/confirm-button"

interface Props {
	campaignId: string
	mailboxes: {id: string; email: string}[]
	currentMailboxId: string | null
}

export function SendingControls({campaignId, mailboxes, currentMailboxId}: Props) {
	const [activateState, activateAction, activatePending] = useActionState<ActivateResult | null, FormData>(
		() => activateCampaign(campaignId),
		null,
	)

	return (
		<div>
			<h2 className="mb-2 text-sm font-semibold text-fg">Wysyłka</h2>
			<div className="flex flex-wrap items-end gap-2">
				<form
					className="flex items-end gap-2"
					action={(formData) => setSendingMailbox(campaignId, String(formData.get("emailAccountId") ?? ""))}
				>
					<select className="rounded border border-border px-2 py-1 text-sm" name="emailAccountId" defaultValue={currentMailboxId ?? ""}>
						<option value="">— skrzynka wysyłkowa —</option>
						{mailboxes.map((m) => (
							<option key={m.id} value={m.id}>
								{m.email}
							</option>
						))}
					</select>
					<button className="rounded border border-border px-3 py-1.5 text-sm" type="submit">
						Zapisz skrzynkę
					</button>
				</form>
				<form action={activateAction}>
					<button className="rounded bg-primary px-3 py-1.5 text-sm text-primary-fg disabled:opacity-50" type="submit" disabled={activatePending}>
						Aktywuj wysyłkę
					</button>
				</form>
				<ConfirmButton action={pauseCampaign.bind(null, campaignId)} confirm={{title: "Wstrzymać kampanię?", body: "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później.", confirmLabel: "Wstrzymaj", danger: false}} variant="secondary" size="md" toast="Wstrzymano kampanię">
					Pauza
				</ConfirmButton>
			</div>
			{activateState && !activateState.ok ? <p className="mt-2 text-sm text-danger">{activateState.error}</p> : null}
			{activateState && activateState.ok ? <p className="mt-2 text-sm text-success">Wysyłka aktywowana.</p> : null}
			{mailboxes.length === 0 ? (
				<p className="mt-2 text-sm text-fg-muted">
					Brak skrzynek.{" "}
					<a className="text-accent" href="/skrzynki">
						Połącz skrzynkę
					</a>
					.
				</p>
			) : null}
		</div>
	)
}
