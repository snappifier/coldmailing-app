// app/(app)/linie/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteOfferingLine} from "@/features/offering-lines/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {EmptyState} from "@/components/ui/empty-state"
import {PageHeader} from "@/components/ui/page-header"
import {LiniaCreateButton} from "./linia-create-button"

export default async function OfferingLinesPage() {
	const {orgId} = await requireOrg()
	const lines = await prisma.offeringLine.findMany({
		where: {organizationId: orgId},
		orderBy: {createdAt: "asc"},
		include: {_count: {select: {leads: true}}},
	})

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Linie usług"
				description="Oferty, do których przypisujesz leady i kampanie."
				meta={`${lines.length} linii`}
				action={<LiniaCreateButton />}
			/>
			{lines.length === 0 ? (
				<EmptyState title="Brak linii usług" description="Dodaj pierwszą linię usług." action={<LiniaCreateButton variant="secondary" />} />
			) : (
				<div className="flex flex-col gap-2">
					{lines.map((line) => (
						<Card key={line.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
							<div className="min-w-0">
								<div className="flex items-center gap-2 text-sm font-semibold text-fg">
									<span className="truncate">{line.name}</span>
								</div>
								<p className="mt-0.5 text-[12px] text-fg-faint">{[line.description, `${line._count.leads} leadów`].filter(Boolean).join(" · ")}</p>
							</div>
							<div className="flex-none">
								<ConfirmButton action={deleteOfferingLine.bind(null, line.id)} confirm={{title: "Usunąć linię usług?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto linię">Usuń</ConfirmButton>
							</div>
						</Card>
					))}
				</div>
			)}
		</section>
	)
}
