// app/(app)/suppression/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {removeSuppression} from "@/features/suppression/actions"
import {SuppressionForm} from "./suppression-form"

export default async function SuppressionPage() {
	const {orgId} = await requireOrg()
	const entries = await prisma.suppression.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Suppression ({entries.length})</h1>
			<p className="text-sm text-zinc-600">Adresy z tej listy są pomijane przy imporcie i (później) przy wysyłce.</p>
			<SuppressionForm />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{entries.map((e) => (
					<li className="flex items-center justify-between py-2 text-sm" key={e.id}>
						<span>
							{e.email} <span className="text-zinc-400">({e.reason})</span>
						</span>
						<form action={removeSuppression.bind(null, e.id)}>
							<button className="text-blue-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{entries.length === 0 ? <li className="py-2 text-sm text-zinc-500">Lista pusta.</li> : null}
			</ul>
		</section>
	)
}
