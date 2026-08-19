// temporary 5c live-e2e diagnostic (safe, read-only)
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const org = await prisma.organization.findFirst({select: {id: true, name: true, optOutMode: true, optOutDetector: true}})
	console.log("=== Org opt-out settings ===")
	console.log(org)

	const mailbox = await prisma.emailAccount.findFirst({
		where: {status: "CONNECTED"},
		select: {id: true, email: true, status: true, scope: true, lastHistoryId: true},
	})
	console.log("\n=== Connected mailbox ===")
	console.log(mailbox)

	const cl = await prisma.campaignLead.findFirst({
		where: {lead: {email: "lead5b@example.com"}},
		select: {id: true, status: true, currentStep: true, repliedAt: true, nextSendAt: true, lastError: true},
	})
	console.log("\n=== CampaignLead (lead5b) ===")
	console.log(cl)

	const msgs = await prisma.message.findMany({
		where: {campaignLeadId: cl?.id},
		orderBy: {createdAt: "asc"},
		select: {direction: true, inboundKind: true, status: true, subject: true, actualTo: true, gmailThreadId: true, gmailMessageId: true, sentAt: true, createdAt: true, body: true},
	})
	console.log(`\n=== Messages for lead5b (${msgs.length}) ===`)
	for (const m of msgs) {
		console.log({
			direction: m.direction,
			inboundKind: m.inboundKind,
			status: m.status,
			subject: m.subject,
			actualTo: m.actualTo,
			gmailThreadId: m.gmailThreadId,
			gmailMessageId: m.gmailMessageId,
			sentAt: m.sentAt,
			createdAt: m.createdAt,
			bodyPreview: m.body?.slice(0, 80),
		})
	}

	const supp = await prisma.suppression.findMany({where: {organizationId: org?.id}, select: {email: true, reason: true, createdAt: true}})
	console.log(`\n=== Suppression (${supp.length}) ===`)
	console.log(supp)
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
