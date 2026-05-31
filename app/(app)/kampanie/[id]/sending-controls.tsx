"use client"
// app/(app)/kampanie/[id]/sending-controls.tsx

import {useActionState} from "react"
import {activateCampaign, pauseCampaign, setSendingMailbox} from "@/features/campaigns/sending-actions"
import type {ActivateResult} from "@/features/campaigns/activation"

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
			<h2 className="mb-2 text-sm font-semibold text-zinc-700">Wysyłka</h2>
			<div className="flex flex-wrap items-end gap-2">
				<form
					className="flex items-end gap-2"
					action={(formData) => setSendingMailbox(campaignId, String(formData.get("emailAccountId") ?? ""))}
				>
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="emailAccountId" defaultValue={currentMailboxId ?? ""}>
						<option value="">— skrzynka wysyłkowa —</option>
						{mailboxes.map((m) => (
							<option key={m.id} value={m.id}>
								{m.email}
							</option>
						))}
					</select>
					<button className="rounded border border-zinc-300 px-3 py-1.5 text-sm" type="submit">
						Zapisz skrzynkę
					</button>
				</form>
				<form action={activateAction}>
					<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={activatePending}>
						Aktywuj wysyłkę
					</button>
				</form>
				<form action={pauseCampaign.bind(null, campaignId)}>
					<button className="rounded border border-zinc-300 px-3 py-1.5 text-sm" type="submit">
						Pauza
					</button>
				</form>
			</div>
			{activateState && !activateState.ok ? <p className="mt-2 text-sm text-red-600">{activateState.error}</p> : null}
			{activateState && activateState.ok ? <p className="mt-2 text-sm text-green-700">Wysyłka aktywowana.</p> : null}
			{mailboxes.length === 0 ? (
				<p className="mt-2 text-sm text-zinc-500">
					Brak skrzynek.{" "}
					<a className="text-blue-600" href="/skrzynki">
						Połącz skrzynkę
					</a>
					.
				</p>
			) : null}
		</div>
	)
}
