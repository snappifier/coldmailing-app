"use server"
// features/research/draft-actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"

export type StartDraftResult = {ok: true; draftId: string} | {ok: false; error: string}
export type SaveDraftResult = {ok: true} | {ok: false; error: string}

export async function startDraft(leadId: string, draftTypeId: string): Promise<StartDraftResult> {
	const {orgId, userId} = await requireOrg()
	const [lead, type] = await Promise.all([
		prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}}),
		prisma.researchType.findFirst({where: {id: draftTypeId, organizationId: orgId}, select: {id: true, name: true, kind: true}}),
	])
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	if (!type || type.kind !== "DRAFT") return {ok: false, error: "Nieprawidłowy typ draftu"}

	const draft = await prisma.leadDraft.upsert({
		where: {organizationId_leadId: {organizationId: orgId, leadId}},
		create: {organizationId: orgId, leadId, status: "QUEUED", sourceTypeId: type.id, sourceTypeName: type.name, createdById: userId},
		update: {status: "QUEUED", error: null, sourceTypeId: type.id, sourceTypeName: type.name, createdById: userId},
	})
	await inngest.send({name: "research/draft.requested", data: {draftId: draft.id, organizationId: orgId}})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true, draftId: draft.id}
}

export async function getDraft(leadId: string) {
	const {orgId} = await requireOrg()
	return prisma.leadDraft.findFirst({where: {organizationId: orgId, leadId}})
}

export async function saveDraft(leadId: string, subject: string, body: string): Promise<SaveDraftResult> {
	const {orgId, userId} = await requireOrg()
	const lead = await prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	await prisma.leadDraft.upsert({
		where: {organizationId_leadId: {organizationId: orgId, leadId}},
		create: {organizationId: orgId, leadId, subject: subject.trim(), body: body.trim(), status: "DONE", sourceTypeName: "(ręczny)", createdById: userId},
		update: {subject: subject.trim(), body: body.trim(), status: "DONE", error: null},
	})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true}
}
