// app/(app)/placeholdery/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deletePlaceholder} from "@/features/placeholders/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {PlaceholderForm} from "./placeholder-form"

export default async function PlaceholdersPage() {
	const {orgId} = await requireOrg()
	const placeholders = await prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Placeholdery</h1>
			<p className="text-sm text-fg-muted">
				Wbudowane (zawsze dostępne): nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy. Poniżej dodajesz własne.
			</p>
			<PlaceholderForm />
			<ul className="divide-y divide-border border-y border-border">
				{placeholders.map((p) => (
					<li className="flex items-center justify-between py-2 text-sm" key={p.id}>
						<span>
							<code>{`{{${p.key}}}`}</code> — {p.label} <span className="text-fg-faint">({p.type})</span>
						</span>
						<ConfirmButton action={deletePlaceholder.bind(null, p.id)} confirm={{title: "Usunąć placeholder?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto placeholder">Usuń</ConfirmButton>
					</li>
				))}
				{placeholders.length === 0 ? <li className="py-2 text-sm text-fg-muted">Brak własnych placeholderów.</li> : null}
			</ul>
		</section>
	)
}
