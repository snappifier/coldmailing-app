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
	customFields: Record<string, string> | null
}

export type ColumnTarget =
	| {kind: "ignore"}
	| {kind: "field"; field: LeadFieldKey}
	| {kind: "custom"; key: string}

export interface ImportSpec {
	mapping: ColumnMapping
	customColumns: {index: number; key: string}[]
}

export function buildImportSpec(targets: ColumnTarget[]): ImportSpec {
	const mapping: ColumnMapping = {}
	const customColumns: {index: number; key: string}[] = []
	targets.forEach((target, index) => {
		if (target.kind === "field") {
			mapping[target.field] = index
		} else if (target.kind === "custom") {
			const key = target.key.trim()
			if (key) customColumns.push({index, key})
		}
	})
	return {mapping, customColumns}
}

export function defaultCustomKey(header: string | null, index: number): string {
	const h = header?.trim()
	return h ? h : `kolumna_${index + 1}`
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
	opts: {hasHeader: boolean; customColumns?: {index: number; key: string}[]},
): LeadImportInput[] {
	const dataRows = opts.hasHeader ? rows.slice(1) : rows
	const customColumns = opts.customColumns ?? []
	const leads: LeadImportInput[] = []
	for (const row of dataRows) {
		const organizationName = cell(row, mapping.organizationName)
		if (!organizationName) continue
		const cf: Record<string, string> = {}
		for (const {index, key} of customColumns) {
			const v = cell(row, index)
			if (v) cf[key] = v
		}
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
			customFields: Object.keys(cf).length ? cf : null,
		})
	}
	return leads
}
