// app/(app)/placeholdery/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deletePlaceholder} from "@/features/placeholders/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {EmptyState} from "@/components/ui/empty-state"
import {PageHeader} from "@/components/ui/page-header"
import {PLACEHOLDER_TYPE_LABEL} from "@/features/enums/labels"
import {PlaceholderCreateButton} from "./placeholder-create-button"

export default async function PlaceholdersPage() {
	const {orgId} = await requireOrg()
	const placeholders = await prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}})

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Placeholdery"
				description="Własne pola podstawiane w szablonach."
				meta={`${placeholders.length} placeholderów`}
				action={<PlaceholderCreateButton />}
			/>
			<p className="text-sm text-fg-muted">
				Wbudowane (zawsze dostępne): nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy. Poniżej dodajesz własne.
			</p>
			{placeholders.length === 0 ? (
				<EmptyState title="Brak własnych placeholderów" description="Dodaj pierwszy placeholder." action={<PlaceholderCreateButton variant="secondary" />} />
			) : (
				<div className="flex flex-col gap-2">
					{placeholders.map((p) => {
						const metaParts: string[] = []
						if (p.fallback) metaParts.push(`fallback: ${p.fallback}`)
						if (p.source) metaParts.push(`source: ${p.source}`)
						const metaLine = metaParts.join(" · ")
						return (
							<Card key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-sm font-semibold text-fg">
										<code className="shrink-0">{`{{${p.key}}}`}</code>
										<span className="min-w-0 truncate text-fg-muted">{p.label}</span>
										<Badge className="shrink-0">{PLACEHOLDER_TYPE_LABEL[p.type]}</Badge>
									</div>
									{metaLine ? <p className="mt-0.5 text-[12px] text-fg-faint">{metaLine}</p> : null}
								</div>
								<div className="flex-none">
									<ConfirmButton action={deletePlaceholder.bind(null, p.id)} confirm={{title: "Usunąć placeholder?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto placeholder">Usuń</ConfirmButton>
								</div>
							</Card>
						)
					})}
				</div>
			)}
		</section>
	)
}
