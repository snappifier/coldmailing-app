// features/research/batch-queries.ts
import {prisma} from "@/lib/prisma"

export function listResearchBatches(orgId: string) {
	return prisma.researchBatch.findMany({
		where: {organizationId: orgId},
		orderBy: {createdAt: "desc"},
		take: 25,
		select: {id: true, researchTypeName: true, mode: true, status: true, total: true, createdAt: true},
	})
}
