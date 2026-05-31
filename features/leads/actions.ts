"use server"
// features/leads/actions.ts

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {parseTable, mapRowsToLeads, type ColumnMapping} from "@/features/leads/import"
import {partitionLeads} from "@/features/leads/dedupe"

export type LeadActionResult = {ok: true} | {ok: false; error: string}

export type ImportResult =
	| {ok: true; created: number; duplicateCount: number; suppressedCount: number; withoutEmail: number}
	| {ok: false; error: string}

const leadFormSchema = z.object({
	organizationName: z.string().trim().min(1, "Podaj nazwę placówki"),
	email: z.string().trim().toLowerCase().pipe(z.email("Błędny email")).optional().or(z.literal("")).transform((v) => (v ? v : null)),
	website: z.string().trim().optional().transform((v) => (v ? v : null)),
	contactPersonName: z.string().trim().optional().transform((v) => (v ? v : null)),
	contactRole: z.string().trim().optional().transform((v) => (v ? v : null)),
	city: z.string().trim().optional().transform((v) => (v ? v : null)),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
})

export async function createLead(_prev: LeadActionResult | null, formData: FormData): Promise<LeadActionResult> {
	const {orgId} = await requireOrg()
	const parsed = leadFormSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.lead.create({data: {organizationId: orgId, ...parsed.data}})
	} catch {
		return {ok: false, error: "Lead z tym emailem już istnieje"}
	}
	revalidatePath("/leady")
	return {ok: true}
}

export async function deleteLead(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.lead.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/leady")
}

export async function updateLead(_prev: LeadActionResult | null, formData: FormData): Promise<LeadActionResult> {
	const {orgId} = await requireOrg()
	const id = String(formData.get("id") ?? "")
	if (!id) return {ok: false, error: "Brak id"}

	const honorificRaw = String(formData.get("honorific") ?? "")
	const honorific = honorificRaw === "PAN" || honorificRaw === "PANI" ? honorificRaw : null

	// customFields arrive as repeated cf_key[] / cf_value[] pairs
	const keys = formData.getAll("cf_key").map(String)
	const values = formData.getAll("cf_value").map(String)
	const customFields: Record<string, string> = {}
	keys.forEach((k, i) => {
		const trimmed = k.trim()
		if (trimmed) customFields[trimmed] = values[i] ?? ""
	})

	const parsed = leadFormSchema.safeParse({
		organizationName: formData.get("organizationName"),
		email: formData.get("email"),
		website: formData.get("website"),
		contactPersonName: formData.get("contactPersonName"),
		contactRole: formData.get("contactRole"),
		city: formData.get("city"),
	})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	const data = parsed.data
	try {
		const result = await prisma.lead.updateMany({
			where: {id, organizationId: orgId},
			data: {
				organizationName: data.organizationName,
				email: data.email,
				website: data.website,
				contactPersonName: data.contactPersonName,
				contactRole: data.contactRole,
				city: data.city,
				honorific,
				customFields,
			},
		})
		if (result.count === 0) return {ok: false, error: "Nie znaleziono leada"}
	} catch {
		return {ok: false, error: "Lead z tym emailem już istnieje"}
	}

	revalidatePath("/leady")
	revalidatePath(`/leady/${id}`)
	return {ok: true}
}

export async function importLeads(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
	const {orgId} = await requireOrg()

	const text = String(formData.get("text") ?? "")
	const hasHeader = formData.get("hasHeader") === "on"
	const offeringLineId = String(formData.get("offeringLineId") ?? "") || null
	if (!text.trim()) return {ok: false, error: "Wklej dane do importu"}

	// Column mapping arrives as mapping_<field>=<columnIndex> ("" = unmapped)
	const fields = [
		"organizationName",
		"website",
		"contactPersonName",
		"contactRole",
		"email",
		"phone",
		"city",
		"region",
		"schoolType",
		"honorific",
	] as const
	const mapping: ColumnMapping = {}
	for (const field of fields) {
		const raw = formData.get(`mapping_${field}`)
		if (raw !== null && raw !== "") mapping[field] = Number(raw)
	}
	if (mapping.organizationName === undefined) {
		return {ok: false, error: "Zmapuj kolumnę z nazwą placówki"}
	}

	const rows = parseTable(text)
	const leads = mapRowsToLeads(rows, mapping, {hasHeader})
	if (leads.length === 0) return {ok: false, error: "Brak wierszy z nazwą placówki"}

	const emails = leads.map((l) => l.email).filter((e): e is string => !!e)
	const [existing, suppressed] = await Promise.all([
		prisma.lead.findMany({where: {organizationId: orgId, email: {in: emails}}, select: {email: true}}),
		prisma.suppression.findMany({where: {organizationId: orgId, email: {in: emails}}, select: {email: true}}),
	])
	const {toInsert, duplicateCount, suppressedCount} = partitionLeads(leads, {
		existingEmails: new Set(existing.map((e) => e.email!).filter(Boolean)),
		suppressedEmails: new Set(suppressed.map((s) => s.email)),
	})

	if (toInsert.length > 0) {
		await prisma.lead.createMany({
			data: toInsert.map((l) => ({...l, organizationId: orgId, offeringLineId})),
		})
	}

	const withoutEmail = toInsert.filter((l) => !l.email).length

	revalidatePath("/leady")
	return {ok: true, created: toInsert.length, duplicateCount, suppressedCount, withoutEmail}
}
