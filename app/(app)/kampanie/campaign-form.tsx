"use client"

import {useActionState, useRef} from "react"
import {createCampaign, type CampaignResult} from "@/features/campaigns/actions"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"

export function CampaignForm({offeringLines, onSuccess}: {offeringLines: {id: string; name: string}[]; onSuccess?: () => void}) {
	const formRef = useRef<HTMLFormElement>(null)
	const toast = useToast()
	const [state, action, pending] = useActionState<CampaignResult | null, FormData>(
		async (prev, formData) => {
			const res = await createCampaign(prev, formData)
			if (res.ok) {
				toast("Utworzono kampanię")
				formRef.current?.reset()
				onSuccess?.()
			}
			return res
		},
		null,
	)
	return (
		<form className="flex flex-col gap-3" ref={formRef} action={action}>
			<Field label="Nazwa kampanii">
				<Input name="name" required />
			</Field>
			<Field label="Linia usługi">
				<Select name="offeringLineId" defaultValue="">
					<option value="">— linia usługi —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
			</Field>
			<Button variant="primary" type="submit" disabled={pending}>Utwórz kampanię</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
		</form>
	)
}
