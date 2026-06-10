"use server"
// features/templates/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {templateSchema, templateUpdateSchema} from "@/features/templates/schema"

export type TemplateResult = {ok: true; id: string} | {ok: false; error: string}

export async function createTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = templateSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		const created = await prisma.template.create({
			data: {organizationId: orgId, createdById: userId, ...parsed.data},
			select: {id: true},
		})
		revalidatePath("/szablony")
		return {ok: true, id: created.id}
	} catch {
		return {ok: false, error: "Szablon o tej nazwie już istnieje"}
	}
}

export async function deleteTemplate(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	try {
		await prisma.template.deleteMany({where: {id, organizationId: orgId}})
	} catch {
		// Template is referenced by a sequence step (FK restrict) - leave it; the UI hides delete for in-use templates.
	}
	revalidatePath("/szablony")
}

export async function updateTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
	const {orgId} = await requireOrg()
	const parsed = templateUpdateSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		// Explicit field list: visibility/folder are not in the form and must keep their stored values.
		const res = await prisma.template.updateMany({
			where: {id: parsed.data.templateId, organizationId: orgId},
			data: {
				name: parsed.data.name,
				subject: parsed.data.subject,
				body: parsed.data.body,
				isFollowup: parsed.data.isFollowup,
				offeringLineId: parsed.data.offeringLineId,
			},
		})
		if (res.count === 0) return {ok: false, error: "Nie znaleziono szablonu"}
		revalidatePath("/szablony")
		return {ok: true, id: parsed.data.templateId}
	} catch {
		return {ok: false, error: "Nie udało się zapisać zmian"}
	}
}
