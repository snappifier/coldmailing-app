// features/email-accounts/queries.ts
import {prisma} from "@/lib/prisma"

export async function listEmailAccounts(orgId: string) {
	return prisma.emailAccount.findMany({
		where: {organizationId: orgId},
		select: {id: true, email: true, displayName: true, status: true, dailyLimit: true, sendWindowStartMin: true, sendWindowEndMin: true, sendDays: true, minGapSec: true, maxGapSec: true, timezone: true, scope: true, createdAt: true},
		orderBy: {createdAt: "desc"},
	})
}
