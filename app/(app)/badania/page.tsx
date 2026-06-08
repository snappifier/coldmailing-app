// app/(app)/badania/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {listResearchTypes} from "@/features/research-types/queries"
import {listResearchBatches} from "@/features/research/batch-queries"
import {deleteResearchType} from "@/features/research-types/actions"

export default async function ResearchTypesPage() {
	const {orgId} = await requireOrg()
	const [types, batches] = await Promise.all([listResearchTypes(orgId), listResearchBatches(orgId)])

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">Badania</h1>
				<Link className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white" href="/badania/nowy">
					Nowy typ
				</Link>
			</div>
			<p className="text-sm text-zinc-600">
				Typy researchu definiują prompt i pola wyjściowe mapowane na pola leada. Silnik (Faza 2b) uruchomi je per lead.
			</p>
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{types.map((t) => {
					const count = Array.isArray(t.outputFields) ? t.outputFields.length : 0
					return (
						<li className="flex items-center justify-between py-2 text-sm" key={t.id}>
							<span>
								<Link className="font-medium underline" href={`/badania/${t.id}`}>
									{t.name}
								</Link>
								{t.kind === "SCORING" ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Ocena</span> : null}
							{t.kind === "CONTENT" ? <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">Treść</span> : null}{" "}
								<span className="text-zinc-400">
									({count} pól{t.webSearchEnabled ? ", web" : ""}
									{t.modelId ? `, ${t.modelId}` : ""})
								</span>
							</span>
							<form action={deleteResearchType.bind(null, t.id)}>
								<button className="text-red-600" type="submit">
									Usuń
								</button>
							</form>
						</li>
					)
				})}
				{types.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak typów researchu.</li> : null}
			</ul>

			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-zinc-500">Ostatnie badania zbiorcze</h2>
				<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
					{batches.map((b) => (
						<li className="flex items-center justify-between py-2 text-sm" key={b.id}>
							<Link className="underline" href={`/badania/batches/${b.id}`}>
								{b.researchTypeName}
							</Link>
							<span className="text-zinc-400">
								{b.total} leadów · {b.mode === "MANUAL" ? "ręczne" : "auto"} · {b.createdAt.toLocaleDateString("pl-PL")}
							</span>
						</li>
					))}
					{batches.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak badań zbiorczych.</li> : null}
				</ul>
			</div>
		</section>
	)
}
