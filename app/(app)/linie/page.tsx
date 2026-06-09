// app/(app)/linie/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {OfferingLineForm} from "./offering-line-form"
import {deleteOfferingLine} from "@/features/offering-lines/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"

export default async function OfferingLinesPage() {
	const {orgId} = await requireOrg()
	const lines = await prisma.offeringLine.findMany({
		where: {organizationId: orgId},
		orderBy: {createdAt: "asc"},
		include: {_count: {select: {leads: true}}},
	})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Linie usług</h1>
			<OfferingLineForm />
			<ul className="divide-y divide-border border-y border-border">
				{lines.map((line) => (
					<li className="flex items-center justify-between py-2" key={line.id}>
						<span className="text-sm">
							{line.name} <span className="text-fg-faint">({line._count.leads} leadów)</span>
						</span>
						<ConfirmButton action={deleteOfferingLine.bind(null, line.id)} confirm={{title: "Usunąć linię usług?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto linię">Usuń</ConfirmButton>
					</li>
				))}
				{lines.length === 0 ? <li className="py-2 text-sm text-fg-muted">Brak linii usług.</li> : null}
			</ul>
		</section>
	)
}
