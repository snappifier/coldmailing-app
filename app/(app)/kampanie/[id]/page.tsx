// app/(app)/kampanie/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {SequenceAndLeads} from "./sequence-and-leads"

export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params

	const campaign = await prisma.campaign.findFirst({
		where: {id, organizationId: orgId},
		include: {
			steps: {orderBy: {order: "asc"}, include: {template: {select: {name: true}}}},
			_count: {select: {campaignLeads: true}},
		},
	})
	if (!campaign) notFound()

	const [templates, offeringLines] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-blue-600" href="/kampanie">
				← Kampanie
			</Link>
			<h1 className="text-lg font-semibold">
				{campaign.name} <span className="text-sm font-normal text-zinc-400">· {campaign.status} · {campaign._count.campaignLeads} leadów</span>
			</h1>
			<SequenceAndLeads
				campaignId={campaign.id}
				templates={templates}
				offeringLines={offeringLines}
				steps={campaign.steps.map((s) => ({
					id: s.id,
					order: s.order,
					delayDays: s.delayDays,
					condition: s.condition,
					templateName: s.template.name,
				}))}
			/>
		</section>
	)
}
