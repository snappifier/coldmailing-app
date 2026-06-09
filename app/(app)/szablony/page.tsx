// app/(app)/szablony/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteTemplate} from "@/features/templates/actions"
import {resolveSenderName} from "@/features/templates/sender"
import {TemplateEditor} from "./template-editor"
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
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Szablony</h1>
			<TemplateEditor
				offeringLines={offeringLines}
				customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
				customKeys={placeholders.map((p) => p.key)}
				sampleLead={sampleLead}
				senderName={senderName}
				signatureSet={senderSignature.trim() !== ""}
				previewMailboxName={previewMailboxName}
			/>

			<div>
				<h2 className="mb-2 text-sm font-semibold text-fg">Biblioteka ({templates.length})</h2>
				<ul className="divide-y divide-border border-y border-border">
					{templates.map((t) => (
						<li className="flex items-center justify-between py-2 text-sm" key={t.id}>
							<span>
								{t.name} <span className="text-fg-faint">· {t.subject}</span>
								{t.isFollowup ? <span className="ml-1 text-fg-faint">(follow-up)</span> : null}
								{t.offeringLine ? <span className="ml-1 text-fg-faint">· {t.offeringLine.name}</span> : null}
							</span>
							{t._count.sequenceSteps > 0 ? (
								<span className="text-fg-faint">w sekwencji</span>
							) : (
								<form action={deleteTemplate.bind(null, t.id)}>
									<button className="text-danger" type="submit">
										Usuń
									</button>
								</form>
							)}
						</li>
					))}
					{templates.length === 0 ? <li className="py-2 text-sm text-fg-muted">Brak szablonów.</li> : null}
				</ul>
			</div>
		</section>
	)
}
