import {Skeleton} from "@/components/ui/skeleton"

// Master-detail skeleton: templates rail + editor column + (xl) preview column.
export default function Loading() {
	return (
		<section className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-3 w-52" />
				</div>
				<Skeleton className="h-8 w-24" />
			</div>
			<div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1.1fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-3">
					{Array.from({length: 6}).map((_, i) => (
						<Skeleton className="h-4 w-full" key={i} />
					))}
				</div>
				<div className="flex flex-col gap-3">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-48 w-full" />
					<Skeleton className="h-9 w-40" />
				</div>
				<div className="hidden xl:flex xl:flex-col xl:gap-3">
					<Skeleton className="h-2.5 w-20" />
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		</section>
	)
}
