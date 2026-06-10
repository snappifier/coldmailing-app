// app/(app)/kampanie/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {hasRole} from "@/features/team/roles"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {getCampaignMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {Badge} from "@/components/ui/badge"
import {Card} from "@/components/ui/card"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import {CampaignTabs} from "./campaign-tabs"
import {CampaignHeaderActions} from "./campaign-header-actions"
import {SequenceSteps} from "./sequence-steps"
import {AssignLeadsForm} from "./assign-leads-form"
import {SendingControls} from "./sending-controls"
import {LeadInbox} from "./lead-inbox"
import {MetricStat} from "../../dashboard-parts"

export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) {
	const {orgId, role} = await requireOrg()
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

	const canManageSending = hasRole(role, "ADMIN")

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/kampanie">
				← Kampanie
			</Link>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-lg font-semibold">
					{campaign.name}{" "}
					<Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>{" "}
					<span className="text-sm font-normal text-fg-faint">· {campaign._count.campaignLeads} leadów</span>
				</h1>
				<CampaignHeaderActions campaignId={campaign.id} status={campaign.status} canManageSending={canManageSending} hasMailbox={Boolean(campaign.sendingEmailAccountId)} />
			</div>
			{metrics ? (
				<Card className="flex flex-wrap divide-x divide-border">
					<div className="px-4 py-3"><MetricStat label="Wysłane maile" value={formatInt(metrics.mailsSent)} /></div>
					<div className="px-4 py-3"><MetricStat label="Skontaktowani" value={formatInt(metrics.rates.contacted)} /></div>
					<div className="px-4 py-3"><MetricStat label="Odpowiedzi" value={`${formatInt(metrics.breakdown.replied)} · ${formatPct(metrics.rates.replyRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Odbicia" value={`${formatInt(metrics.breakdown.bounced)} · ${formatPct(metrics.rates.bounceRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Rezygnacje" value={`${formatInt(metrics.breakdown.unsubscribed)} · ${formatPct(metrics.rates.unsubRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Błędy" value={formatInt(metrics.breakdown.failed)} /></div>
				</Card>
			) : null}
			<CampaignTabs
				inboundCount={leads.length}
				sekwencja={
					<SequenceSteps
						campaignId={campaign.id}
						templates={templates}
						campaignActive={campaign.status === "ACTIVE"}
						steps={campaign.steps.map((s) => ({
							id: s.id,
							order: s.order,
							delayDays: s.delayDays,
							condition: s.condition,
							templateId: s.templateId,
							templateName: s.template.name,
							useLeadDraft: s.useLeadDraft,
						}))}
					/>
				}
				leady={
					<div className="flex flex-col gap-6">
						<SendingControls campaignId={campaign.id} mailboxes={mailboxes.map((m) => ({id: m.id, email: m.email}))} currentMailboxId={campaign.sendingEmailAccountId} canManageSending={canManageSending} />
						<AssignLeadsForm campaignId={campaign.id} offeringLines={offeringLines} />
					</div>
				}
				przychodzace={
					<LeadInbox
						rows={leads.map((l) => ({
							id: l.id,
							org: l.lead.organizationName,
							status: l.status,
							inboundKind: l.messages[0]?.inboundKind ?? null,
							snippet: l.messages[0]?.body ?? null,
						}))}
					/>
				}
			/>
		</section>
	)
}
