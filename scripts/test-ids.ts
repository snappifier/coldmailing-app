// Read-only: print campaign / lead / mailbox ids + state for manual sending tests.
// Run: npx tsx scripts/test-ids.ts
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const campaigns = await prisma.campaign.findMany({
		select: {id: true, name: true, status: true, sendingEmailAccountId: true, _count: {select: {steps: true, campaignLeads: true}}},
	})
	const accounts = await prisma.emailAccount.findMany({
		select: {
			id: true,
			email: true,
			status: true,
			scope: true,
			sendDays: true,
			sendWindowStartMin: true,
			sendWindowEndMin: true,
			minGapSec: true,
			maxGapSec: true,
		},
	})
	const leads = await prisma.campaignLead.findMany({
		select: {
			id: true,
			campaignId: true,
			status: true,
			currentStep: true,
			nextSendAt: true,
			repliedAt: true,
			lead: {select: {organizationName: true, email: true}},
		},
	})
	const steps = await prisma.sequenceStep.findMany({
		select: {id: true, campaignId: true, order: true, condition: true, delayDays: true, template: {select: {name: true}}},
		orderBy: [{campaignId: "asc"}, {order: "asc"}],
	})

	console.log("=== Campaigns ===")
	for (const c of campaigns) console.log(c)
	console.log("\n=== SequenceSteps ===")
	for (const s of steps) console.log(s)
	console.log("\n=== EmailAccounts ===")
	for (const a of accounts) console.log({...a, scope: a.scope ? "(set)" : null, readonly: a.scope?.includes("gmail.readonly") ?? false})
	console.log("\n=== CampaignLeads ===")
	for (const l of leads) console.log(l)
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
