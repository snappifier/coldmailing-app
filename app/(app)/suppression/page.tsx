// app/(app)/suppression/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {removeSuppression} from "@/features/suppression/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {EmptyState} from "@/components/ui/empty-state"
import {PageHeader} from "@/components/ui/page-header"
import {SuppressionCreateButton} from "./suppression-create-button"

export default async function SuppressionPage() {
	const {orgId} = await requireOrg()
	const entries = await prisma.suppression.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}})

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Wykluczenia"
				description="Adresy, do których nigdy nie wysyłamy."
				meta={`${entries.length} wykluczeń`}
				action={<SuppressionCreateButton />}
			/>
			{entries.length === 0 ? (
				<EmptyState title="Brak wykluczeń" description="Żaden adres nie został jeszcze wykluczony." action={<SuppressionCreateButton variant="secondary" />} />
			) : (
				<div className="flex flex-col gap-2">
					{entries.map((e) => (
						<Card key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:border-border-strong">
							<div className="min-w-0">
								<div className="truncate text-sm font-semibold text-fg">{e.email}</div>
								<p className="mt-0.5 text-[12px] text-fg-faint">
									{[e.reason, new Date(e.createdAt).toLocaleDateString("pl-PL")].filter(Boolean).join(" · ")}
								</p>
							</div>
							<div className="flex-none">
								<ConfirmButton action={removeSuppression.bind(null, e.id)} confirm={{title: "Usunąć z listy wykluczeń?", body: "Adres będzie mógł ponownie otrzymywać wiadomości.", confirmLabel: "Usuń", danger: true}} toast="Usunięto z wykluczeń">Usuń</ConfirmButton>
							</div>
						</Card>
					))}
				</div>
			)}
		</section>
	)
}
