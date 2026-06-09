"use server"
// features/org/settings.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import type {OptOutMode, OptOutDetector} from "@/generated/prisma/client"
import {sanitizeSignature} from "@/features/templates/sender"

const MODES = ["OFF", "SUGGEST", "AUTO"]
const DETECTORS = ["KEYWORD", "LLM"]

export async function getOrgSettings() {
	const {orgId} = await requireOrg()
	const org = await prisma.organization.findUnique({where: {id: orgId}, select: {optOutMode: true, optOutDetector: true, senderSignature: true}})
	return {optOutMode: org?.optOutMode ?? "OFF", optOutDetector: org?.optOutDetector ?? "KEYWORD", senderSignature: org?.senderSignature ?? ""}
}

export async function setOrgInboundSettings(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireOrg()
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
	const {orgId} = await requireOrg()
	const senderSignature = sanitizeSignature(String(formData.get("senderSignature") ?? ""))
	await prisma.organization.update({where: {id: orgId}, data: {senderSignature}})
	revalidatePath("/ustawienia")
	return {ok: true}
}
