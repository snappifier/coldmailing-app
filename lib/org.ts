import {auth} from "@/lib/auth"
import {prisma} from "@/lib/prisma"
import {hasRole} from "@/features/team/roles"
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

// Re-reads the role from the DB so role changes/removal apply immediately (the session JWT
// only refreshes at sign-in and is used for UI politeness, never for enforcement).
export async function currentRole(ctx: OrgContext): Promise<Role> {
	const membership = await prisma.membership.findUnique({
		where: {userId_organizationId: {userId: ctx.userId, organizationId: ctx.orgId}},
		select: {role: true},
	})
	if (!membership) throw new Error("Unauthorized")
	return membership.role
}

export async function requireRole(min: Role): Promise<OrgContext> {
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, min)) throw new Error("Forbidden")
	return {...ctx, role}
}
