// app/(app)/leady/page.tsx
import Link from "next/link"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteLead} from "@/features/leads/actions"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {listResearchTypes} from "@/features/research-types/queries"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Table, Th, Td} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {EmptyState} from "@/components/ui/empty-state"
import {EmptyIllustration} from "@/components/ui/empty-illustration"
import {PageHeader} from "@/components/ui/page-header"
import {ArrowRightIcon} from "@/components/ui/icons"
import {LeadCreateButton} from "./lead-create-button"
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

	const [leads, offeringLines, researchTypes, total, inCampaigns] = await Promise.all([
		prisma.lead.findMany({where, orderBy, take: 500, include: {offeringLine: {select: {name: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		listResearchTypes(orgId),
		prisma.lead.count({where: {organizationId: orgId}}),
		prisma.lead.count({where: {organizationId: orgId, campaignLeads: {some: {}}}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Leady"
				description="Baza placówek z importem CSV, badaniami AI i przypisaniem do kampanii."
				meta={`${total} leadów · ${inCampaigns} w kampaniach`}
				action={
					<span className="flex gap-2">
						<Link className="text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/leady/import">Importuj</Link>
						<LeadCreateButton offeringLines={offeringLines} />
					</span>
				}
			/>

			<BatchResearchLauncher types={researchTypes.filter((t) => t.kind !== "DRAFT").map((t) => ({id: t.id, name: t.name, kind: t.kind}))} criteria={{offeringLineId: line, q}} />

			<form className="flex flex-wrap gap-2 text-sm">
				<Input name="q" placeholder="Szukaj..." defaultValue={q ?? ""} />
				<Input className="w-28" name="minScore" type="number" min={0} max={100} placeholder="min score" defaultValue={minScore ?? ""} />
				<Select name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
				<Select name="sort" defaultValue={sort ?? ""}>
					<option value="">Najnowsze</option>
					<option value="name">Nazwa A-Z</option>
					<option value="priority">Priorytet</option>
					<option value="score">Score</option>
				</Select>
				<Button type="submit">Filtruj</Button>
			</form>

			{leads.length === 0 ? (
				<EmptyState
					illustration={<EmptyIllustration />}
					title="Brak leadów"
					description="Dodaj pierwszego leada lub zmień kryteria filtra."
					action={<LeadCreateButton offeringLines={offeringLines} variant="secondary" />}
				/>
			) : (
				<Table>
					<thead>
						<tr>
							<Th>Placówka</Th>
							<Th>Email</Th>
							<Th>Miasto</Th>
							<Th>Linia</Th>
							<Th>Etap</Th>
							<Th className="text-right">Score</Th>
							<Th>{""}</Th>
						</tr>
					</thead>
					<tbody>
						{leads.map((lead) => (
							<tr className="group" key={lead.id}>
								<Td>
									<span className="inline-flex items-center gap-1.5">
										<a className="text-fg font-medium hover:underline underline-offset-2" href={`/leady/${lead.id}`}>
											{lead.organizationName}
										</a>
										<ArrowRightIcon className="size-3.5 flex-none -translate-x-0.5 text-fg-faint opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-fg group-hover:opacity-100" />
									</span>
								</Td>
								<Td>{lead.email ?? "—"}</Td>
								<Td>{lead.city ?? "—"}</Td>
								<Td>{lead.offeringLine?.name ?? "—"}</Td>
								<Td>
									<Badge>{STAGE_LABEL[lead.dealStage]}</Badge>
								</Td>
								<Td className="text-right tabular-nums">{lead.score ?? "—"}</Td>
								<Td className="text-right">
									<ConfirmButton action={deleteLead.bind(null, lead.id)} confirm={{title: "Usunąć leada?", body: "Lead i jego dane zostaną usunięte. Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto leada">Usuń</ConfirmButton>
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</section>
	)
}
