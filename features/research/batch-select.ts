// features/research/batch-select.ts
import type {Prisma} from "@/generated/prisma/client"

export interface BatchCriteria {
	offeringLineId?: string
	q?: string
}

export function buildLeadWhere(orgId: string, criteria: BatchCriteria): Prisma.LeadWhereInput {
	const where: Prisma.LeadWhereInput = {organizationId: orgId}
	if (criteria.offeringLineId) where.offeringLineId = criteria.offeringLineId
	if (criteria.q) {
		where.OR = [
			{organizationName: {contains: criteria.q, mode: "insensitive"}},
			{email: {contains: criteria.q, mode: "insensitive"}},
			{contactPersonName: {contains: criteria.q, mode: "insensitive"}},
		]
	}
	return where
}
