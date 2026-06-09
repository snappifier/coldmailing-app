// app/(app)/kampanie/page.tsx
import Link from "next/link"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteCampaign} from "@/features/campaigns/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {CampaignForm} from "./campaign-form"

export default async function CampaignsPage() {
	const {orgId} = await requireOrg()
	const [campaigns, offeringLines] = await Promise.all([
		prisma.campaign.findMany({
			where: {organizationId: orgId},
			orderBy: {createdAt: "desc"},
			include: {_count: {select: {steps: true, campaignLeads: true}}},
		}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Kampanie</h1>
			<CampaignForm offeringLines={offeringLines} />
			<ul className="divide-y divide-border border-y border-border">
				{campaigns.map((c) => (
					<li className="flex items-center justify-between py-2 text-sm" key={c.id}>
						<span>
							<Link className="text-accent hover:underline" href={`/kampanie/${c.id}`}>
								{c.name}
							</Link>{" "}
							<span className="text-fg-faint">
								· {c.status} · {c._count.steps} kroków · {c._count.campaignLeads} leadów
							</span>
						</span>
						<ConfirmButton action={deleteCampaign.bind(null, c.id)} confirm={{title: "Usunąć kampanię?", body: "Kampania i jej powiązania zostaną usunięte. Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto kampanię">Usuń</ConfirmButton>
					</li>
				))}
				{campaigns.length === 0 ? <li className="py-2 text-sm text-fg-muted">Brak kampanii.</li> : null}
			</ul>
		</section>
	)
}
