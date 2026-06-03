// scripts/diag-reset-suppression.ts — temporary: remove the lead5b suppression so a fresh
// send can go out (seed-test-campaign does NOT clear suppressions).
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!})})

async function main() {
	const org = await prisma.organization.findFirst({select: {id: true}})
	if (!org) throw new Error("no org")
	const res = await prisma.suppression.deleteMany({where: {organizationId: org.id, email: "lead5b@example.com"}})
	console.log(`deleted ${res.count} suppression row(s) for lead5b@example.com`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {console.error(e); await prisma.$disconnect(); process.exit(1)})
