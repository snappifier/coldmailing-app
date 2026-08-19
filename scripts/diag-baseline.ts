// temporary: print the connected mailbox's current Gmail profile
// historyId (a safe "before the reply" cursor anchor to fall back on).
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"
import {getProfileHistoryId} from "../features/replies/gmail-history"

const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!})})

async function main() {
	const acct = await prisma.emailAccount.findFirst({
		where: {status: "CONNECTED"},
		select: {id: true, email: true, displayName: true, accessTokenEnc: true, refreshTokenEnc: true, tokenExpiresAt: true, lastHistoryId: true},
	})
	if (!acct) throw new Error("no connected mailbox")
	const hid = await getProfileHistoryId(acct)
	console.log(`${acct.email}: profile historyId NOW = ${hid}  (stored cursor = ${acct.lastHistoryId})`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {console.error(e); await prisma.$disconnect(); process.exit(1)})
