"use client"
// app/(app)/ustawienia/invite-form.tsx

import {useActionState} from "react"
import {inviteMember, type TeamActionResult} from "@/features/team/actions"
import {ROLE_LABEL} from "@/features/enums/labels"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function InviteForm() {
	const [state, action, pending] = useActionState<TeamActionResult | null, FormData>(inviteMember, null)
	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<Input className="max-w-72" name="email" type="email" placeholder="adres@email.pl" required />
			<Select className="w-44" name="role" defaultValue="MEMBER">
				<option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
				<option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
				<option value="OWNER">{ROLE_LABEL.OWNER}</option>
			</Select>
			<Button variant="primary" type="submit" disabled={pending}>Zaproś</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
			{state && state.ok ? <p className="text-sm text-success">Zaproszono. Ta osoba może się już zalogować kontem Google.</p> : null}
		</form>
	)
}
