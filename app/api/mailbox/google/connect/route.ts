import {NextResponse} from "next/server"
import {requireRole} from "@/lib/org"
import {buildConsentUrl, signState} from "@/features/email-accounts/google-oauth"

export async function GET() {
	const {orgId} = await requireRole("ADMIN")
	const url = buildConsentUrl(signState(orgId))
	return NextResponse.redirect(url)
}
