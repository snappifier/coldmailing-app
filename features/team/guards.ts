import type {Role} from "@/generated/prisma/client"

export interface TeamMemberLite {
	membershipId: string
	role: Role
}

export function ownerCount(members: TeamMemberLite[]): number {
	return members.filter((m) => m.role === "OWNER").length
}

// False when the target does not exist or the change would leave the org with no OWNER.
export function canChangeRole(members: TeamMemberLite[], targetId: string, newRole: Role): boolean {
	const target = members.find((m) => m.membershipId === targetId)
	if (!target) return false
	if (target.role === "OWNER" && newRole !== "OWNER" && ownerCount(members) <= 1) return false
	return true
}

export function canRemoveMember(members: TeamMemberLite[], targetId: string): boolean {
	const target = members.find((m) => m.membershipId === targetId)
	if (!target) return false
	if (target.role === "OWNER" && ownerCount(members) <= 1) return false
	return true
}
