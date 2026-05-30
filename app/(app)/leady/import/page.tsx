// app/(app)/leady/import/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
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
			<h1 className="text-lg font-semibold">Import leadów</h1>
			<ImportWizard offeringLines={offeringLines} />
		</section>
	)
}
