"use client"
// app/(app)/ustawienia/general-form.tsx
import {useActionState, useEffect} from "react"
import {setOrgName} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function GeneralForm({name}: {name: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgName, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano nazwę organizacji") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label="Nazwa organizacji">
				<Input name="name" defaultValue={name} className="max-w-xs" />
			</Field>
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
