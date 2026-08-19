"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {researchTypeSchema} from "@/features/research-types/schema"

export type ResearchTypeResult = {ok: true} | {ok: false; error: string}

function parseForm(formData: FormData) {
	let outputFields: unknown = []
	try {
		outputFields = JSON.parse(String(formData.get("outputFields") ?? "[]"))
	} catch {
		outputFields = null
	}
	return researchTypeSchema.safeParse({
		name: formData.get("name") ?? "",
		prompt: formData.get("prompt") ?? "",
		modelId: formData.get("modelId") ?? undefined,
		webSearchEnabled: formData.get("webSearchEnabled") === "true",
		kind: formData.get("kind") ?? undefined,
		outputFields,
	})
}

export async function createResearchType(_prev: ResearchTypeResult | null, formData: FormData): Promise<ResearchTypeResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = parseForm(formData)
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.researchType.create({
			data: {
				organizationId: orgId,
				createdById: userId,
				name: parsed.data.name,
				prompt: parsed.data.prompt,
				modelId: parsed.data.modelId,
				webSearchEnabled: parsed.data.webSearchEnabled,
				kind: parsed.data.kind,
				outputFields: parsed.data.outputFields,
			},
		})
	} catch {
		return {ok: false, error: "Typ researchu o tej nazwie już istnieje"}
	}
	revalidatePath("/badania")
	return {ok: true}
}

export async function updateResearchType(id: string, _prev: ResearchTypeResult | null, formData: FormData): Promise<ResearchTypeResult> {
	const {orgId} = await requireOrg()
	const parsed = parseForm(formData)
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.researchType.updateMany({
			where: {id, organizationId: orgId},
			data: {
				name: parsed.data.name,
				prompt: parsed.data.prompt,
				modelId: parsed.data.modelId,
				webSearchEnabled: parsed.data.webSearchEnabled,
				kind: parsed.data.kind,
				outputFields: parsed.data.outputFields,
			},
		})
	} catch {
		return {ok: false, error: "Typ researchu o tej nazwie już istnieje"}
	}
	revalidatePath("/badania")
	return {ok: true}
}

export async function deleteResearchType(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.researchType.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/badania")
}
