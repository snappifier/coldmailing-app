// features/research-types/queries.ts
import {prisma} from "@/lib/prisma"

export function listResearchTypes(orgId: string) {
	return prisma.researchType.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}})
}

export function getResearchType(orgId: string, id: string) {
	return prisma.researchType.findFirst({where: {id, organizationId: orgId}})
}
