"use server"
// features/placeholders/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {placeholderSchema} from "@/features/placeholders/schema"

export type PlaceholderResult = {ok: true} | {ok: false; error: string}

export async function createPlaceholder(_prev: PlaceholderResult | null, formData: FormData): Promise<PlaceholderResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = placeholderSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.placeholder.create({
			data: {
				organizationId: orgId,
				createdById: userId,
				key: parsed.data.key,
				label: parsed.data.label,
				type: parsed.data.type,
				options: parsed.data.options ?? undefined,
				fallback: parsed.data.fallback,
				source: parsed.data.source,
			},
		})
	} catch {
		return {ok: false, error: "Placeholder o tym kluczu już istnieje"}
	}
	revalidatePath("/placeholdery")
	return {ok: true}
}

export async function deletePlaceholder(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.placeholder.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/placeholdery")
}
