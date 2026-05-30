// features/leads/dedupe.ts
import type {LeadImportInput} from "@/features/leads/import"

export interface PartitionResult {
	toInsert: LeadImportInput[]
	duplicateCount: number
	suppressedCount: number
}

export function partitionLeads(
	leads: LeadImportInput[],
	known: {existingEmails: Set<string>; suppressedEmails: Set<string>},
): PartitionResult {
	const seen = new Set<string>()
	const toInsert: LeadImportInput[] = []
	let duplicateCount = 0
	let suppressedCount = 0

	for (const lead of leads) {
		if (lead.email) {
			if (known.suppressedEmails.has(lead.email)) {
				suppressedCount++
				continue
			}
			if (known.existingEmails.has(lead.email) || seen.has(lead.email)) {
				duplicateCount++
				continue
			}
			seen.add(lead.email)
		}
		toInsert.push(lead)
	}

	return {toInsert, duplicateCount, suppressedCount}
}
