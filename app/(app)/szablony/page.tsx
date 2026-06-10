// app/(app)/szablony/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteTemplate} from "@/features/templates/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {resolveSenderName} from "@/features/templates/sender"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {EmptyState} from "@/components/ui/empty-state"
import {PageHeader} from "@/components/ui/page-header"
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
			<PageHeader
				title="Szablony"
				description="Treści maili z placeholderami i podglądem."
				meta={`${templates.length} szablonów`}
				action={<a className="text-sm text-accent hover:underline" href="#edytor">Nowy szablon</a>}
			/>
			<div id="edytor">
				<TemplateEditor
					offeringLines={offeringLines}
					customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
					customKeys={placeholders.map((p) => p.key)}
					sampleLead={sampleLead}
					senderName={senderName}
					signatureSet={senderSignature.trim() !== ""}
					previewMailboxName={previewMailboxName}
				/>
			</div>

			<div>
				<h2 className="mb-2 text-sm font-semibold text-fg">Biblioteka ({templates.length})</h2>
				{templates.length === 0 ? (
					<EmptyState title="Brak szablonów" description="Utwórz pierwszy szablon powyżej." />
				) : (
					<div className="flex flex-col gap-2">
						{templates.map((t) => {
							const metaParts: string[] = []
							if (t.subject) metaParts.push(t.subject)
							if (t.offeringLine) metaParts.push(t.offeringLine.name)
							const metaLine = metaParts.join(" · ")
							return (
								<Card key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:border-border-strong">
									<div className="min-w-0">
										<div className="flex items-center gap-2 text-sm font-semibold text-fg">
											<span className="truncate">{t.name}</span>
											{t.isFollowup ? <Badge variant="info">Follow-up</Badge> : null}
										</div>
										{metaLine ? <p className="mt-0.5 text-[12px] text-fg-faint">{metaLine}</p> : null}
									</div>
									<div className="flex-none">
										{t._count.sequenceSteps > 0 ? (
											<span className="text-xs text-fg-faint">w sekwencji</span>
										) : (
											<ConfirmButton action={deleteTemplate.bind(null, t.id)} confirm={{title: "Usunąć szablon?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto szablon">Usuń</ConfirmButton>
										)}
									</div>
								</Card>
							)
						})}
					</div>
				)}
			</div>
		</section>
	)
}
