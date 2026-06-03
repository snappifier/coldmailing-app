// scripts/diag-inbox.ts — temporary: list recent messages in the connected mailbox (read-only)
import "dotenv/config"
import {google} from "googleapis"
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"
import {oauthClientFor} from "../features/sending/gmail"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const acct = await prisma.emailAccount.findFirst({
		where: {status: "CONNECTED"},
		select: {id: true, email: true, displayName: true, accessTokenEnc: true, refreshTokenEnc: true, tokenExpiresAt: true},
	})
	if (!acct) throw new Error("no connected mailbox")
	const gmail = google.gmail({version: "v1", auth: oauthClientFor(acct)})

	// Tracked threads = this mailbox's outbound thread ids (derived from DB, not hardcoded).
	const outbound = await prisma.message.findMany({where: {emailAccountId: acct.id, direction: "OUTBOUND", gmailThreadId: {not: null}}, select: {gmailThreadId: true}})
	const trackedThreads = new Set(outbound.map((m) => m.gmailThreadId))

	const list = await gmail.users.messages.list({userId: "me", maxResults: 15, q: "newer_than:1d"})
	console.log(`Mailbox ${acct.email} — ${list.data.messages?.length ?? 0} message(s) in the last day:\n`)
	for (const m of list.data.messages ?? []) {
		const meta = await gmail.users.messages.get({userId: "me", id: m.id!, format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"]})
		const headers = meta.data.payload?.headers ?? []
		const hv = (n: string) => headers.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value ?? ""
		const tid = meta.data.threadId ?? ""
		const tracked = trackedThreads.has(tid) ? "  <-- TRACKED" : ""
		console.log(`from: ${hv("From")}`)
		console.log(`  subject: ${hv("Subject")}`)
		console.log(`  threadId: ${tid}${tracked}`)
		console.log(`  snippet: ${(meta.data.snippet ?? "").slice(0, 90)}`)
		console.log("")
	}
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
