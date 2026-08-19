import {Skeleton} from "@/components/ui/skeleton"

// Settings-shell skeleton: section rail + form body.
export default function Loading() {
	return (
		<section className="flex flex-col gap-6">
			<div className="flex flex-col gap-2 border-b border-border pb-4">
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-3 w-48" />
			</div>
			<div className="grid grid-cols-[200px_1fr] gap-10 max-md:grid-cols-1">
				<div className="flex flex-col gap-3">
					{Array.from({length: 4}).map((_, i) => (
						<Skeleton className="h-4 w-28" key={i} />
					))}
				</div>
				<div className="flex max-w-[560px] flex-col gap-4">
					<Skeleton className="h-2.5 w-20" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-8 w-28" />
				</div>
			</div>
		</section>
	)
}
