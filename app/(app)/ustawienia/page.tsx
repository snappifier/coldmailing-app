// app/(app)/ustawienia/page.tsx
import {requireOrg, currentRole} from "@/lib/org"
import {hasRole} from "@/features/team/roles"
import {redirect} from "next/navigation"
import {getOrgSettings} from "@/features/org/settings"
import {listTeam} from "@/features/team/queries"
import {SettingsShell, type SettingsSection} from "./settings-shell"
import {GeneralForm} from "./general-form"
import {SenderSignatureForm} from "./sender-signature-form"
import {SettingsForm} from "./settings-form"
import {TeamSection} from "./team-section"

export default async function SettingsPage() {
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, "ADMIN")) redirect("/")
	const s = await getOrgSettings()
	const sections: SettingsSection[] = [
		{id: "ogolne", label: "Ogólne", content: <GeneralForm name={s.name} />},
		{id: "podpis", label: "Podpis nadawcy", content: <SenderSignatureForm signature={s.senderSignature} />},
		{id: "optout", label: "Wykrywanie rezygnacji", content: <SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />},
	]
	if (hasRole(role, "OWNER")) {
		const team = await listTeam(ctx.orgId)
		sections.push({id: "zespol", label: "Zespół", content: <TeamSection members={team.members} invitations={team.invitations} />})
	}
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
