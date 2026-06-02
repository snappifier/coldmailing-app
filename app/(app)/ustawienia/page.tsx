// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsForm} from "./settings-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Ustawienia</h1>
			<SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />
		</section>
	)
}
