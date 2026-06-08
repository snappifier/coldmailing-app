// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getLeadTimeline} from "@/features/pipeline/queries"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {LeadEditForm} from "./lead-edit-form"
import {LeadTimeline} from "./timeline"
import {ActivityForm} from "./activity-form"

export default async function LeadEditPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const lead = await prisma.lead.findFirst({where: {id, organizationId: orgId}})
	if (!lead) notFound()

	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	const customFields = Object.entries(cf).map(([key, value]) => ({key, value: String(value ?? "")}))
	const timeline = await getLeadTimeline(orgId, id)

	return (
		<section className="flex flex-col gap-6">
			<Link className="text-sm text-blue-600" href="/leady">
				← Leady
			</Link>
			<div className="flex items-center gap-3">
				<h1 className="text-lg font-semibold">{lead.organizationName}</h1>
				<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Etap: {STAGE_LABEL[lead.dealStage]}</span>
			</div>

			<div className="grid gap-8 md:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-zinc-500">Dane</h2>
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
						}}
						customFields={customFields}
					/>
				</div>
				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-zinc-500">Oś czasu</h2>
					<ActivityForm leadId={lead.id} />
					<LeadTimeline items={timeline} />
				</div>
			</div>
		</section>
	)
}
