// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {LeadEditForm} from "./lead-edit-form"

export default async function LeadEditPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const lead = await prisma.lead.findFirst({where: {id, organizationId: orgId}})
	if (!lead) notFound()

	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	const customFields = Object.entries(cf).map(([key, value]) => ({key, value: String(value ?? "")}))

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-blue-600" href="/leady">
				← Leady
			</Link>
			<h1 className="text-lg font-semibold">Edycja: {lead.organizationName}</h1>
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
		</section>
	)
}
