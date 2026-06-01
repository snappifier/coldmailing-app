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
		select: {id: true, sendingEmailAccountId: true},
	})
	if (!campaign) return {ok: false, error: "Kampania nie istnieje"}

	const stepZero = await prisma.sequenceStep.findFirst({where: {campaignId, order: 0}, select: {id: true}})
	const pendingLeads = await prisma.campaignLead.findMany({
		where: {campaignId, status: "PENDING"},
		select: {id: true},
		orderBy: {createdAt: "asc"},
	})

	const check = validateActivation({
		sendingEmailAccountId: campaign.sendingEmailAccountId,
		hasStepZero: Boolean(stepZero),
		pendingLeadCount: pendingLeads.length,
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

	const plan = planSchedule({
		leadIds: pendingLeads.map((l) => l.id),
		now,
		account,
		sentTodayCount,
		rng: Math.random,
	})

	await prisma.$transaction([
		prisma.campaign.update({where: {id: campaignId}, data: {status: "ACTIVE"}}),
		...plan.map((p) =>
			prisma.campaignLead.update({where: {id: p.leadId}, data: {status: "ACTIVE", currentStep: 0, nextSendAt: p.nextSendAt}}),
		),
	])

	await inngest.send(
		plan.map((p) => ({name: "campaign/lead.start", data: {campaignLeadId: p.leadId, campaignId, emailAccountId: account.id}})),
	)

	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}

export async function pauseCampaign(campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.updateMany({where: {id: campaignId, organizationId: orgId}, data: {status: "PAUSED"}})
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
