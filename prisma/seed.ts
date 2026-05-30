// prisma/seed.ts
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const existing = await prisma.organization.findFirst()
	if (!existing) {
		await prisma.organization.create({data: {name: "Moja agencja"}})
		console.log("Seeded default organization")
	} else {
		console.log("Organization already exists, skipping seed")
	}
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
