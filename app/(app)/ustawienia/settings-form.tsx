"use client"
// app/(app)/ustawienia/settings-form.tsx

import {useActionState} from "react"
import {setOrgInboundSettings} from "@/features/org/settings"

interface Props {
	optOutMode: string
	optOutDetector: string
}

export function SettingsForm({optOutMode, optOutDetector}: Props) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgInboundSettings, null)
	return (
		<form className="flex flex-col gap-3 text-sm" action={action}>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Wykrywanie rezygnacji</span>
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="optOutMode" defaultValue={optOutMode}>
					<option value="OFF">OFF — nie wykrywaj</option>
					<option value="SUGGEST">SUGGEST — flaguj, klikam ręcznie</option>
					<option value="AUTO">AUTO — sam suppresuj</option>
				</select>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-zinc-700">Metoda</span>
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="optOutDetector" defaultValue={optOutDetector}>
					<option value="KEYWORD">Lista fraz</option>
					<option value="LLM">LLM (wymaga ANTHROPIC_API_KEY)</option>
				</select>
			</label>
			<button className="w-32 rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state?.ok === true ? <span className="text-green-700">Zapisano.</span> : null}
			{state?.ok === false ? <span className="text-red-700">Nie udało się zapisać.</span> : null}
		</form>
	)
}
