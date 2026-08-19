"use server"

import {revalidatePath} from "next/cache"
import {z} from "zod"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {activateCampaign} from "@/features/campaigns/sending-actions"
import {parseWizardMessages, buildWizardTemplateName, WIZARD_FOLDER} from "@/features/campaigns/wizard"

export interface WizardCriteria {
	line: string | null
	minScore: number | null
	q: string | null
}

export type WizardResult =
	| {ok: true; campaignId: string; activated: boolean; activationError?: string}
	| {ok: false; error: string}

const basicsSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę kampanii").max(120),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
	filter_line: z.string().trim().optional().transform((v) => (v ? v : null)),
	filter_minScore: z.string().trim().optional().transform((v) => (v && Number.isFinite(Number(v)) ? Number(v) : null)),
	filter_q: z.string().trim().optional().transform((v) => (v ? v : null)),
	mailboxId: z.string().trim().optional().transform((v) => (v ? v : null)),
	mode: z.enum(["draft", "activate"]).default("draft"),
})

// Same filter idiom as /leady, plus the wizard invariants: lead has an email and is not suppressed.
async function wizardLeadWhere(orgId: string, c: WizardCriteria): Promise<Prisma.LeadWhereInput> {
	const suppressed = await prisma.suppression.findMany({where: {organizationId: orgId}, select: {email: true}})
	const where: Prisma.LeadWhereInput = {organizationId: orgId, email: {not: null}}
	if (c.line) where.offeringLineId = c.line
	if (c.minScore !== null) where.score = {gte: c.minScore}
	if (c.q) {
		where.OR = [
			{organizationName: {contains: c.q, mode: "insensitive"}},
			{email: {contains: c.q, mode: "insensitive"}},
			{contactPersonName: {contains: c.q, mode: "insensitive"}},
		]
	}
	if (suppressed.length > 0) where.NOT = {email: {in: suppressed.map((s) => s.email)}}
	return where
}

// Live count for wizard step 3.
export async function countWizardLeads(c: WizardCriteria): Promise<{count: number; sample: string[]}> {
	const {orgId} = await requireOrg()
	const where = await wizardLeadWhere(orgId, c)
	const [count, sample] = await Promise.all([
		prisma.lead.count({where}),
		prisma.lead.findMany({where, take: 4, orderBy: {createdAt: "desc"}, select: {organizationName: true}}),
	])
	return {count, sample: sample.map((s) => s.organizationName)}
}

export async function createCampaignFromWizard(_prev: WizardResult | null, formData: FormData): Promise<WizardResult> {
	const {orgId, userId} = await requireOrg()
	const fields = Object.fromEntries(formData)
	const basics = basicsSchema.safeParse(fields)
	if (!basics.success) return {ok: false, error: basics.error.issues[0]?.message ?? "Błędne dane"}
	const parsed = parseWizardMessages(fields)
	if (!parsed.ok) return parsed

	// Mailbox must belong to the org; a foreign id silently degrades to none.
	const mailbox = basics.data.mailboxId
		? await prisma.emailAccount.findFirst({where: {id: basics.data.mailboxId, organizationId: orgId}, select: {id: true}})
		: null

	const where = await wizardLeadWhere(orgId, {line: basics.data.filter_line, minScore: basics.data.filter_minScore, q: basics.data.filter_q})

	let campaignId: string
	try {
		campaignId = await prisma.$transaction(async (tx) => {
			const templateIds: string[] = []
			for (const [i, m] of parsed.messages.entries()) {
				const t = await tx.template.create({
					data: {
						organizationId: orgId,
						createdById: userId,
						name: buildWizardTemplateName(basics.data.name, i),
						subject: m.subject,
						body: m.body,
						isFollowup: i > 0,
						offeringLineId: basics.data.offeringLineId,
						folder: WIZARD_FOLDER,
					},
					select: {id: true},
				})
				templateIds.push(t.id)
			}
			const campaign = await tx.campaign.create({
				data: {
					organizationId: orgId,
					createdById: userId,
					name: basics.data.name,
					offeringLineId: basics.data.offeringLineId,
					sendingEmailAccountId: mailbox?.id ?? null,
				},
				select: {id: true},
			})
			await tx.sequenceStep.createMany({
				data: parsed.messages.map((m, i) => ({campaignId: campaign.id, order: i, templateId: templateIds[i], delayDays: m.delayDays, condition: m.condition})),
			})
			const leads = await tx.lead.findMany({where, select: {id: true}})
			if (leads.length > 0) {
				await tx.campaignLead.createMany({data: leads.map((l) => ({campaignId: campaign.id, leadId: l.id})), skipDuplicates: true})
			}
			return campaign.id
		})
	} catch {
		return {ok: false, error: "Kampania o tej nazwie już istnieje"}
	}

	revalidatePath("/kampanie")
	if (basics.data.mode === "activate") {
		// activateCampaign enforces ADMIN, validates mailbox/steps/leads and emits the start events.
		// It THROWS on a role violation (requireRole) - the campaign is already saved, so report it
		// as a saved draft rather than failing the whole action.
		try {
			const act = await activateCampaign(campaignId)
			if (!act.ok) return {ok: true, campaignId, activated: false, activationError: act.error}
			return {ok: true, campaignId, activated: true}
		} catch {
			return {ok: true, campaignId, activated: false, activationError: "Brak uprawnień do aktywacji"}
		}
	}
	return {ok: true, campaignId, activated: false}
}
