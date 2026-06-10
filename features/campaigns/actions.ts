"use server"
// features/campaigns/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {campaignSchema, sequenceStepSchema, updateSequenceStepSchema} from "@/features/campaigns/schema"
import {planSwap} from "@/features/campaigns/reorder"

export type CampaignResult = {ok: true; id: string} | {ok: false; error: string}
export type StepResult = {ok: true} | {ok: false; error: string}

export async function createCampaign(_prev: CampaignResult | null, formData: FormData): Promise<CampaignResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = campaignSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	try {
		const created = await prisma.campaign.create({
			data: {organizationId: orgId, createdById: userId, name: parsed.data.name, offeringLineId: parsed.data.offeringLineId},
			select: {id: true},
		})
		revalidatePath("/kampanie")
		return {ok: true, id: created.id}
	} catch {
		return {ok: false, error: "Kampania o tej nazwie już istnieje"}
	}
}

export async function deleteCampaign(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/kampanie")
}

// Ensures the campaign belongs to the caller's org. Returns the id or throws.
async function assertCampaignInOrg(campaignId: string, orgId: string) {
	const c = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {id: true}})
	if (!c) throw new Error("Campaign not found")
	return c.id
}

export async function addSequenceStep(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const parsed = sequenceStepSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	await assertCampaignInOrg(parsed.data.campaignId, orgId)

	const last = await prisma.sequenceStep.findFirst({
		where: {campaignId: parsed.data.campaignId},
		orderBy: {order: "desc"},
		select: {order: true},
	})
	await prisma.sequenceStep.create({
		data: {
			campaignId: parsed.data.campaignId,
			order: (last?.order ?? -1) + 1,
			templateId: parsed.data.templateId,
			delayDays: parsed.data.delayDays,
			condition: parsed.data.condition,
			useLeadDraft: parsed.data.useLeadDraft,
		},
	})
	revalidatePath(`/kampanie/${parsed.data.campaignId}`)
	return {ok: true}
}

export async function deleteSequenceStep(id: string, campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await assertCampaignInOrg(campaignId, orgId)
	await prisma.sequenceStep.deleteMany({where: {id, campaignId}})
	revalidatePath(`/kampanie/${campaignId}`)
}

// Assign all leads of an offering line (or all org leads if none) to the campaign.
export async function assignLeads(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const campaignId = String(formData.get("campaignId") ?? "")
	const offeringLineId = String(formData.get("offeringLineId") ?? "") || null
	await assertCampaignInOrg(campaignId, orgId)

	const leads = await prisma.lead.findMany({
		where: {organizationId: orgId, ...(offeringLineId ? {offeringLineId} : {})},
		select: {id: true},
	})
	if (leads.length === 0) return {ok: false, error: "Brak leadów do przypisania"}

	await prisma.campaignLead.createMany({
		data: leads.map((l) => ({campaignId, leadId: l.id})),
		skipDuplicates: true,
	})
	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}

export async function updateSequenceStep(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const parsed = updateSequenceStepSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	await assertCampaignInOrg(parsed.data.campaignId, orgId)

	const res = await prisma.sequenceStep.updateMany({
		where: {id: parsed.data.stepId, campaignId: parsed.data.campaignId},
		data: {
			templateId: parsed.data.templateId,
			delayDays: parsed.data.delayDays,
			condition: parsed.data.condition,
			useLeadDraft: parsed.data.useLeadDraft,
		},
	})
	if (res.count === 0) return {ok: false, error: "Nie znaleziono kroku"}
	revalidatePath(`/kampanie/${parsed.data.campaignId}`)
	return {ok: true}
}

// Reorder is gated to non-ACTIVE campaigns: the sending engine's cursor is gap-safe
// (steps.find(s => s.order >= currentStep)), so moving a step across a lead's cursor
// on an ACTIVE campaign could re-send or skip it. Field edits carry no such risk.
// Spec-accepted residual: the cursor is positional and survives pause, so reordering
// across an in-flight lead's cursor while PAUSED can still re-send/skip after resume -
// realistic reorders happen on DRAFT campaigns before any sends.
export async function moveSequenceStep(stepId: string, dir: "up" | "down", campaignId: string): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const campaign = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {status: true}})
	if (!campaign) return {ok: false, error: "Nie znaleziono kampanii"}
	if (campaign.status === "ACTIVE") return {ok: false, error: "Wstrzymaj kampanię, aby zmienić kolejność"}

	const steps = await prisma.sequenceStep.findMany({where: {campaignId}, select: {id: true, order: true}})
	const plan = planSwap(steps, stepId, dir)
	if (!plan) return {ok: false, error: "Nie można przesunąć kroku"}

	// @@unique([campaignId, order]) forbids a direct two-row swap - park one row on -1 first.
	try {
		await prisma.$transaction([
			prisma.sequenceStep.update({where: {id: plan.a.id}, data: {order: -1}}),
			prisma.sequenceStep.update({where: {id: plan.b.id}, data: {order: plan.b.order}}),
			prisma.sequenceStep.update({where: {id: plan.a.id}, data: {order: plan.a.order}}),
		])
	} catch {
		// A concurrent move invalidated the plan; the unique constraint aborted the whole tx.
		return {ok: false, error: "Kolejność zmieniła się w międzyczasie — odśwież i spróbuj ponownie"}
	}
	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}
