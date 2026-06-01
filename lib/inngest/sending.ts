// lib/inngest/sending.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {sendEmail} from "@/features/sending/gmail"
import {renderTemplate, type RenderLead} from "@/features/templates/render"
import {resolveRecipient} from "@/features/sending/recipient"
import {isWithinWindow, nextWindowOpen, scheduleFollowupSlot} from "@/features/sending/schedule"
import {decideStep, planNext, type StepDef} from "@/features/sequences/plan"

const HARD_STOP = ["PENDING", "SKIPPED", "FAILED", "BOUNCED", "UNSUBSCRIBED", "DONE"]

// Mark DONE only if still in-sequence; REPLIED (and other terminal statuses) win and are left as-is.
async function finalizeLead(campaignLeadId: string): Promise<void> {
	await prisma.campaignLead.updateMany({
		where: {id: campaignLeadId, status: {notIn: ["REPLIED", "SKIPPED", "FAILED", "BOUNCED", "UNSUBSCRIBED", "DONE"]}},
		data: {status: "DONE"},
	})
}

export const runLeadSequence = inngest.createFunction(
	{
		id: "run-lead-sequence",
		triggers: {event: "campaign/lead.start"},
		concurrency: {limit: 1, key: "event.data.emailAccountId"},
		cancelOn: [{event: "campaign/paused", if: "async.data.campaignId == event.data.campaignId"}],
		singleton: {key: "event.data.campaignLeadId", mode: "cancel"},
		retries: 3,
	},
	async ({event, step}) => {
		const {campaignLeadId} = event.data as {campaignLeadId: string; campaignId: string; emailAccountId: string}

		// Steps + placeholders loaded once; mid-flight sequence edits are not picked up (accepted, see spec).
		const base = await prisma.campaignLead.findUnique({where: {id: campaignLeadId}, include: {campaign: true}})
		if (!base) return {skipped: "no-lead"}
		const steps = await prisma.sequenceStep.findMany({
			where: {campaignId: base.campaignId},
			include: {template: true},
			orderBy: {order: "asc"},
		})
		const stepDefs: StepDef[] = steps.map((s) => ({order: s.order, condition: s.condition, delayDays: s.delayDays}))
		const placeholders = await prisma.placeholder.findMany({
			where: {organizationId: base.campaign.organizationId},
			select: {key: true, source: true, fallback: true},
		})

		let cursor = base.currentStep
		let slot: Date = base.nextSendAt ?? new Date()

		for (let iterations = 0; iterations <= steps.length; iterations++) {
			await step.sleepUntil(`slot-${cursor}`, slot)

			// Fresh read after sleeping: status / repliedAt / currentStep may have changed.
			const cl = await prisma.campaignLead.findUnique({where: {id: campaignLeadId}, include: {campaign: true, lead: true}})
			if (!cl) return {skipped: "no-lead"}
			if (cl.campaign.status !== "ACTIVE") return {skipped: "campaign-not-active"}
			if (HARD_STOP.includes(cl.status)) return {skipped: `status-${cl.status}`}

			const account = cl.campaign.sendingEmailAccountId
				? await prisma.emailAccount.findUnique({where: {id: cl.campaign.sendingEmailAccountId}})
				: null
			if (!account || account.status !== "CONNECTED") return {skipped: "no-account"}

			// First step at/after the cursor (gap-safe and tolerant of a provisional currentStep).
			const sequenceStep = steps.find((s) => s.order >= cursor)
			if (!sequenceStep) {
				await finalizeLead(campaignLeadId)
				return {finalized: true}
			}
			const order = sequenceStep.order

			if (decideStep(sequenceStep.condition, cl.repliedAt) === "SEND") {
				// Window gate: defer to the next open slot if closed now.
				const now = new Date()
				if (!isWithinWindow(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays)) {
					await step.sleepUntil(`window-${order}`, nextWindowOpen(now, account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays))
				}
				// Daily-limit gate: if today's quota is spent, defer to the next valid day.
				const dayStart = new Date(
					new Intl.DateTimeFormat("en-CA", {timeZone: account.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date()) + "T00:00:00",
				)
				const sentToday = await prisma.message.count({where: {emailAccountId: account.id, status: "SENT", sentAt: {gte: dayStart}}})
				if (sentToday >= account.dailyLimit) {
					await step.sleepUntil(`limit-${order}`, nextWindowOpen(new Date(Date.now() + 60_000), account.timezone, account.sendWindowStartMin, account.sendWindowEndMin, account.sendDays))
				}
				// Suppression / missing-email gates.
				if (!cl.lead.email) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
					return {skipped: "no-email"}
				}
				const sup = await prisma.suppression.findUnique({
					where: {organizationId_email: {organizationId: cl.campaign.organizationId, email: cl.lead.email}},
				})
				if (sup) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "SKIPPED"}})
					return {skipped: "suppressed"}
				}

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
				const subject = renderTemplate(sequenceStep.template.subject, ctx).rendered
				const body = renderTemplate(sequenceStep.template.body, ctx).rendered
				const {to} = resolveRecipient(cl.lead.email, process.env.SEND_OVERRIDE_TO)

				try {
					const ids = await step.run(`gmail-send-${order}`, () => sendEmail(account, {to, subject, text: body}))
					await step.run(`log-${order}`, async () => {
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
						await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: order + 1}})
					})
				} catch (err) {
					await prisma.campaignLead.update({where: {id: cl.id}, data: {status: "FAILED", lastError: String(err).slice(0, 500)}})
					throw err // surface to Inngest after retries
				}
			} else {
				// SKIP: advance without sending.
				await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: order + 1}})
			}

			const plan = planNext({steps: stepDefs, currentStep: order + 1, repliedAt: cl.repliedAt})
			if (plan.done) {
				await finalizeLead(campaignLeadId)
				return {finalized: true}
			}

			const nextDelay = plan.delayDays
			// Compute the next slot inside a step so the rng + clock are memoized across retries.
			const computedIso = await step.run(`slot-calc-${order}`, async () =>
				scheduleFollowupSlot(new Date(), nextDelay, account, Math.random).toISOString(),
			)
			slot = new Date(computedIso)
			await prisma.campaignLead.update({where: {id: cl.id}, data: {currentStep: plan.nextOrder, nextSendAt: slot}})
			cursor = plan.nextOrder
		}
		return {finalized: false, exhausted: true}
	},
)
