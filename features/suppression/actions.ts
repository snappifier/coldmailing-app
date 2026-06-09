"use server"
// features/suppression/actions.ts

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireOrg, requireRole} from "@/lib/org"

export type SuppressionResult = {ok: true} | {ok: false; error: string}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Błędny email"))

export async function addSuppression(_prev: SuppressionResult | null, formData: FormData): Promise<SuppressionResult> {
	const {orgId} = await requireOrg()
	const parsed = emailSchema.safeParse(formData.get("email"))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędny email"}

	await prisma.suppression.upsert({
		where: {organizationId_email: {organizationId: orgId, email: parsed.data}},
		update: {},
		create: {organizationId: orgId, email: parsed.data, reason: "MANUAL"},
	})
	revalidatePath("/suppression")
	return {ok: true}
}

export async function removeSuppression(id: string): Promise<void> {
	const {orgId} = await requireRole("ADMIN")
	await prisma.suppression.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/suppression")
}

export async function markDoNotContact(campaignLeadId: string): Promise<void> {
	const {orgId} = await requireOrg()
	const cl = await prisma.campaignLead.findFirst({
		where: {id: campaignLeadId, campaign: {organizationId: orgId}},
		include: {lead: {select: {email: true}}, messages: {where: {direction: "INBOUND"}, orderBy: {createdAt: "desc"}, take: 1, select: {inboundKind: true}}},
	})
	if (!cl) return
	const isBounce = cl.messages[0]?.inboundKind === "BOUNCE"
	if (cl.lead.email) {
		await prisma.suppression.upsert({
			where: {organizationId_email: {organizationId: orgId, email: cl.lead.email}},
			update: {reason: isBounce ? "BOUNCED" : "UNSUBSCRIBED"},
			create: {organizationId: orgId, email: cl.lead.email, reason: isBounce ? "BOUNCED" : "UNSUBSCRIBED"},
		})
	}
	await prisma.campaignLead.update({where: {id: cl.id}, data: {status: isBounce ? "BOUNCED" : "UNSUBSCRIBED"}})
	revalidatePath(`/kampanie/${cl.campaignId}`)
}
