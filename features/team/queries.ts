// features/team/queries.ts
import {prisma} from "@/lib/prisma"
import type {Role} from "@/generated/prisma/client"

export interface TeamMember {
	membershipId: string
	name: string | null
	email: string
	role: Role
	since: Date
}

export interface PendingInvitation {
	id: string
	email: string
	role: Role
	createdAt: Date
}

const ORDER: Record<Role, number> = {OWNER: 0, ADMIN: 1, MEMBER: 2}

export async function listTeam(orgId: string): Promise<{members: TeamMember[]; invitations: PendingInvitation[]}> {
	const [memberships, invitations] = await Promise.all([
		prisma.membership.findMany({
			where: {organizationId: orgId},
			include: {user: {select: {name: true, email: true}}},
			orderBy: {createdAt: "asc"},
		}),
		prisma.invitation.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}}),
	])
	const members = memberships
		.map((m) => ({membershipId: m.id, name: m.user.name, email: m.user.email, role: m.role, since: m.createdAt}))
		.sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.since.getTime() - b.since.getTime())
	return {
		members,
		invitations: invitations.map((i) => ({id: i.id, email: i.email, role: i.role, createdAt: i.createdAt})),
	}
}
