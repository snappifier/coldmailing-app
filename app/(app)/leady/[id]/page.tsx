// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getLeadTimeline} from "@/features/pipeline/queries"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {listResearchTypes} from "@/features/research-types/queries"
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

	return (
		<section className="flex flex-col gap-6">
			<Link className="text-sm text-accent" href="/leady">
				← Leady
			</Link>
			<div className="flex items-center gap-3">
				<h1 className="text-lg font-semibold">{lead.organizationName}</h1>
				<span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">Etap: {STAGE_LABEL[lead.dealStage]}</span>
					<span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">Ocena: {lead.score ?? "—"} / prio {lead.priority ?? "—"}</span>
			</div>

			<div className="grid gap-8 md:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-fg-muted">Dane</h2>
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
				</div>
				<div className="flex flex-col gap-3">
					<UruchomResearch leadId={lead.id} types={pickTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} />
					<DraftPanel leadId={lead.id} types={draftTypes.map((t) => ({id: t.id, name: t.name}))} initial={draft ? {status: draft.status, subject: draft.subject, body: draft.body, error: draft.error} : null} />
					<h2 className="text-sm font-semibold text-fg-muted">Oś czasu</h2>
					<ActivityForm leadId={lead.id} />
					<LeadTimeline items={timeline} />
				</div>
			</div>
		</section>
	)
}
