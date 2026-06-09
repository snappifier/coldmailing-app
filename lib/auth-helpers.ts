// lib/auth-helpers.ts
import {prisma} from "@/lib/prisma"
import {resolveJoin} from "@/features/team/join"

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function isOwnerEmail(normalized: string): boolean {
	return !!process.env.OWNER_EMAIL && normalized === process.env.OWNER_EMAIL.trim().toLowerCase()
}

// Sign-in is allowed for existing members, invited e-mails, and the OWNER_EMAIL bootstrap.
// (ALLOWED_EMAILS is retired - membership is managed in-app via invitations.)
export async function isSignInAllowed(email: string | null | undefined): Promise<boolean> {
	if (!email) return false
	const normalized = normalizeEmail(email)
	const user = await prisma.user.findFirst({
		where: {email: {equals: normalized, mode: "insensitive"}},
		select: {memberships: {select: {id: true}, take: 1}},
	})
	if (user && user.memberships.length > 0) return true
	const invitation = await prisma.invitation.findFirst({where: {email: normalized}, select: {id: true}})
	if (invitation) return true
	return isOwnerEmail(normalized)
}

// Returns the user's membership, creating it on first sign-in: a pending invitation is consumed
// (membership gets the invited role, the invitation row is deleted), or OWNER_EMAIL bootstraps
// the org + an OWNER membership. Decision logic is pure (features/team/join.ts).
export async function ensureMembership(userId: string, email: string) {
	const normalized = normalizeEmail(email)
	const existing = await prisma.membership.findFirst({where: {userId}})
	const invitation = existing ? null : await prisma.invitation.findFirst({where: {email: normalized}})
	const decision = resolveJoin({
		hasMembership: !!existing,
		invitation: invitation ? {organizationId: invitation.organizationId, role: invitation.role} : null,
		isOwnerEmail: isOwnerEmail(normalized),
	})

	if (decision.kind === "existing") return existing!
	if (decision.kind === "consume") {
		const [membership] = await prisma.$transaction([
			prisma.membership.create({data: {userId, organizationId: decision.organizationId, role: decision.role}}),
			prisma.invitation.delete({where: {id: invitation!.id}}),
		])
		return membership
	}
	if (decision.kind === "bootstrap") {
		const org =
			(await prisma.organization.findFirst({orderBy: {createdAt: "asc"}})) ??
			(await prisma.organization.create({data: {name: "Moja agencja"}}))
		return prisma.membership.upsert({
			where: {userId_organizationId: {userId, organizationId: org.id}},
			update: {},
			create: {userId, organizationId: org.id, role: "OWNER"},
		})
	}
	throw new Error("Sign-in not allowed: no membership or invitation")
}
