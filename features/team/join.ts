import type {Role} from "@/generated/prisma/client"

export interface JoinInput {
	hasMembership: boolean
	invitation: {organizationId: string; role: Role} | null
	isOwnerEmail: boolean
}

export type JoinDecision =
	| {kind: "existing"}
	| {kind: "consume"; organizationId: string; role: Role}
	| {kind: "bootstrap"}
	| {kind: "reject"}

// Sign-in resolution order: existing membership > pending invitation > OWNER_EMAIL bootstrap > reject.
export function resolveJoin({hasMembership, invitation, isOwnerEmail}: JoinInput): JoinDecision {
	if (hasMembership) return {kind: "existing"}
	if (invitation) return {kind: "consume", organizationId: invitation.organizationId, role: invitation.role}
	if (isOwnerEmail) return {kind: "bootstrap"}
	return {kind: "reject"}
}
