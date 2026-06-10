// app/(app)/leady/import/page.tsx
import Link from "next/link"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {PageHeader} from "@/components/ui/page-header"
import {ImportWizard} from "./import-wizard"

export default async function ImportPage() {
	const {orgId} = await requireOrg()
	const offeringLines = await prisma.offeringLine.findMany({
		where: {organizationId: orgId},
		orderBy: {name: "asc"},
		select: {id: true, name: true},
	})
	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Import leadów"
				description="Wklej dane z arkusza, zmapuj kolumny i zaimportuj."
				action={<Link className="text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/leady">← Leady</Link>}
			/>
			<ImportWizard offeringLines={offeringLines} />
		</section>
	)
}
