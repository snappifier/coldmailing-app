"use client"
// app/(app)/ustawienia/sender-signature-form.tsx
import {useActionState, useEffect, useState} from "react"
import {setSenderSignature} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Textarea} from "@/components/ui/textarea"
import {Note} from "@/components/ui/note"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function SenderSignatureForm({signature}: {signature: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setSenderSignature, null)
	const [value, setValue] = useState(signature)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano podpis nadawcy") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label={"Podpis nadawcy (token {{podpisNadawcy}})"} hint={"Wstawiany dosłownie w miejsce {{podpisNadawcy}}. Maks. 2000 znaków."}>
				<Textarea name="senderSignature" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-lg" placeholder={"Pozdrawiam,\nJan Kowalski"} />
			</Field>
			{value.trim() === "" ? <Note variant="warning">Nieustawiony — przy wysyłce zostanie użyta nazwa skrzynki.</Note> : null}
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
