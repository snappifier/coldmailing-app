import type {OutputField} from "@/features/research-types/schema"
import type {AppliedField, ProposedField, ResearchDiff, SkippedField} from "@/features/research/types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COLUMN_TARGETS = new Set(["contactPersonName", "contactRole", "honorific", "aiHook", "aiNotes", "siteQuality", "priority", "score", "city", "region", "schoolType", "email"])

interface LeadFields {
	contactPersonName: string | null
	contactRole: string | null
	email: string | null
	city: string | null
	region: string | null
	schoolType: string | null
	honorific: string | null
	siteQuality: number | null
	priority: number | null
	score: number | null
	aiHook: string | null
	aiNotes: string | null
	customFields: unknown
}

interface ApplyArgs {
	lead: LeadFields
	fields: OutputField[]
	findings: Record<string, unknown>
	mode: "AUTO" | "MANUAL"
	emailTaken: boolean
}

export function computeApply({lead, fields, findings, mode, emailTaken}: ApplyArgs): ResearchDiff {
	const applied: AppliedField[] = []
	const proposed: ProposedField[] = []
	const skipped: SkippedField[] = []

	for (const field of fields) {
		const raw = findings[field.key]
		const coerced = coerce(field, raw)
		if ("skip" in coerced) {
			if (raw !== undefined && raw !== null && raw !== "") skipped.push({key: field.key, label: field.label, reason: coerced.skip})
			else if (field.required) skipped.push({key: field.key, label: field.label, reason: "brak wymaganej wartości"})
			continue
		}
		if (field.target === "email" && emailTaken) {
			skipped.push({key: field.key, label: field.label, reason: "email zajęty przez innego leada"})
			continue
		}
		const current = currentFor(lead, field)
		if (sameValue(current, coerced.value)) {
			skipped.push({key: field.key, label: field.label, reason: "bez zmian"})
			continue
		}
		const entry: AppliedField = {key: field.key, target: field.target, label: field.label, value: coerced.value}
		if (mode === "AUTO" && current === null) applied.push(entry)
		else proposed.push({...entry, current})
	}

	return {applied, proposed, skipped}
}

export function toLeadUpdate(applied: AppliedField[], existingCustom: Record<string, string>): {data: Record<string, unknown>; customFields: Record<string, string>} {
	const data: Record<string, unknown> = {}
	const customFields: Record<string, string> = {...existingCustom}
	for (const a of applied) {
		if (a.target === "CUSTOM") customFields[a.key] = a.value === null ? "" : String(a.value)
		else if (COLUMN_TARGETS.has(a.target)) data[a.target] = a.value
	}
	return {data, customFields}
}

function coerce(field: OutputField, raw: unknown): {value: string | number} | {skip: string} {
	if (raw === undefined || raw === null || raw === "") return {skip: "brak wartości"}
	if (field.target === "CUSTOM") {
		if (typeof raw === "boolean") return {value: String(raw)}
		const s = String(raw).trim()
		return s ? {value: s} : {skip: "puste"}
	}
	switch (field.target) {
		case "honorific": {
			const g = normalizeGender(raw)
			return g ? {value: g} : {skip: "nierozpoznana płeć"}
		}
		case "score": {
			const n = typeof raw === "number" ? raw : Number(String(raw).trim())
			if (!Number.isFinite(n)) return {skip: "nie liczba"}
			return {value: Math.max(0, Math.min(100, Math.round(n)))}
		}
		case "siteQuality":
		case "priority": {
			const n = typeof raw === "number" ? raw : Number(String(raw).trim())
			if (!Number.isFinite(n)) return {skip: "nie liczba"}
			return {value: Math.max(1, Math.min(5, Math.round(n)))}
		}
		case "email": {
			const e = String(raw).trim().toLowerCase()
			return EMAIL_RE.test(e) ? {value: e} : {skip: "błędny email"}
		}
		default: {
			const s = String(raw).trim()
			return s ? {value: s} : {skip: "puste"}
		}
	}
}

function normalizeGender(raw: unknown): "PAN" | "PANI" | null {
	const s = String(raw).trim().toLowerCase()
	if (["pan", "male", "m", "mężczyzna", "mezczyzna", "man"].includes(s)) return "PAN"
	if (["pani", "female", "f", "k", "kobieta", "woman"].includes(s)) return "PANI"
	return null
}

function currentFor(lead: LeadFields, field: OutputField): string | number | null {
	if (field.target === "CUSTOM") {
		const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
		const v = cf[field.key]
		return v === undefined || v === null || v === "" ? null : String(v)
	}
	const v = (lead as unknown as Record<string, unknown>)[field.target]
	if (v === undefined || v === null || v === "") return null
	return typeof v === "number" ? v : String(v)
}

function sameValue(a: string | number | null, b: string | number | null): boolean {
	return String(a ?? "") === String(b ?? "")
}
