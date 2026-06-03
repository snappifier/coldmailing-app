// scripts/diag-poll-trace.ts — temporary: run the REAL fetch+match pipeline with an explicit
// startHistoryId and print every intermediate value to see where the reply is lost.
import "dotenv/config"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"
import {listAddedSince} from "../features/replies/gmail-history"
import {getTrackedThreads} from "../features/replies/queries"
import {matchReplies} from "../features/replies/match"
import {classifyInbound} from "../features/replies/classify"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const start = process.argv[2] ?? "221466"
	const acct = await prisma.emailAccount.findFirst({
		where: {status: "CONNECTED"},
		select: {id: true, email: true, displayName: true, accessTokenEnc: true, refreshTokenEnc: true, tokenExpiresAt: true},
	})
	if (!acct) throw new Error("no connected mailbox")

	console.log(`listAddedSince(start=${start}) for ${acct.email}\n`)
	const r = await listAddedSince(acct, start)
	console.log(`expired=${r.expired}  newHistoryId=${r.newHistoryId}  added=${r.added.length}`)
	for (const a of r.added) {
		console.log({
			id: a.gmailMessageId,
			threadId: a.threadId,
			from: a.from,
			subject: a.subject,
			labelIds: a.labelIds,
			snippet: a.snippet.slice(0, 60),
		})
	}

	const tracked = await getTrackedThreads(acct.id)
	console.log("\ntrackedThreads:", tracked)

	const matches = matchReplies({mailboxEmail: acct.email, added: r.added, trackedThreads: tracked})
	console.log("\nmatches:", matches)

	for (const m of matches) {
		const msg = r.added.find((a) => a.gmailMessageId === m.gmailMessageId)!
		const kind = classifyInbound({from: msg.from, subject: msg.subject, labelIds: msg.labelIds, autoSubmitted: msg.autoSubmitted, precedence: msg.precedence, failedRecipients: msg.failedRecipients})
		console.log(`classify ${m.gmailMessageId}: ${kind}  snippet="${msg.snippet.slice(0, 50)}"`)
	}
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
