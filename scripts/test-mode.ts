// scripts/test-mode.ts
// Toggle every EmailAccount between a fast test profile (24/7 window, 5-10s gap) and the
// conservative production profile (Mon-Fri 08-16, 180-600s gap).
// Run: npx tsx scripts/test-mode.ts on   (fast testing)
//      npx tsx scripts/test-mode.ts off  (restore before real campaigns)
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

const MODES = {
	on: {sendDays: 127, sendWindowStartMin: 0, sendWindowEndMin: 1440, minGapSec: 60, maxGapSec: 90},
	off: {sendDays: 31, sendWindowStartMin: 480, sendWindowEndMin: 960, minGapSec: 180, maxGapSec: 600},
}

async function main() {
	const mode = process.argv[2]
	if (mode !== "on" && mode !== "off") {
		console.error("Usage: npx tsx scripts/test-mode.ts on|off")
		console.error("  on  = 24/7 window + 60-90s gap (test pacing: time to reply/pause between steps)")
		console.error("  off = Mon-Fri 08-16 + 180-600s gap (conservative; restore before real campaigns)")
		process.exit(1)
	}
	const res = await prisma.emailAccount.updateMany({data: MODES[mode]})
	console.log(`test-mode ${mode}: updated ${res.count} EmailAccount(s):`, MODES[mode])
	if (mode === "on") console.log("Remember to run 'off' before any real campaign.")
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
