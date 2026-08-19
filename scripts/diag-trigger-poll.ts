// temporary: send the poll event directly to the local Inngest
// dev server (same event the 5-min cron fans out), so poll-mailbox-replies runs deterministically.
import "dotenv/config"
import {Inngest} from "inngest"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})
const inngest = new Inngest({id: "coldmailing-app", isDev: true})

async function main() {
	const acct = await prisma.emailAccount.findFirst({where: {status: "CONNECTED"}, select: {id: true, email: true}})
	if (!acct) throw new Error("no connected mailbox")
	const res = await inngest.send({name: "campaign/mailbox.poll", data: {emailAccountId: acct.id}})
	console.log(`sent campaign/mailbox.poll for ${acct.email} (${acct.id})`)
	console.log("event ids:", res.ids)
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
