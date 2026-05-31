"use server"
// features/email-accounts/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"

export async function disconnectEmailAccount(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.emailAccount.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/skrzynki")
}
