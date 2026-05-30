// lib/org.ts
import {auth} from "@/lib/auth"
import type {Role} from "@/generated/prisma/client"

export interface OrgContext {
	userId: string
	orgId: string
	role: Role
}

export async function requireOrg(): Promise<OrgContext> {
	const session = await auth()
	if (!session?.user?.id || !session.user.orgId) {
		throw new Error("Unauthorized")
	}
	return {
		userId: session.user.id,
		orgId: session.user.orgId,
		role: session.user.role,
	}
}
