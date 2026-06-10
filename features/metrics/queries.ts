// features/metrics/queries.ts
import {prisma} from "@/lib/prisma"
import type {DealStage} from "@/generated/prisma/client"
import {summarizeStatuses, computeRates, buildCampaignRows, orderFunnel, bucketDaily, type StatusBreakdown, type Rates, type CampaignRow, type DailyCount} from "@/features/metrics/compute"

export interface OrgMetrics {
	leadsTotal: number
	campaignsTotal: number
	campaignsActive: number
	mailsSent: number
	breakdown: StatusBreakdown
	rates: Rates
	funnel: {stage: DealStage; count: number}[]
	campaigns: CampaignRow[]
}

export async function getOrgMetrics(orgId: string): Promise<OrgMetrics> {
	const [leadsTotal, campaigns, mailsSent, statusGroups, dealGroups, campaignStatusGroups] = await Promise.all([
		prisma.lead.count({where: {organizationId: orgId}}),
		prisma.campaign.findMany({where: {organizationId: orgId}, select: {id: true, name: true, status: true}, orderBy: {createdAt: "desc"}}),
		prisma.message.count({where: {organizationId: orgId, direction: "OUTBOUND", status: "SENT"}}),
		prisma.campaignLead.groupBy({by: ["status"], where: {campaign: {organizationId: orgId}}, _count: {_all: true}}),
		prisma.lead.groupBy({by: ["dealStage"], where: {organizationId: orgId}, _count: {_all: true}}),
		prisma.campaignLead.groupBy({by: ["campaignId", "status"], where: {campaign: {organizationId: orgId}}, _count: {_all: true}}),
	])

	const breakdown = summarizeStatuses(statusGroups.map((g) => ({status: g.status, count: g._count._all})))
	const funnelCounts: Partial<Record<DealStage, number>> = {}
	for (const g of dealGroups) funnelCounts[g.dealStage] = g._count._all
	const campaignRows = buildCampaignRows(campaigns, campaignStatusGroups.map((g) => ({campaignId: g.campaignId, status: g.status, count: g._count._all})))

	return {
		leadsTotal,
		campaignsTotal: campaigns.length,
		campaignsActive: campaigns.filter((c) => c.status === "ACTIVE").length,
		mailsSent,
		breakdown,
		rates: computeRates(breakdown),
		funnel: orderFunnel(funnelCounts),
		campaigns: campaignRows,
	}
}

export interface CampaignMetrics {
	breakdown: StatusBreakdown
	rates: Rates
	mailsSent: number
}

export async function getCampaignMetrics(campaignId: string, orgId: string): Promise<CampaignMetrics | null> {
	const campaign = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {id: true}})
	if (!campaign) return null
	const [statusGroups, mailsSent] = await Promise.all([
		prisma.campaignLead.groupBy({by: ["status"], where: {campaignId}, _count: {_all: true}}),
		prisma.message.count({where: {campaignLead: {campaignId}, direction: "OUTBOUND", status: "SENT"}}),
	])
	const breakdown = summarizeStatuses(statusGroups.map((g) => ({status: g.status, count: g._count._all})))
	return {breakdown, rates: computeRates(breakdown), mailsSent}
}

export interface RecentReply {
	campaignLeadId: string
	campaignId: string
	campaignName: string
	organizationName: string
	at: Date
}

export async function getDailySends(orgId: string, days = 30, now = new Date()): Promise<DailyCount[]> {
	const since = new Date(now.getTime() - days * 86_400_000)
	const msgs = await prisma.message.findMany({
		where: {organizationId: orgId, direction: "OUTBOUND", status: "SENT", sentAt: {gte: since}},
		select: {sentAt: true},
	})
	const dates = msgs.map((m) => m.sentAt).filter((d): d is Date => d != null)
	return bucketDaily(dates, days, now, "Europe/Warsaw")
}

export async function getRecentReplies(orgId: string, limit = 6): Promise<RecentReply[]> {
	const msgs = await prisma.message.findMany({
		where: {organizationId: orgId, direction: "INBOUND", inboundKind: {in: ["REPLY", "OPT_OUT_SUSPECT"]}},
		orderBy: {createdAt: "desc"},
		take: limit,
		select: {
			createdAt: true,
			campaignLead: {select: {id: true, campaign: {select: {id: true, name: true}}, lead: {select: {organizationName: true}}}},
		},
	})
	return msgs.map((m) => ({
		campaignLeadId: m.campaignLead.id,
		campaignId: m.campaignLead.campaign.id,
		campaignName: m.campaignLead.campaign.name,
		organizationName: m.campaignLead.lead.organizationName,
		at: m.createdAt,
	}))
}
