"use server"
// features/suppression/actions.ts

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"

export type SuppressionResult = {ok: true} | {ok: false; error: string}

const emailSchema = z.string().trim().toLowerCase().email("Błędny email")

export async function addSuppression(_prev: SuppressionResult | null, formData: FormData): Promise<SuppressionResult> {
	const {orgId} = await requireOrg()
	const parsed = emailSchema.safeParse(formData.get("email"))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędny email"}

	await prisma.suppression.upsert({
		where: {organizationId_email: {organizationId: orgId, email: parsed.data}},
		update: {},
		create: {organizationId: orgId, email: parsed.data, reason: "MANUAL"},
	})
	revalidatePath("/suppression")
	return {ok: true}
}

export async function removeSuppression(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.suppression.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/suppression")
}
