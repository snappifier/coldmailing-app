"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {
	DEMO_EMAIL_SUFFIX,
	DEMO_NAME_SUFFIX,
	DEMO_KEY_PREFIX,
	DEMO_OFFERING_LINES,
	DEMO_TEMPLATES,
	DEMO_PLACEHOLDERS,
	DEMO_CAMPAIGNS,
	DEMO_SUPPRESSIONS,
	DEMO_ACTIVITIES,
	buildDemoLeads,
	buildSendPlan,
} from "@/features/demo/seed-data"
import type {CampaignLeadStatus} from "@/generated/prisma/client"

export type DemoResult = {ok: true; message: string} | {ok: false; error: string}

function daysAgo(days: number, hour = 10, minute = 0) {
	const d = new Date(Date.now() - days * 86_400_000)
	d.setHours(hour, minute, 0, 0)
	return d
}

// Per-campaign membership plan: [status, currentStep] tuples applied to consecutive demo leads.
const ACTIVE_PLAN: [CampaignLeadStatus, number][] = [
	...Array.from({length: 8}, (): [CampaignLeadStatus, number] => ["DONE", 2]),
	...Array.from({length: 5}, (): [CampaignLeadStatus, number] => ["REPLIED", 1]),
	...Array.from({length: 6}, (): [CampaignLeadStatus, number] => ["ACTIVE", 1]),
	...Array.from({length: 6}, (): [CampaignLeadStatus, number] => ["PENDING", 0]),
	["FAILED", 1],
	["BOUNCED", 1],
	["UNSUBSCRIBED", 1],
]
const PAUSED_PLAN: [CampaignLeadStatus, number][] = [
	...Array.from({length: 4}, (): [CampaignLeadStatus, number] => ["DONE", 2]),
	...Array.from({length: 2}, (): [CampaignLeadStatus, number] => ["REPLIED", 1]),
	...Array.from({length: 3}, (): [CampaignLeadStatus, number] => ["ACTIVE", 1]),
	...Array.from({length: 3}, (): [CampaignLeadStatus, number] => ["PENDING", 0]),
]

export async function seedDemoData(): Promise<DemoResult> {
	if (process.env.NODE_ENV === "production") return {ok: false, error: "Dane demo tylko w trybie deweloperskim"}
	const {orgId, userId} = await requireOrg()

	const existing = await prisma.lead.count({where: {organizationId: orgId, email: {endsWith: DEMO_EMAIL_SUFFIX}}})
	if (existing > 0) return {ok: false, error: "Dane demo już istnieją — najpierw je usuń"}

	const account = await prisma.emailAccount.findFirst({where: {organizationId: orgId}, select: {id: true, email: true}})
	const demoLeads = buildDemoLeads()

	try {
		await prisma.$transaction(
			async (tx) => {
				const lines: {id: string}[] = []
				for (const line of DEMO_OFFERING_LINES) lines.push(await tx.offeringLine.create({data: {organizationId: orgId, ...line}, select: {id: true}}))
				const templates: {id: string}[] = []
				for (const t of DEMO_TEMPLATES) templates.push(await tx.template.create({data: {organizationId: orgId, createdById: userId, ...t}, select: {id: true}}))
				await tx.placeholder.createMany({
					data: DEMO_PLACEHOLDERS.map((p) => ({organizationId: orgId, createdById: userId, key: p.key, label: p.label, type: p.type, fallback: p.fallback, options: "options" in p ? p.options : undefined})),
				})

				await tx.lead.createMany({
					data: demoLeads.map((l, i) => ({organizationId: orgId, offeringLineId: lines[i % lines.length].id, ...l})),
				})
				const created = await tx.lead.findMany({where: {organizationId: orgId, email: {endsWith: DEMO_EMAIL_SUFFIX}}, select: {id: true, email: true, organizationName: true}})
				const idByEmail = new Map(created.map((l) => [l.email ?? "", l.id]))
				const leadId = (i: number) => idByEmail.get(demoLeads[i].email)
				const leadIds = demoLeads.map((_, i) => leadId(i)).filter((id): id is string => id != null)

				const [campA, campB, campC] = [
					await tx.campaign.create({data: {organizationId: orgId, name: DEMO_CAMPAIGNS[0].name, status: "ACTIVE", offeringLineId: lines[0].id, createdById: userId, sendingEmailAccountId: account?.id ?? null}}),
					await tx.campaign.create({data: {organizationId: orgId, name: DEMO_CAMPAIGNS[1].name, status: "PAUSED", offeringLineId: lines[1].id, createdById: userId}}),
					await tx.campaign.create({data: {organizationId: orgId, name: DEMO_CAMPAIGNS[2].name, status: "DRAFT", offeringLineId: lines[2].id, createdById: userId}}),
				]
				await tx.sequenceStep.createMany({
					data: [
						{campaignId: campA.id, order: 1, templateId: templates[0].id, delayDays: 0, condition: "ALWAYS"},
						{campaignId: campA.id, order: 2, templateId: templates[1].id, delayDays: 4, condition: "SEND_IF_NO_REPLY"},
						{campaignId: campB.id, order: 1, templateId: templates[2].id, delayDays: 0, condition: "ALWAYS"},
						{campaignId: campB.id, order: 2, templateId: templates[3].id, delayDays: 5, condition: "SEND_IF_NO_REPLY"},
						{campaignId: campC.id, order: 1, templateId: templates[2].id, delayDays: 0, condition: "ALWAYS"},
					],
				})

				const clRows: {campaignId: string; leadId: string; status: CampaignLeadStatus; currentStep: number; nextSendAt: Date | null; repliedAt: Date | null; lastError: string | null}[] = []
				ACTIVE_PLAN.forEach(([status, step], i) => {
					const id = leadIds[i]
					if (!id) return
					clRows.push({
						campaignId: campA.id,
						leadId: id,
						status,
						currentStep: step,
						nextSendAt: status === "ACTIVE" ? daysAgo(-1 - (i % 3), 9) : null,
						repliedAt: status === "REPLIED" ? daysAgo(i % 6, 11, 24) : null,
						lastError: status === "FAILED" ? "Gmail: przekroczony limit wysyłki (demo)" : null,
					})
				})
				PAUSED_PLAN.forEach(([status, step], i) => {
					const id = leadIds[ACTIVE_PLAN.length + i]
					if (!id) return
					clRows.push({campaignId: campB.id, leadId: id, status, currentStep: step, nextSendAt: null, repliedAt: status === "REPLIED" ? daysAgo(2 + (i % 4), 13, 5) : null, lastError: null})
				})
				await tx.campaignLead.createMany({data: clRows})

				if (account) {
					const cls = await tx.campaignLead.findMany({
						where: {campaignId: {in: [campA.id, campB.id]}},
						select: {id: true, status: true, repliedAt: true, campaignId: true, lead: {select: {email: true, organizationName: true}}},
					})
					const contacted = cls.filter((c) => c.status !== "PENDING")
					const sendCounts = new Map<string, number>()
					const plan = buildSendPlan(30)
					const msgRows = plan.map((day, i) => {
						const cl = contacted[i % contacted.length]
						const nth = sendCounts.get(cl.id) ?? 0
						sendCounts.set(cl.id, nth + 1)
						const tpl = cl.campaignId === campA.id ? (nth === 0 ? DEMO_TEMPLATES[0] : DEMO_TEMPLATES[1]) : nth === 0 ? DEMO_TEMPLATES[2] : DEMO_TEMPLATES[3]
						return {
							organizationId: orgId,
							campaignLeadId: cl.id,
							emailAccountId: account.id,
							direction: "OUTBOUND" as const,
							subject: tpl.subject.replace("{{nazwaFirmy}}", cl.lead.organizationName),
							body: tpl.body.replace(/\{\{nazwaFirmy\}\}/g, cl.lead.organizationName),
							intendedTo: cl.lead.email ?? "",
							actualTo: cl.lead.email ?? "",
							gmailMessageId: `demo-msg-${i}`,
							gmailThreadId: `demo-thread-${cl.id}`,
							status: "SENT" as const,
							sentAt: daysAgo(day, 8 + (i % 8), (i * 7) % 60),
						}
					})
					await tx.message.createMany({data: msgRows})

					const replied = cls.filter((c) => c.status === "REPLIED")
					await tx.message.createMany({
						data: replied.map((cl, i) => ({
							organizationId: orgId,
							campaignLeadId: cl.id,
							emailAccountId: account.id,
							direction: "INBOUND" as const,
							inboundKind: i === replied.length - 1 ? ("OPT_OUT_SUSPECT" as const) : ("REPLY" as const),
							subject: `Re: ${(cl.campaignId === campA.id ? DEMO_TEMPLATES[0] : DEMO_TEMPLATES[2]).subject.replace("{{nazwaFirmy}}", cl.lead.organizationName)}`,
							body: i === replied.length - 1 ? "Proszę o wykreślenie nas z listy mailingowej." : "Dzień dobry, proszę o przesłanie szczegółów — brzmi ciekawie.",
							intendedTo: account.email,
							actualTo: account.email,
							gmailMessageId: `demo-reply-${i}`,
							gmailThreadId: `demo-thread-${cl.id}`,
							status: "SENT" as const,
							sentAt: cl.repliedAt,
							createdAt: cl.repliedAt ?? undefined,
						})),
					})
				}

				await tx.leadActivity.createMany({
					data: DEMO_ACTIVITIES.flatMap((a) => {
						const id = leadId(a.leadIndex)
						if (!id) return []
						return [{organizationId: orgId, leadId: id, kind: a.kind, body: a.body, fromStage: a.fromStage, toStage: a.toStage, authorUserId: userId, createdAt: daysAgo(a.daysAgo, 14, 30)}]
					}),
				})
				await tx.suppression.createMany({data: DEMO_SUPPRESSIONS.map((s) => ({organizationId: orgId, ...s})), skipDuplicates: true})
			},
			{timeout: 30_000, maxWait: 10_000},
		)
	} catch (e) {
		return {ok: false, error: `Seed nie powiódł się: ${e instanceof Error ? e.message : "nieznany błąd"}`}
	}

	revalidatePath("/", "layout")
	return {ok: true, message: account ? "Dodano dane demo (leady, kampanie, wysyłki, odpowiedzi)" : "Dodano dane demo (bez wiadomości — brak podłączonej skrzynki)"}
}

export async function clearDemoData(): Promise<DemoResult> {
	if (process.env.NODE_ENV === "production") return {ok: false, error: "Dane demo tylko w trybie deweloperskim"}
	const {orgId} = await requireOrg()

	try {
		await prisma.$transaction(
			async (tx) => {
				await tx.campaign.deleteMany({where: {organizationId: orgId, name: {endsWith: DEMO_NAME_SUFFIX}}})
				await tx.template.deleteMany({where: {organizationId: orgId, name: {endsWith: DEMO_NAME_SUFFIX}}})
				await tx.lead.deleteMany({where: {organizationId: orgId, email: {endsWith: DEMO_EMAIL_SUFFIX}}})
				await tx.placeholder.deleteMany({where: {organizationId: orgId, key: {startsWith: DEMO_KEY_PREFIX}}})
				await tx.offeringLine.deleteMany({where: {organizationId: orgId, name: {endsWith: DEMO_NAME_SUFFIX}}})
				await tx.suppression.deleteMany({where: {organizationId: orgId, email: {endsWith: DEMO_EMAIL_SUFFIX}}})
			},
			{timeout: 30_000, maxWait: 10_000},
		)
	} catch (e) {
		return {ok: false, error: `Czyszczenie nie powiodło się: ${e instanceof Error ? e.message : "nieznany błąd"}`}
	}

	revalidatePath("/", "layout")
	return {ok: true, message: "Dane demo usunięte"}
}
