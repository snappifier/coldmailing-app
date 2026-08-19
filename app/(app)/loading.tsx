import {Skeleton} from "@/components/ui/skeleton"

// Shown instantly on navigation while the page's server component streams in (so a click swaps the
// subpage immediately instead of waiting on the old page). Page-shaped: a PageHeader bar + list rows.
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-5 w-44" />
					<Skeleton className="h-3 w-64" />
					<Skeleton className="h-2.5 w-28" />
				</div>
				<Skeleton className="h-8 w-32" />
			</div>
			<div className="flex flex-col gap-2">
				{Array.from({length: 6}).map((_, i) => (
					<div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3" key={i}>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-3.5 w-48" />
							<Skeleton className="h-2.5 w-32" />
						</div>
						<Skeleton className="h-7 w-16" />
					</div>
				))}
			</div>
		</section>
	)
}
