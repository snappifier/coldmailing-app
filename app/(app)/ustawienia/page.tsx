// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsShell, type SettingsSection} from "./settings-shell"
import {GeneralForm} from "./general-form"
import {SenderSignatureForm} from "./sender-signature-form"
import {SettingsForm} from "./settings-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	const sections: SettingsSection[] = [
		{id: "ogolne", label: "Ogólne", content: <GeneralForm name={s.name} />},
		{id: "podpis", label: "Podpis nadawcy", content: <SenderSignatureForm signature={s.senderSignature} />},
		{id: "optout", label: "Wykrywanie rezygnacji", content: <SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />},
	]
	return (
		<section className="flex flex-col gap-6">
			<div>
				<h1 className="text-[21px] font-semibold tracking-[-0.025em]">Ustawienia</h1>
				<p className="mt-0.5 text-[13px] text-fg-muted">Konfiguracja organizacji, wysyłki i zespołu.</p>
			</div>
			<SettingsShell sections={sections} />
		</section>
	)
}
