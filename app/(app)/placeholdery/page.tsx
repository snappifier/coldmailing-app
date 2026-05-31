// app/(app)/placeholdery/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deletePlaceholder} from "@/features/placeholders/actions"
import {PlaceholderForm} from "./placeholder-form"

export default async function PlaceholdersPage() {
	const {orgId} = await requireOrg()
	const placeholders = await prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Placeholdery</h1>
			<p className="text-sm text-zinc-600">
				Wbudowane (zawsze dostępne): nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy. Poniżej dodajesz własne.
			</p>
			<PlaceholderForm />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{placeholders.map((p) => (
					<li className="flex items-center justify-between py-2 text-sm" key={p.id}>
						<span>
							<code>{`{{${p.key}}}`}</code> — {p.label} <span className="text-zinc-400">({p.type})</span>
						</span>
						<form action={deletePlaceholder.bind(null, p.id)}>
							<button className="text-red-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{placeholders.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak własnych placeholderów.</li> : null}
			</ul>
		</section>
	)
}
