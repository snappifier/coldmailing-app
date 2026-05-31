// lib/inngest/sending.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {sendEmail} from "@/features/sending/gmail"
import {renderTemplate, type RenderLead} from "@/features/templates/render"
import {resolveRecipient} from "@/features/sending/recipient"
import {isWithinWindow, nextWindowOpen} from "@/features/sending/schedule"

export const sendCampaignEmail = inngest.createFunction(
	{
		id: "send-campaign-email",
		triggers: {event: "campaign/lead.send"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
		retries: 3,
	},
	async ({event, step}) => {
		const {campaignLeadId} = event.data as {campaignLeadId: string; emailAccountId: string}

		const cl = await prisma.campaignLead.findUnique({
			where: {id: campaignLeadId},
			include: {campaign: true, lead: true},
		})
		if (!cl || cl.status !== "ACTIVE" || cl.campaign.status !== "ACTIVE") return {skipped: "not-active"}

		const account = cl.campaign.sendingEmailAccountId
			? await prisma.emailAccount.findUnique({where: {id: cl.campaign.sendingEmailAccountId}})
			: null
		if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

		// Wait for the planned slot.
		if (cl.nextSendAt) await step.sleepUntil("wait-slot", cl.nextSendAt)

		// Re-check the window now; if closed, defer to the next open slot.
		const now = new Date()
		if (!isWithinWindow(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)) {
			const open = nextWindowOpen(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)
			await step.sleepUntil("wait-window", open)
		}

		// Daily limit (count this local day's SENT messages).
		const dayStart = new Date(
			new Intl.DateTimeFormat("en-CA", {timeZone: account.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date()) + "T00:00:00",
		)
		const sentToday = await prisma.message.count({where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: dayStart}}})
		if (sentToday >= account.dailyLimit) {
			const open = nextWindowOpen(new Date(Date.now() + 60_000), account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)
			await step.sleepUntil("wait-daily-limit", open)
		}

		// Suppression gate.
		if (cl.lead.email) {
			const sup = await prisma.suppression.findUnique({
				where: {organizationId_email: {organizationId: cl.campaign.organizationId, email: cl.lead.email}},
			})
			if (sup) {
				await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
				return {skipped: "suppressed"}
			}
		}
		if (!cl.lead.email) {
			await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
			return {skipped: "no-email"}
		}

		// Resolve the template for step 0 and render subject + body.
		const stepZero = await prisma.sequenceStep.findFirst({
			where: {campaignId: cl.campaignId, order: 0},
			include: {template: true},
		})
		if (!stepZero) return {skipped: "no-step"}
		const placeholders = await prisma.placeholder.findMany({
			where: {organizationId: cl.campaign.organizationId},
			select: {key: true, source: true, fallback: true},
		})
		const renderLead: RenderLead = {
			organizationName: cl.lead.organizationName,
			contactPersonName: cl.lead.contactPersonName,
			city: cl.lead.city,
			website: cl.lead.website,
			aiHook: cl.lead.aiHook,
			honorific: cl.lead.honorific,
			customFields: (cl.lead.customFields as Record<string, unknown> | null) ?? null,
		}
		const ctx = {lead: renderLead, senderName: account.displayName ?? "", placeholders}
		const subject = renderTemplate(stepZero.template.subject, ctx).rendered
		const body = renderTemplate(stepZero.template.body, ctx).rendered

		const {to} = resolveRecipient(cl.lead.email, process.env.SEND_OVERRIDE_TO)

		try {
			const ids = await step.run("gmail-send", () => sendEmail(account, {to, subject, text: body}))
			await step.run("log-success", async () => {
				await prisma.message.create({
					data: {
						organizationId: cl.campaign.organizationId,
						campaignLeadId: cl.id,
						emailAccountId: account.id,
						subject,
						body,
						intendedTo: cl.lead.email!,
						actualTo: to,
						gmailMessageId: ids.gmailMessageId,
						gmailThreadId: ids.gmailThreadId,
						status: "SENT",
						sentAt: new Date(),
					},
				})
				await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "DONE", currentStep: 1}})
			})
			return {sent: ids.gmailMessageId}
		} catch (err) {
			await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "FAILED", lastError: String(err).slice(0, 500)}})
			throw err // let Inngest record the failure after retries
		}
	},
)
