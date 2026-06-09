"use client"
// app/(app)/ustawienia/settings-form.tsx
import {useActionState, useEffect} from "react"
import {setOrgInboundSettings} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function SettingsForm({optOutMode, optOutDetector}: {optOutMode: string; optOutDetector: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgInboundSettings, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano ustawienia") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label="Wykrywanie rezygnacji">
				<Select name="optOutMode" defaultValue={optOutMode} className="max-w-xs">
					<option value="OFF">OFF — nie wykrywaj</option>
					<option value="SUGGEST">SUGGEST — flaguj, klikam ręcznie</option>
					<option value="AUTO">AUTO — sam suppresuj</option>
				</Select>
			</Field>
			<Field label="Metoda">
				<Select name="optOutDetector" defaultValue={optOutDetector} className="max-w-xs">
					<option value="KEYWORD">Lista fraz</option>
					<option value="LLM">LLM (wymaga ANTHROPIC_API_KEY)</option>
				</Select>
			</Field>
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
