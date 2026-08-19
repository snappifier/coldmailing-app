import {Skeleton} from "@/components/ui/skeleton"

// Kanban skeleton: heading + filter, then the 7 stage columns with a few cards each.
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-2.5 w-36" />
				</div>
				<Skeleton className="h-9 w-52" />
			</div>
			<div className="flex gap-2 overflow-x-hidden pb-2">
				{Array.from({length: 7}).map((_, col) => (
					<div className="flex w-[220px] shrink-0 flex-col gap-2" key={col}>
						<Skeleton className="h-3 w-24" />
						{Array.from({length: ((col * 5) % 3) + 1}).map((_, i) => (
							<Skeleton className="h-20 w-full" key={i} />
						))}
					</div>
				))}
			</div>
		</section>
	)
}
