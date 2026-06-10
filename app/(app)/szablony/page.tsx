// app/(app)/szablony/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {resolveSenderName} from "@/features/templates/sender"
import {TemplatesShell} from "./templates-shell"
import type {RenderLead} from "@/features/templates/render"

export default async function TemplatesPage() {
	const {orgId} = await requireOrg()

	const [templates, offeringLines, placeholders, lead, org, mailbox] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}, include: {offeringLine: {select: {name: true}}, _count: {select: {sequenceSteps: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}}),
		prisma.lead.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}, take: 1}),
		prisma.organization.findUnique({where: {id: orgId}, select: {senderSignature: true}}),
		prisma.emailAccount.findFirst({where: {organizationId: orgId, status: "CONNECTED"}, orderBy: {createdAt: "asc"}, select: {displayName: true}}),
	])

	const senderSignature = org?.senderSignature ?? ""
	const previewMailboxName = mailbox?.displayName ?? null
	const senderName = resolveSenderName({signature: senderSignature, fallback: previewMailboxName})

	const sampleLead: RenderLead | null = lead[0]
		? {
				organizationName: lead[0].organizationName,
				contactPersonName: lead[0].contactPersonName,
				city: lead[0].city,
				website: lead[0].website,
				aiHook: lead[0].aiHook,
				honorific: lead[0].honorific,
				customFields: (lead[0].customFields as Record<string, unknown> | null) ?? null,
			}
		: null

	return (
		<TemplatesShell
			templates={templates.map((t) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				body: t.body,
				isFollowup: t.isFollowup,
				offeringLineId: t.offeringLineId,
				offeringLineName: t.offeringLine?.name ?? null,
				inUse: t._count.sequenceSteps > 0,
			}))}
			offeringLines={offeringLines}
			customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
			customKeys={placeholders.map((p) => p.key)}
			sampleLead={sampleLead}
			senderName={senderName}
			signatureSet={senderSignature.trim() !== ""}
			previewMailboxName={previewMailboxName}
		/>
	)
}
