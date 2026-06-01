// scripts/reset-campaign.ts
// Reset every CampaignLead of a named campaign to a clean PENDING state and delete their
// Messages (clean Gmail threads), so the sequence can be re-run from step 0.
// Run: npx tsx scripts/reset-campaign.ts "Kampania LO Q2"
// Then in the app: Pause (if the campaign is ACTIVE) -> Activate.
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const name = process.argv[2]
	if (!name) {
		console.error('Usage: npx tsx scripts/reset-campaign.ts "<campaign name>"')
		process.exit(1)
	}
	const campaign = await prisma.campaign.findFirst({where: {name}, select: {id: true, name: true, status: true}})
	if (!campaign) {
		console.error(`Campaign not found: ${name}`)
		process.exit(1)
	}
	const leads = await prisma.campaignLead.findMany({where: {campaignId: campaign.id}, select: {id: true}})
	const leadIds = leads.map((l) => l.id)
	const del = await prisma.message.deleteMany({where: {campaignLeadId: {in: leadIds}}})
	const upd = await prisma.campaignLead.updateMany({
		where: {campaignId: campaign.id},
		data: {status: "PENDING", currentStep: 0, nextSendAt: null, repliedAt: null, lastError: null},
	})
	console.log(`Campaign "${campaign.name}" (${campaign.id}, status=${campaign.status})`)
	console.log(`  reset ${upd.count} CampaignLead(s) -> PENDING / currentStep 0 / nextSendAt null / repliedAt null`)
	console.log(`  deleted ${del.count} Message(s)`)
	console.log(`Next: in the app Pause (if ACTIVE) then Activate to re-run from step 0.`)
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
