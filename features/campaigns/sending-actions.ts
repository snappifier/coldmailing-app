"use server"
// features/campaigns/sending-actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {planSchedule} from "@/features/sending/schedule"
import {validateActivation, type ActivateResult} from "@/features/campaigns/activation"

function startOfLocalDayUTC(now: Date, tz: string): Date {
	const key = new Intl.DateTimeFormat("en-CA", {timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"}).format(now)
	// midnight of the local day, expressed as an instant we can compare sentAt against
	return new Date(`${key}T00:00:00`)
}

export async function activateCampaign(campaignId: string): Promise<ActivateResult> {
	const {orgId} = await requireOrg()
	const campaign = await prisma.campaign.findFirst({
		where: {id: campaignId, organizationId: orgId},
		select: {id: true, status: true, sendingEmailAccountId: true},
	})
	if (!campaign) return {ok: false, error: "Kampania nie istnieje"}
	if (campaign.status === "ACTIVE") return {ok: false, error: "Kampania jest juz aktywna"}

	const stepZero = await prisma.sequenceStep.findFirst({where: {campaignId, order: 0}, select: {id: true}})
	const maxOrderAgg = await prisma.sequenceStep.aggregate({where: {campaignId}, _max: {order: true}})
	const maxOrder = maxOrderAgg._max.order ?? 0

	const pendingLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: "PENDING"},
		select: {id: true, leadId: true},
		orderBy: {createdAt: "asc"},
	})
	// Resume: leads still mid-sequence from a previously paused campaign (a step remains).
	const inflightLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: {in: ["ACTIVE", "REPLIED"]}, currentStep: {lte: maxOrder}},
		select: {id: true, leadId: true},
		orderBy: {createdAt: "asc"},
	})

	const check = validateActivation({
		sendingEmailAccountId: campaign.sendingEmailAccountId,
		hasStepZero: Boolean(stepZero),
		pendingLeadCount: pendingLeads.length,
		inflightLeadCount: inflightLeads.length,
	})
	if (!check.ok) return check

	const account = await prisma.emailAccount.findFirst({
		where: {id: campaign.sendingEmailAccountId!, organizationId: orgId},
	})
	if (!account) return {ok: false, error: "Skrzynka nie istnieje"}

	const now = new Date()
	const sentTodayCount = await prisma.message.count({
		where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: startOfLocalDayUTC(now, account.timezone)}},
	})

	// Stagger the first send for new (PENDING) leads; resume in-flight leads at the next open slots.
	const plan = planSchedule({leadIds: pendingLeads.map((l) => l.id), now, account, sentTodayCount, rng: Math.random})
	const resumePlan = planSchedule({
		leadIds: inflightLeads.map((l) => l.id),
		now,
		account,
		sentTodayCount: sentTodayCount + plan.length,
		rng: Math.random,
	})

	await prisma.$transaction([
		prisma.campaign.update({where: {id: campaignId}, data: {status: "ACTIVE"}}),
		...plan.map((p) =>
			prisma.campaignLead.update({where: {id: p.leadId}, data: {status: "ACTIVE", currentStep: 0, nextSendAt: p.nextSendAt}}),
		),
		// Resumed leads keep their status + currentStep; only the next slot is refreshed.
		...resumePlan.map((p) => prisma.campaignLead.update({where: {id: p.leadId}, data: {nextSendAt: p.nextSendAt}})),
	])

	const leadIdByCampaignLead = new Map<string, string>()
	for (const l of [...pendingLeads, ...inflightLeads]) leadIdByCampaignLead.set(l.id, l.leadId)

	await inngest.send(
		[...plan, ...resumePlan].map((p) => ({
			name: "campaign/lead.start",
			// p.leadId is the campaignLead id (planner naming); leadId is the real Lead.id (for waitForEvent match on draft steps).
			data: {campaignLeadId: p.leadId, campaignId, emailAccountId: account.id, leadId: leadIdByCampaignLead.get(p.leadId)!},
		})),
	)

	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}

export async function pauseCampaign(campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	const res = await prisma.campaign.updateMany({where: {id: campaignId, organizationId: orgId}, data: {status: "PAUSED"}})
	// Cancel in-flight orchestrators for this campaign (runLeadSequence cancelOn campaign/paused).
	if (res.count > 0) await inngest.send({name: "campaign/paused", data: {campaignId}})
	revalidatePath(`/kampanie/${campaignId}`)
}

export async function setSendingMailbox(campaignId: string, emailAccountId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.updateMany({
		where: {id: campaignId, organizationId: orgId},
		data: {sendingEmailAccountId: emailAccountId || null},
	})
	revalidatePath(`/kampanie/${campaignId}`)
}
