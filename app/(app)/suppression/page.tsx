// app/(app)/suppression/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {removeSuppression} from "@/features/suppression/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {SuppressionForm} from "./suppression-form"

export default async function SuppressionPage() {
	const {orgId} = await requireOrg()
	const entries = await prisma.suppression.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Suppression ({entries.length})</h1>
			<p className="text-sm text-fg-muted">Adresy z tej listy są pomijane przy imporcie i (później) przy wysyłce.</p>
			<SuppressionForm />
			<ul className="divide-y divide-border border-y border-border">
				{entries.map((e) => (
					<li className="flex items-center justify-between py-2 text-sm" key={e.id}>
						<span>
							{e.email} <span className="text-fg-faint">({e.reason})</span>
						</span>
						<ConfirmButton action={removeSuppression.bind(null, e.id)} confirm={{title: "Usunąć z listy wykluczeń?", body: "Adres będzie mógł ponownie otrzymywać wiadomości.", confirmLabel: "Usuń", danger: true}} toast="Usunięto z wykluczeń">Usuń</ConfirmButton>
					</li>
				))}
				{entries.length === 0 ? <li className="py-2 text-sm text-fg-muted">Lista pusta.</li> : null}
			</ul>
		</section>
	)
}
