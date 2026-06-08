// app/(app)/leady/page.tsx
import Link from "next/link"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteLead} from "@/features/leads/actions"
import {listResearchTypes} from "@/features/research-types/queries"
import {LeadForm} from "./lead-form"
import {BatchResearchLauncher} from "./batch-research-launcher"

export default async function LeadsPage({searchParams}: {searchParams: Promise<{q?: string; line?: string; sort?: string; minScore?: string}>}) {
	const {orgId} = await requireOrg()
	const {q, line, sort, minScore} = await searchParams

	const where: Prisma.LeadWhereInput = {organizationId: orgId}
	if (line) where.offeringLineId = line
	const minScoreNum = minScore ? Number(minScore) : NaN
	if (Number.isFinite(minScoreNum)) where.score = {gte: minScoreNum}
	if (q) {
		where.OR = [
			{organizationName: {contains: q, mode: "insensitive"}},
			{email: {contains: q, mode: "insensitive"}},
			{contactPersonName: {contains: q, mode: "insensitive"}},
		]
	}

	const orderBy: Prisma.LeadOrderByWithRelationInput =
		sort === "priority" ? {priority: "desc"} : sort === "score" ? {score: {sort: "desc", nulls: "last"}} : sort === "name" ? {organizationName: "asc"} : {createdAt: "desc"}

	const [leads, offeringLines, researchTypes] = await Promise.all([
		prisma.lead.findMany({where, orderBy, take: 500, include: {offeringLine: {select: {name: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		listResearchTypes(orgId),
	])

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">Leady ({leads.length})</h1>
				<Link className="text-sm text-blue-600" href="/leady/import">
					Import
				</Link>
			</div>

			<LeadForm offeringLines={offeringLines} />

			<BatchResearchLauncher types={researchTypes.map((t) => ({id: t.id, name: t.name}))} criteria={{offeringLineId: line, q}} />

			<form className="flex flex-wrap gap-2 text-sm">
				<input className="rounded border border-zinc-300 px-2 py-1" name="q" placeholder="Szukaj..." defaultValue={q ?? ""} />
				<input className="w-28 rounded border border-zinc-300 px-2 py-1" name="minScore" type="number" min={0} max={100} placeholder="min score" defaultValue={minScore ?? ""} />
					<select className="rounded border border-zinc-300 px-2 py-1" name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<select className="rounded border border-zinc-300 px-2 py-1" name="sort" defaultValue={sort ?? ""}>
					<option value="">Najnowsze</option>
					<option value="name">Nazwa A-Z</option>
					<option value="priority">Priorytet</option>
					<option value="score">Score</option>
				</select>
				<button className="rounded border border-zinc-300 px-3 py-1" type="submit">
					Filtruj
				</button>
			</form>

			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-zinc-300 text-left text-zinc-500">
						<th className="py-1 pr-2">Placówka</th>
						<th className="py-1 pr-2">Email</th>
						<th className="py-1 pr-2">Miasto</th>
						<th className="py-1 pr-2">Linia</th>
						<th className="py-1 pr-2">Etap</th>
						<th className="py-1 pr-2">Score</th>
						<th className="py-1 pr-2"></th>
					</tr>
				</thead>
				<tbody>
					{leads.map((lead) => (
						<tr className="border-b border-zinc-100" key={lead.id}>
							<td className="py-1 pr-2">
								<a className="text-blue-600 hover:underline" href={`/leady/${lead.id}`}>
									{lead.organizationName}
								</a>
							</td>
							<td className="py-1 pr-2">{lead.email ?? "—"}</td>
							<td className="py-1 pr-2">{lead.city ?? "—"}</td>
							<td className="py-1 pr-2">{lead.offeringLine?.name ?? "—"}</td>
							<td className="py-1 pr-2">{lead.dealStage}</td>
							<td className="py-1 pr-2">{lead.score ?? "—"}</td>
							<td className="py-1 pr-2 text-right">
								<form action={deleteLead.bind(null, lead.id)}>
									<button className="text-red-600" type="submit">
										Usuń
									</button>
								</form>
							</td>
						</tr>
					))}
					{leads.length === 0 ? (
						<tr>
							<td className="py-2 text-zinc-500" colSpan={7}>
								Brak leadów.
							</td>
						</tr>
					) : null}
				</tbody>
			</table>
		</section>
	)
}
