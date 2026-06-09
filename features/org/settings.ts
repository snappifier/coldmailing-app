"use server"
// features/org/settings.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg, requireRole} from "@/lib/org"
import type {OptOutMode, OptOutDetector} from "@/generated/prisma/client"
import {sanitizeSignature} from "@/features/templates/sender"

const MODES = ["OFF", "SUGGEST", "AUTO"]
const DETECTORS = ["KEYWORD", "LLM"]

export async function getOrgSettings() {
	const {orgId} = await requireOrg()
	const org = await prisma.organization.findUnique({where: {id: orgId}, select: {name: true, optOutMode: true, optOutDetector: true, senderSignature: true}})
	return {name: org?.name ?? "", optOutMode: org?.optOutMode ?? "OFF", optOutDetector: org?.optOutDetector ?? "KEYWORD", senderSignature: org?.senderSignature ?? ""}
}

export async function setOrgInboundSettings(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireRole("ADMIN")
	const mode = String(formData.get("optOutMode"))
	const detector = String(formData.get("optOutDetector"))
	if (!MODES.includes(mode) || !DETECTORS.includes(detector)) return {ok: false}
	await prisma.organization.update({
		where: {id: orgId},
		data: {optOutMode: mode as OptOutMode, optOutDetector: detector as OptOutDetector},
	})
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function setSenderSignature(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireRole("ADMIN")
	const senderSignature = sanitizeSignature(String(formData.get("senderSignature") ?? ""))
	await prisma.organization.update({where: {id: orgId}, data: {senderSignature}})
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function setOrgName(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireRole("ADMIN")
	const name = String(formData.get("name") ?? "").trim().slice(0, 120)
	if (!name) return {ok: false}
	await prisma.organization.update({where: {id: orgId}, data: {name}})
	revalidatePath("/ustawienia")
	return {ok: true}
}
