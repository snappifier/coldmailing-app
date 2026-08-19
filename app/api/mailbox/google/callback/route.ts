import {NextResponse} from "next/server"
import {prisma} from "@/lib/prisma"
import {exchangeCodeToMailbox, verifyState} from "@/features/email-accounts/google-oauth"

export async function GET(request: Request) {
	const params = new URL(request.url).searchParams
	const code = params.get("code")
	const state = params.get("state")
	const orgId = state ? verifyState(state) : null
	if (!code || !orgId) {
		return NextResponse.redirect(new URL("/skrzynki?error=oauth", request.url))
	}
	try {
		const mailbox = await exchangeCodeToMailbox(code)
		await prisma.emailAccount.upsert({
			where: {organizationId_email: {organizationId: orgId, email: mailbox.email}},
			update: {
				accessTokenEnc: mailbox.accessTokenEnc,
				refreshTokenEnc: mailbox.refreshTokenEnc,
				tokenExpiresAt: mailbox.tokenExpiresAt,
				scope: mailbox.scope,
				status: "CONNECTED",
			},
			create: {
				organizationId: orgId,
				email: mailbox.email,
				displayName: mailbox.email,
				accessTokenEnc: mailbox.accessTokenEnc,
				refreshTokenEnc: mailbox.refreshTokenEnc,
				tokenExpiresAt: mailbox.tokenExpiresAt,
				scope: mailbox.scope,
			},
		})
		return NextResponse.redirect(new URL("/skrzynki?connected=1", request.url))
	} catch {
		return NextResponse.redirect(new URL("/skrzynki?error=exchange", request.url))
	}
}
