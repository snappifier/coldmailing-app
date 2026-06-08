// app/(app)/pipeline/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getPipelineLeads} from "@/features/pipeline/queries"
import {groupLeadsByStage} from "@/features/pipeline/group"
import {PipelineBoard} from "./board"

export default async function PipelinePage({searchParams}: {searchParams: Promise<{line?: string}>}) {
	const {orgId} = await requireOrg()
	const {line} = await searchParams
	const [leads, offeringLines] = await Promise.all([
		getPipelineLeads(orgId, {offeringLineId: line || null}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])
	const columns = groupLeadsByStage(leads)

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Pipeline ({leads.length})</h1>
			<form className="flex gap-2 text-sm">
				<select className="rounded border border-zinc-300 px-2 py-1" name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<button className="rounded border border-zinc-300 px-3 py-1" type="submit">
					Filtruj
				</button>
			</form>
			<PipelineBoard columns={columns} />
		</section>
	)
}
