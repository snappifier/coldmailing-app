import {Skeleton} from "@/components/ui/skeleton"

// Table-page skeleton: PageHeader bar + batch launcher + filter row + a leads table.
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-3 w-56" />
					<Skeleton className="h-2.5 w-32" />
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-8 w-20" />
					<Skeleton className="h-8 w-28" />
				</div>
			</div>
			<Skeleton className="h-9 w-72" />
			<div className="flex flex-wrap gap-2">
				<Skeleton className="h-9 w-52" />
				<Skeleton className="h-9 w-28" />
				<Skeleton className="h-9 w-44" />
				<Skeleton className="h-9 w-20" />
			</div>
			<div className="flex flex-col">
				<div className="flex gap-6 border-b border-border-strong pb-2">
					{Array.from({length: 6}).map((_, i) => (
						<Skeleton className="h-2.5 w-20" key={i} />
					))}
				</div>
				{Array.from({length: 10}).map((_, i) => (
					<div className="flex items-center gap-6 border-b border-border py-3" key={i}>
						<Skeleton className="h-3.5 w-40" />
						<Skeleton className="h-3 w-48" />
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-3 w-10" />
					</div>
				))}
			</div>
		</section>
	)
}
