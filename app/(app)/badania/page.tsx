// app/(app)/badania/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {listResearchTypes} from "@/features/research-types/queries"
import {listResearchBatches} from "@/features/research/batch-queries"
import {deleteResearchType} from "@/features/research-types/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {Badge} from "@/components/ui/badge"
import {EmptyState} from "@/components/ui/empty-state"
import {EmptyIllustration} from "@/components/ui/empty-illustration"
import {PageHeader} from "@/components/ui/page-header"
import {RESEARCH_KIND_LABEL, RESEARCH_KIND_VARIANT, RESEARCH_STATUS_LABEL, RESEARCH_STATUS_VARIANT} from "@/features/enums/labels"

// Primary CTA rendered as a route Link - the canonical Button class vocabulary (mirrors skrzynki connectAnchorClass).
const newTypeLinkClass = "inline-flex items-center gap-2 rounded-md font-medium tracking-[-0.01em] transition-[transform,background,border-color,opacity] duration-150 ease-out active:scale-[.97] h-8 px-3 text-sm bg-primary text-primary-fg hover:opacity-90"

export default async function ResearchTypesPage() {
	const {orgId} = await requireOrg()
	const [types, batches] = await Promise.all([listResearchTypes(orgId), listResearchBatches(orgId)])

	return (
		<section className="flex flex-col gap-4">
			<PageHeader
				title="Badania AI"
				description="Typy badań, ocen i treści generowanych przez AI."
				meta={`${types.length} typów · ${batches.length} ostatnich badań zbiorczych`}
				action={<Link className={newTypeLinkClass} href="/badania/nowy">Nowy typ</Link>}
			/>

			{types.length === 0 ? (
				<EmptyState
					illustration={<EmptyIllustration />}
					title="Brak typów badań"
					description="Utwórz pierwszy typ badania."
					action={
						<Link className={newTypeLinkClass} href="/badania/nowy">
							Nowy typ
						</Link>
					}
				/>
			) : (
				<div className="flex flex-col gap-2">
					{types.map((t) => {
						const count = Array.isArray(t.outputFields) ? t.outputFields.length : 0
						return (
							<Card key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:border-border-strong">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-sm font-semibold text-fg">
										<Link className="truncate hover:underline underline-offset-2" href={`/badania/${t.id}`}>{t.name}</Link>
										<Badge variant={RESEARCH_KIND_VARIANT[t.kind]}>{RESEARCH_KIND_LABEL[t.kind]}</Badge>
									</div>
									<p className="mt-0.5 text-[12px] text-fg-faint">
										{count} pól{t.webSearchEnabled ? ", wyszukiwanie w sieci" : ""}
										{t.modelId ? `, ${t.modelId}` : ""}
									</p>
								</div>
								<div className="flex-none">
									<ConfirmButton action={deleteResearchType.bind(null, t.id)} confirm={{title: "Usunąć typ badania?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto typ badania">Usuń</ConfirmButton>
								</div>
							</Card>
						)
					})}
				</div>
			)}

			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-fg-muted">Ostatnie badania zbiorcze</h2>
				{batches.length === 0 ? (
					<EmptyState title="Brak badań zbiorczych" description="Uruchom pierwsze badanie zbiorcze, by zobaczyć wyniki." />
				) : (
					<div className="flex flex-col gap-2">
						{batches.map((b) => (
							<Card key={b.id} className="flex items-center justify-between gap-3 px-3.5 py-3 transition-colors hover:border-border-strong">
								<div className="min-w-0">
									<div className="flex items-center gap-2 text-sm font-semibold text-fg">
										<Link className="truncate hover:underline underline-offset-2" href={`/badania/batches/${b.id}`}>{b.researchTypeName}</Link>
										<Badge variant={RESEARCH_STATUS_VARIANT[b.status]}>{RESEARCH_STATUS_LABEL[b.status]}</Badge>
									</div>
									<p className="mt-0.5 text-[12px] text-fg-faint">
										{b.total} leadów · {b.mode === "MANUAL" ? "ręczne" : "auto"} · {b.createdAt.toLocaleDateString("pl-PL")}
									</p>
								</div>
							</Card>
						))}
					</div>
				)}
			</div>
		</section>
	)
}
