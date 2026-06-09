// features/team/roles.ts
import type {Role} from "@/generated/prisma/client"

export const ROLE_ORDER: Record<Role, number> = {MEMBER: 0, ADMIN: 1, OWNER: 2}

export function hasRole(actual: Role, min: Role): boolean {
	return ROLE_ORDER[actual] >= ROLE_ORDER[min]
}
