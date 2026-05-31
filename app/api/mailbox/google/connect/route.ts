// app/api/mailbox/google/connect/route.ts
import {NextResponse} from "next/server"
import {requireOrg} from "@/lib/org"
import {buildConsentUrl, signState} from "@/features/email-accounts/google-oauth"

export async function GET() {
	const {orgId} = await requireOrg()
	const url = buildConsentUrl(signState(orgId))
	return NextResponse.redirect(url)
}
