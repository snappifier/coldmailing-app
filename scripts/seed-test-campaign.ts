// Idempotently create a ready-to-test 2-step campaign ("Test 5b") wired to the connected
// mailbox, with one PENDING lead. Re-run any time to reset to a clean PENDING state.
// Run: npx tsx scripts/seed-test-campaign.ts
// Then: npx tsx scripts/test-mode.ts on  (fast window/gap), Activate "Test 5b" in the app.
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function ensureTemplate(organizationId: string, name: string, subject: string, body: string) {
	const existing = await prisma.template.findFirst({where: {organizationId, name}})
	if (existing) return prisma.template.update({where: {id: existing.id}, data: {subject, body}})
	return prisma.template.create({data: {organizationId, name, subject, body}})
}

async function main() {
	const org = (await prisma.organization.findFirst()) ?? (await prisma.organization.create({data: {name: "Moja agencja"}}))

	const mailbox = await prisma.emailAccount.findFirst({where: {status: "CONNECTED"}, select: {id: true, email: true}})
	if (!mailbox) {
		console.error("No CONNECTED mailbox. Connect one at /skrzynki first.")
		process.exit(1)
	}

	// Optional arg "always" sets step 1's condition to ALWAYS (scenario C); default SEND_IF_NO_REPLY.
	const step1Condition = process.argv[2] === "always" ? "ALWAYS" : "SEND_IF_NO_REPLY"

	const lead = await prisma.lead.upsert({
		where: {organizationId_email: {organizationId: org.id, email: "lead5b@example.com"}},
		create: {organizationId: org.id, organizationName: "Test Liceum 5b", email: "lead5b@example.com", honorific: "PANI"},
		update: {organizationName: "Test Liceum 5b", honorific: "PANI"},
	})

	const t0 = await ensureTemplate(org.id, "Test 5b krok 0", "Test 5b - krok 0 ({{organizationName}})", "Testowy krok 0 dla {{organizationName}}.")
	const t1 = await ensureTemplate(org.id, "Test 5b krok 1", "Test 5b - krok 1 ({{organizationName}})", "Testowy followup - krok 1 dla {{organizationName}}.")

	const campaign = await prisma.campaign.upsert({
		where: {organizationId_name: {organizationId: org.id, name: "Test 5b"}},
		create: {organizationId: org.id, name: "Test 5b", status: "DRAFT", sendingEmailAccountId: mailbox.id},
		update: {status: "DRAFT", sendingEmailAccountId: mailbox.id},
	})

	await prisma.sequenceStep.upsert({
		where: {campaignId_order: {campaignId: campaign.id, order: 0}},
		create: {campaignId: campaign.id, order: 0, templateId: t0.id, condition: "SEND_IF_NO_REPLY", delayDays: 0},
		update: {templateId: t0.id, condition: "SEND_IF_NO_REPLY", delayDays: 0},
	})
	await prisma.sequenceStep.upsert({
		where: {campaignId_order: {campaignId: campaign.id, order: 1}},
		create: {campaignId: campaign.id, order: 1, templateId: t1.id, condition: step1Condition, delayDays: 0},
		update: {templateId: t1.id, condition: step1Condition, delayDays: 0},
	})

	const cl = await prisma.campaignLead.upsert({
		where: {campaignId_leadId: {campaignId: campaign.id, leadId: lead.id}},
		create: {campaignId: campaign.id, leadId: lead.id, status: "PENDING", currentStep: 0},
		update: {status: "PENDING", currentStep: 0, nextSendAt: null, repliedAt: null, lastError: null},
	})
	await prisma.message.deleteMany({where: {campaignLeadId: cl.id}})

	console.log(`Mailbox:  ${mailbox.email} (${mailbox.id})`)
	console.log(`Campaign: "${campaign.name}" (${campaign.id}) status=DRAFT, steps: 0=SEND_IF_NO_REPLY, 1=${step1Condition} (delay 0)`)
	console.log(`Lead:     ${lead.organizationName} (${lead.id}) -> CampaignLead ${cl.id} = PENDING`)
	console.log(`Ready. Run 'npx tsx scripts/test-mode.ts on' then Activate "Test 5b" in the app.`)
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
