import Link from "next/link"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteCampaign} from "@/features/campaigns/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {EmptyState} from "@/components/ui/empty-state"
import {EmptyIllustration} from "@/components/ui/empty-illustration"
import {PageHeader} from "@/components/ui/page-header"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import {KampaniaCreateButton} from "./kampania-create-button"

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

	const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Kampanie"
				description="Sekwencje wysyłkowe powiązane z liniami usług."
				meta={`${campaigns.length} kampanii · ${activeCount} aktywnych`}
				action={<KampaniaCreateButton offeringLines={offeringLines} />}
			/>
			{campaigns.length === 0 ? (
				<EmptyState illustration={<EmptyIllustration />} title="Brak kampanii" description="Utwórz pierwszą kampanię." action={<KampaniaCreateButton offeringLines={offeringLines} variant="secondary" />} />
			) : (
				<div className="flex flex-col gap-2">
					{campaigns.map((c) => (
						<Card key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:border-border-strong">
							<div className="min-w-0">
								<div className="flex items-center gap-2 text-sm font-semibold text-fg">
									<Link className="truncate hover:underline underline-offset-2" href={`/kampanie/${c.id}`}>{c.name}</Link>
									<Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
								</div>
								<p className="mt-0.5 text-[12px] text-fg-faint">{c._count.steps} kroków · {c._count.campaignLeads} leadów</p>
							</div>
							<div className="flex-none">
								<ConfirmButton action={deleteCampaign.bind(null, c.id)} confirm={{title: "Usunąć kampanię?", body: "Kampania i jej powiązania zostaną usunięte. Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto kampanię">Usuń</ConfirmButton>
							</div>
						</Card>
					))}
				</div>
			)}
		</section>
	)
}
