// features/research/apply-confirm.ts
import {prisma} from "@/lib/prisma"
import {toLeadUpdate} from "@/features/research/apply"
import type {ProposedField} from "@/features/research/types"

interface ApplyArgs {
	orgId: string
	userId: string | null
	runId: string
	leadId: string
	existingCustom: Record<string, string>
	proposed: ProposedField[]
}

// Shared by single-run confirm (2b) and batch apply (2c): re-check an email collision against the
// org, drop the colliding email proposal, write the rest, and log a RESEARCH activity.
export async function applyProposedToLead({orgId, userId, runId, leadId, existingCustom, proposed}: ApplyArgs): Promise<{applied: number; emailSkipped: boolean}> {
	void runId
	if (proposed.length === 0) return {applied: 0, emailSkipped: false}

	let toApply = proposed
	let emailSkipped = false
	const emailItem = toApply.find((p) => p.target === "email")
	if (emailItem && typeof emailItem.value === "string") {
		const taken = await prisma.lead.findFirst({where: {organizationId: orgId, email: emailItem.value, id: {not: leadId}}, select: {id: true}})
		if (taken) {
			toApply = toApply.filter((p) => p.target !== "email")
			emailSkipped = true
		}
	}
	if (toApply.length === 0) return {applied: 0, emailSkipped}

	const {data, customFields} = toLeadUpdate(toApply, existingCustom)
	await prisma.$transaction([
		prisma.lead.updateMany({where: {id: leadId, organizationId: orgId}, data: {...data, customFields}}),
		prisma.leadActivity.create({data: {organizationId: orgId, leadId, kind: "RESEARCH", body: `Zastosowano propozycje researchu (${toApply.length})`, authorUserId: userId}}),
	])
	return {applied: toApply.length, emailSkipped}
}
