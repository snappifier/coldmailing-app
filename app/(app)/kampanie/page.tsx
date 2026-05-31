// app/(app)/kampanie/page.tsx
import Link from "next/link"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteCampaign} from "@/features/campaigns/actions"
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
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{campaigns.map((c) => (
					<li className="flex items-center justify-between py-2 text-sm" key={c.id}>
						<span>
							<Link className="text-blue-600 hover:underline" href={`/kampanie/${c.id}`}>
								{c.name}
							</Link>{" "}
							<span className="text-zinc-400">
								· {c.status} · {c._count.steps} kroków · {c._count.campaignLeads} leadów
							</span>
						</span>
						<form action={deleteCampaign.bind(null, c.id)}>
							<button className="text-red-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{campaigns.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak kampanii.</li> : null}
			</ul>
		</section>
	)
}
