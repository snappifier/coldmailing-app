// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getLeadTimeline} from "@/features/pipeline/queries"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {listResearchTypes} from "@/features/research-types/queries"
import {Badge} from "@/components/ui/badge"
import {Card, CardBody} from "@/components/ui/card"
import {LeadEditForm} from "./lead-edit-form"
import {LeadTimeline} from "./timeline"
import {ActivityForm} from "./activity-form"
import {UruchomResearch} from "./uruchom-research"
import {DraftPanel} from "./draft-panel"
import {getDraft} from "@/features/research/draft-actions"

export default async function LeadEditPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const lead = await prisma.lead.findFirst({where: {id, organizationId: orgId}})
	if (!lead) notFound()

	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	const customFields = Object.entries(cf).map(([key, value]) => ({key, value: String(value ?? "")}))
	const timeline = await getLeadTimeline(orgId, id)
	const researchTypes = await listResearchTypes(orgId)
	const draft = await getDraft(id)
	const draftTypes = researchTypes.filter((t) => t.kind === "DRAFT")
	const pickTypes = researchTypes.filter((t) => t.kind !== "DRAFT")

	const quickFacts = [lead.email, lead.website, lead.city].filter(Boolean).join(" · ")

	return (
		<section className="flex flex-col gap-6">
			<div className="border-b border-border pb-4">
				<Link className="text-sm text-accent" href="/leady">
					← Leady
				</Link>
				<div className="mt-2 flex items-center gap-3">
					<h1 className="text-[17px] font-semibold tracking-[-0.02em]">{lead.organizationName}</h1>
					<Badge>{STAGE_LABEL[lead.dealStage]}</Badge>
					<Badge>ocena {lead.score ?? "—"} / prio {lead.priority ?? "—"}</Badge>
				</div>
				{quickFacts ? <p className="mt-1 text-[11px] text-fg-faint">{quickFacts}</p> : null}
			</div>

			<div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
				<div className="flex flex-col gap-6">
					<div>
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Dane</div>
						<Card>
							<CardBody>
								<LeadEditForm
									lead={{
										id: lead.id,
										organizationName: lead.organizationName,
										email: lead.email,
										website: lead.website,
										contactPersonName: lead.contactPersonName,
										contactRole: lead.contactRole,
										city: lead.city,
										honorific: lead.honorific,
										score: lead.score,
										priority: lead.priority,
										siteQuality: lead.siteQuality,
										aiHook: lead.aiHook,
										aiNotes: lead.aiNotes,
									}}
									customFields={customFields}
								/>
							</CardBody>
						</Card>
					</div>

					<div>
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Oś czasu</div>
						<div className="flex flex-col gap-3">
							<ActivityForm leadId={lead.id} />
							<LeadTimeline items={timeline} />
						</div>
					</div>
				</div>

				<div className="flex flex-col gap-6">
					<div>
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Badania AI</div>
						<UruchomResearch leadId={lead.id} types={pickTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} />
					</div>

					<div>
						<div className="mb-2 text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Draft maila</div>
						<DraftPanel leadId={lead.id} types={draftTypes.map((t) => ({id: t.id, name: t.name}))} initial={draft ? {status: draft.status, subject: draft.subject, body: draft.body, error: draft.error} : null} />
					</div>
				</div>
			</div>
		</section>
	)
}
