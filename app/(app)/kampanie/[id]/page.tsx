// app/(app)/kampanie/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {getCampaignMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {SequenceAndLeads} from "./sequence-and-leads"
import {SendingControls} from "./sending-controls"
import {LeadInbox} from "./lead-inbox"
import {MetricStat} from "../../dashboard-parts"

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

	const metrics = await getCampaignMetrics(id, orgId)

	const leads = await prisma.campaignLead.findMany({
		where: {campaignId: id, messages: {some: {direction: "INBOUND"}}},
		select: {
			id: true,
			status: true,
			lead: {select: {organizationName: true}},
			messages: {where: {direction: "INBOUND"}, orderBy: {createdAt: "desc"}, take: 1, select: {inboundKind: true, body: true}},
		},
		orderBy: {createdAt: "asc"},
	})

	const [templates, offeringLines, mailboxes] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		listEmailAccounts(orgId),
	])

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-accent" href="/kampanie">
				← Kampanie
			</Link>
			<h1 className="text-lg font-semibold">
				{campaign.name} <span className="text-sm font-normal text-fg-faint">· {campaign.status} · {campaign._count.campaignLeads} leadów</span>
			</h1>
			{metrics ? (
				<div className="flex flex-wrap gap-5 rounded-lg border border-border bg-surface-1 p-3.5">
					<MetricStat label="Wysłane maile" value={formatInt(metrics.mailsSent)} />
					<MetricStat label="Skontaktowani" value={formatInt(metrics.rates.contacted)} />
					<MetricStat label="Odpowiedzi" value={`${formatInt(metrics.breakdown.replied)} · ${formatPct(metrics.rates.replyRate)}`} />
					<MetricStat label="Odbicia" value={`${formatInt(metrics.breakdown.bounced)} · ${formatPct(metrics.rates.bounceRate)}`} />
					<MetricStat label="Rezygnacje" value={`${formatInt(metrics.breakdown.unsubscribed)} · ${formatPct(metrics.rates.unsubRate)}`} />
					<MetricStat label="Błędy" value={formatInt(metrics.breakdown.failed)} />
				</div>
			) : null}
			<SendingControls
				campaignId={campaign.id}
				mailboxes={mailboxes.map((m) => ({id: m.id, email: m.email}))}
				currentMailboxId={campaign.sendingEmailAccountId}
			/>
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
					useLeadDraft: s.useLeadDraft,
				}))}
			/>
			<div>
				<h2 className="mb-2 text-sm font-semibold text-fg">Przychodzące</h2>
				<LeadInbox
					rows={leads.map((l) => ({
						id: l.id,
						org: l.lead.organizationName,
						status: l.status,
						inboundKind: l.messages[0]?.inboundKind ?? null,
						snippet: l.messages[0]?.body ?? null,
					}))}
				/>
			</div>
		</section>
	)
}
