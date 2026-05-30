// lib/auth-helpers.ts
import {prisma} from "@/lib/prisma"
import type {Role} from "@/generated/prisma/client"

// Returns the single org's membership for this user, creating the org
// (if none exists) and the membership (if missing). Owner role is granted
// to OWNER_EMAIL, everyone else on the allowlist is a MEMBER.
export async function ensureMembership(userId: string, email: string) {
	const org =
		(await prisma.organization.findFirst({orderBy: {createdAt: "asc"}})) ??
		(await prisma.organization.create({data: {name: "Moja agencja"}}))

	const isOwner =
		!!process.env.OWNER_EMAIL &&
		email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()
	const role: Role = isOwner ? "OWNER" : "MEMBER"

	return prisma.membership.upsert({
		where: {userId_organizationId: {userId, organizationId: org.id}},
		update: {},
		create: {userId, organizationId: org.id, role},
	})
}

export function isEmailAllowed(email: string | null | undefined): boolean {
	if (!email) return false
	const allowed = (process.env.ALLOWED_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
	return allowed.includes(email.toLowerCase())
}
