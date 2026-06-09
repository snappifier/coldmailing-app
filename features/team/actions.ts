"use server"
// features/team/actions.ts

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireRole} from "@/lib/org"
import {canChangeRole, canRemoveMember} from "@/features/team/guards"
import type {Role} from "@/generated/prisma/client"

export type TeamActionResult = {ok: true} | {ok: false; error: string}

const inviteSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Błędny e-mail")),
	role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
})

export async function inviteMember(_prev: TeamActionResult | null, formData: FormData): Promise<TeamActionResult> {
	const {orgId, userId} = await requireRole("OWNER")
	const parsed = inviteSchema.safeParse({email: formData.get("email"), role: formData.get("role")})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	const {email, role} = parsed.data

	const member = await prisma.membership.findFirst({
		where: {organizationId: orgId, user: {email: {equals: email, mode: "insensitive"}}},
		select: {id: true},
	})
	if (member) return {ok: false, error: "Ta osoba jest już członkiem zespołu"}

	try {
		await prisma.invitation.create({data: {organizationId: orgId, email, role, invitedById: userId}})
	} catch {
		return {ok: false, error: "Ten e-mail jest już zaproszony"}
	}
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function cancelInvitation(id: string): Promise<void> {
	const {orgId} = await requireRole("OWNER")
	await prisma.invitation.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/ustawienia")
}

const ROLES: Role[] = ["MEMBER", "ADMIN", "OWNER"]

export async function changeMemberRole(membershipId: string, formData: FormData): Promise<TeamActionResult> {
	const {orgId} = await requireRole("OWNER")
	const role = String(formData.get("role")) as Role
	if (!ROLES.includes(role)) return {ok: false, error: "Błędna rola"}
	const members = await prisma.membership.findMany({where: {organizationId: orgId}, select: {id: true, role: true}})
	const lite = members.map((m) => ({membershipId: m.id, role: m.role}))
	if (!canChangeRole(lite, membershipId, role)) return {ok: false, error: "Nie można odebrać roli ostatniemu właścicielowi"}
	await prisma.membership.updateMany({where: {id: membershipId, organizationId: orgId}, data: {role}})
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function removeMember(membershipId: string): Promise<void> {
	const {orgId} = await requireRole("OWNER")
	const members = await prisma.membership.findMany({where: {organizationId: orgId}, select: {id: true, role: true}})
	const lite = members.map((m) => ({membershipId: m.id, role: m.role}))
	if (!canRemoveMember(lite, membershipId)) return
	await prisma.membership.deleteMany({where: {id: membershipId, organizationId: orgId}})
	revalidatePath("/ustawienia")
}
