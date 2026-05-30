// features/leads/import.ts
import type {Honorific} from "@/generated/prisma/client"

export type LeadFieldKey =
	| "organizationName"
	| "website"
	| "contactPersonName"
	| "contactRole"
	| "email"
	| "phone"
	| "city"
	| "region"
	| "schoolType"
	| "honorific"

export type ColumnMapping = Partial<Record<LeadFieldKey, number>>

export interface LeadImportInput {
	organizationName: string
	website: string | null
	contactPersonName: string | null
	contactRole: string | null
	email: string | null
	phone: string | null
	city: string | null
	region: string | null
	schoolType: string | null
	honorific: Honorific | null
}

export function detectDelimiter(text: string): string {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
	if (firstLine.includes("\t")) return "\t"
	if (firstLine.includes(";")) return ";"
	return ","
}

export function splitRow(line: string, delimiter: string): string[] {
	const cells: string[] = []
	let current = ""
	let inQuotes = false
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"'
				i++
			} else {
				inQuotes = !inQuotes
			}
		} else if (ch === delimiter && !inQuotes) {
			cells.push(current)
			current = ""
		} else {
			current += ch
		}
	}
	cells.push(current)
	return cells.map((c) => c.trim())
}

export function parseTable(text: string): string[][] {
	const delimiter = detectDelimiter(text)
	return text
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0)
		.map((line) => splitRow(line, delimiter))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string): string | null {
	const v = value.trim().toLowerCase()
	if (!v || !EMAIL_RE.test(v)) return null
	return v
}

export function normalizeWebsite(value: string): string | null {
	let v = value.trim()
	if (!v) return null
	if (!/^https?:\/\//i.test(v)) v = `https://${v}`
	return v.replace(/\/+$/, "")
}

export function parseHonorific(value: string): Honorific | null {
	const v = value.trim().toLowerCase()
	if (v === "pan") return "PAN"
	if (v === "pani") return "PANI"
	return null
}

function cell(row: string[], index: number | undefined): string {
	if (index === undefined) return ""
	return row[index]?.trim() ?? ""
}

export function mapRowsToLeads(
	rows: string[][],
	mapping: ColumnMapping,
	opts: {hasHeader: boolean},
): LeadImportInput[] {
	const dataRows = opts.hasHeader ? rows.slice(1) : rows
	const leads: LeadImportInput[] = []
	for (const row of dataRows) {
		const organizationName = cell(row, mapping.organizationName)
		if (!organizationName) continue
		leads.push({
			organizationName,
			website: normalizeWebsite(cell(row, mapping.website)),
			contactPersonName: cell(row, mapping.contactPersonName) || null,
			contactRole: cell(row, mapping.contactRole) || null,
			email: normalizeEmail(cell(row, mapping.email)),
			phone: cell(row, mapping.phone) || null,
			city: cell(row, mapping.city) || null,
			region: cell(row, mapping.region) || null,
			schoolType: cell(row, mapping.schoolType) || null,
			honorific: parseHonorific(cell(row, mapping.honorific)),
		})
	}
	return leads
}
