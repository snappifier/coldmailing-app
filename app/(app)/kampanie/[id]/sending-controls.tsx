"use client"
// app/(app)/kampanie/[id]/sending-controls.tsx

import {setSendingMailbox} from "@/features/campaigns/sending-actions"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

interface Props {
	campaignId: string
	mailboxes: {id: string; email: string}[]
	currentMailboxId: string | null
	canManageSending: boolean
}

export function SendingControls({campaignId, mailboxes, currentMailboxId, canManageSending}: Props) {
	if (!canManageSending) return null

	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Skrzynka wysyłkowa</div>
			<form className="flex flex-wrap items-center gap-2" action={(formData) => setSendingMailbox(campaignId, String(formData.get("emailAccountId") ?? ""))}>
				<Select className="w-64" name="emailAccountId" defaultValue={currentMailboxId ?? ""}>
					<option value="">— skrzynka wysyłkowa —</option>
					{mailboxes.map((m) => (
						<option key={m.id} value={m.id}>
							{m.email}
						</option>
					))}
				</Select>
				<Button type="submit">Zapisz skrzynkę</Button>
			</form>
			{mailboxes.length === 0 ? (
				<p className="text-sm text-fg-muted">
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
