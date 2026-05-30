// features/offering-lines/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {offeringLineSchema} from "@/features/offering-lines/schema"

export type ActionResult = {ok: true} | {ok: false; error: string}

export async function createOfferingLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
	const {orgId} = await requireOrg()
	const parsed = offeringLineSchema.safeParse({
		name: formData.get("name"),
		description: formData.get("description"),
	})
	if (!parsed.success) {
		return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	}

	try {
		await prisma.offeringLine.create({
			data: {organizationId: orgId, name: parsed.data.name, description: parsed.data.description},
		})
	} catch {
		return {ok: false, error: "Linia o tej nazwie już istnieje"}
	}

	revalidatePath("/linie")
	return {ok: true}
}

export async function deleteOfferingLine(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.offeringLine.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/linie")
}
