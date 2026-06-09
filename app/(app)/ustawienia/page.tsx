// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsForm} from "./settings-form"
import {SenderSignatureForm} from "./sender-signature-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	return (
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Ustawienia</h1>
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Wykrywanie rezygnacji</h2>
				<SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />
			</div>
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Podpis nadawcy</h2>
				<SenderSignatureForm signature={s.senderSignature} />
			</div>
		</section>
	)
}
