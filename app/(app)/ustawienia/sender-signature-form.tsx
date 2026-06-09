"use client"
// app/(app)/ustawienia/sender-signature-form.tsx

import {useActionState, useState} from "react"
import {setSenderSignature} from "@/features/org/settings"

interface Props {
	signature: string
}

export function SenderSignatureForm({signature}: Props) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setSenderSignature, null)
	const [value, setValue] = useState(signature)
	const empty = value.trim() === ""
	return (
		<form className="flex flex-col gap-2 text-sm" action={action}>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Podpis nadawcy (token {"{{podpisNadawcy}}"})</span>
				<textarea
					className="h-28 w-full max-w-lg rounded border border-zinc-300 p-2"
					name="senderSignature"
					placeholder="Pozdrawiam,&#10;Jan Kowalski&#10;Acme Sp. z o.o."
					value={value}
					onChange={(e) => setValue(e.target.value)}
				/>
			</label>
			{empty ? <span className="text-xs text-amber-700">Nieustawiony — przy wysyłce zostanie użyta nazwa skrzynki.</span> : null}
			<button className="w-32 rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state?.ok === true ? <span className="text-green-700">Zapisano.</span> : null}
			{state?.ok === false ? <span className="text-red-700">Nie udało się zapisać.</span> : null}
		</form>
	)
}
