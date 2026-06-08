// features/pipeline/queries.ts
import {prisma} from "@/lib/prisma"
import type {PipelineLead, TimelineItem} from "./types"
import {buildTimeline} from "./timeline"

export async function getPipelineLeads(organizationId: string, opts: {offeringLineId?: string | null} = {}): Promise<PipelineLead[]> {
	const leads = await prisma.lead.findMany({
		where: {organizationId, ...(opts.offeringLineId ? {offeringLineId: opts.offeringLineId} : {})},
		orderBy: [{priority: "desc"}, {createdAt: "desc"}],
		select: {
			id: true,
			organizationName: true,
			city: true,
			score: true,
			dealStage: true,
			offeringLine: {select: {name: true}},
			campaignLeads: {orderBy: {createdAt: "desc"}, take: 1, select: {status: true}},
			activities: {orderBy: {createdAt: "desc"}, take: 1, select: {createdAt: true}},
		},
	})
	return leads.map((l) => ({
		id: l.id,
		organizationName: l.organizationName,
		city: l.city,
		dealStage: l.dealStage,
		lineName: l.offeringLine?.name ?? null,
		score: l.score,
		sequenceStatus: l.campaignLeads[0]?.status ?? null,
		lastActivityAt: l.activities[0]?.createdAt ?? null,
	}))
}

export async function getLeadTimeline(organizationId: string, leadId: string): Promise<TimelineItem[]> {
	const [activities, messages] = await Promise.all([
		prisma.leadActivity.findMany({
			where: {organizationId, leadId},
			orderBy: {createdAt: "desc"},
			select: {id: true, kind: true, body: true, fromStage: true, toStage: true, createdAt: true},
		}),
		prisma.message.findMany({
			where: {organizationId, campaignLead: {leadId}},
			orderBy: {createdAt: "desc"},
			select: {id: true, direction: true, inboundKind: true, subject: true, sentAt: true, createdAt: true},
		}),
	])
	return buildTimeline(activities, messages)
}
