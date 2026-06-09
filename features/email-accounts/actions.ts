"use server"
// features/email-accounts/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {validateEmailAccountSettings, daysToMask, parseTime} from "@/features/email-accounts/settings"

export async function disconnectEmailAccount(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.emailAccount.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/skrzynki")
}

export type EmailAccountSettingsResult = {ok: true} | {ok: false; error: string}

export async function updateEmailAccountSettings(_prev: EmailAccountSettingsResult | null, formData: FormData): Promise<EmailAccountSettingsResult> {
	const {orgId} = await requireOrg()
	const id = String(formData.get("id") ?? "")
	if (!id) return {ok: false, error: "Brak id"}

	const days = Array.from({length: 7}, (_, i) => formData.get(`day_${i}`) === "on")
	const result = validateEmailAccountSettings({
		dailyLimit: Number(formData.get("dailyLimit")),
		windowStartMin: parseTime(String(formData.get("windowStart") ?? "")),
		windowEndMin: parseTime(String(formData.get("windowEnd") ?? "")),
		sendDays: daysToMask(days),
		minGapSec: Number(formData.get("gapMin")),
		maxGapSec: Number(formData.get("gapMax")),
		timezone: String(formData.get("timezone") ?? ""),
	})
	if (!result.ok) return result

	const res = await prisma.emailAccount.updateMany({where: {id, organizationId: orgId}, data: result.value})
	if (res.count === 0) return {ok: false, error: "Nie znaleziono skrzynki"}
	revalidatePath("/skrzynki")
	return {ok: true}
}
