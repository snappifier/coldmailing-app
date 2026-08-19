"use server"

import {revalidatePath} from "next/cache"
import type {DealStage} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {STAGE_ORDER} from "./types"
import {addActivitySchema} from "./validation"

export type PipelineActionResult = {ok: true} | {ok: false; error: string}

export async function moveLeadStage(leadId: string, toStage: DealStage): Promise<PipelineActionResult> {
	const {orgId, userId} = await requireOrg()
	if (!STAGE_ORDER.includes(toStage)) return {ok: false, error: "Nieznany etap"}
	const lead = await prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {dealStage: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	if (lead.dealStage === toStage) return {ok: true}
	await prisma.$transaction([
		prisma.lead.update({where: {id: leadId}, data: {dealStage: toStage}}),
		prisma.leadActivity.create({
			data: {organizationId: orgId, leadId, kind: "STAGE_CHANGE", fromStage: lead.dealStage, toStage, authorUserId: userId},
		}),
	])
	revalidatePath("/pipeline")
	revalidatePath(`/leady/${leadId}`)
	return {ok: true}
}

export async function addLeadActivity(_prev: PipelineActionResult | null, formData: FormData): Promise<PipelineActionResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = addActivitySchema.safeParse({
		leadId: formData.get("leadId"),
		kind: formData.get("kind"),
		body: formData.get("body"),
	})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	const lead = await prisma.lead.findFirst({where: {id: parsed.data.leadId, organizationId: orgId}, select: {id: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	await prisma.leadActivity.create({
		data: {organizationId: orgId, leadId: parsed.data.leadId, kind: parsed.data.kind, body: parsed.data.body, authorUserId: userId},
	})
	revalidatePath(`/leady/${parsed.data.leadId}`)
	return {ok: true}
}

export async function deleteLeadActivity(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	const activity = await prisma.leadActivity.findFirst({where: {id, organizationId: orgId}, select: {leadId: true, kind: true}})
	if (!activity || activity.kind === "STAGE_CHANGE") return
	await prisma.leadActivity.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath(`/leady/${activity.leadId}`)
}
