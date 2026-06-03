// scripts/diag-set-cursor.ts — temporary: set the connected mailbox lastHistoryId to argv[2].
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!})})

async function main() {
	const value = process.argv[2]
	if (!value) throw new Error("usage: diag-set-cursor.ts <historyId>")
	const acct = await prisma.emailAccount.findFirst({where: {status: "CONNECTED"}, select: {id: true, email: true, lastHistoryId: true}})
	if (!acct) throw new Error("no connected mailbox")
	await prisma.emailAccount.update({where: {id: acct.id}, data: {lastHistoryId: value}})
	console.log(`${acct.email}: lastHistoryId ${acct.lastHistoryId} -> ${value}`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {console.error(e); await prisma.$disconnect(); process.exit(1)})
