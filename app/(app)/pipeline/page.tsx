import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getPipelineLeads} from "@/features/pipeline/queries"
import {groupLeadsByStage} from "@/features/pipeline/group"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {PageHeader} from "@/components/ui/page-header"
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
			<PageHeader
				title="Pipeline"
				description="Etapy dealowe przeciągane na tablicy."
				meta={`${leads.length} leadów na tablicy`}
			/>
			<form className="flex items-center gap-2">
				<Select name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
				<Button type="submit">Filtruj</Button>
			</form>
			<PipelineBoard columns={columns} />
		</section>
	)
}
