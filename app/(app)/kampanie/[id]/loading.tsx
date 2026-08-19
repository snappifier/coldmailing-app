import {Skeleton} from "@/components/ui/skeleton"
import {Card} from "@/components/ui/card"

// Campaign-detail skeleton: name + actions, metrics strip, tab bar, sequence step cards.
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-6 w-64" />
					<Skeleton className="h-3 w-40" />
				</div>
				<Skeleton className="h-8 w-24" />
			</div>
			<Card className="flex flex-wrap divide-x divide-border">
				{Array.from({length: 4}).map((_, i) => (
					<div className="flex flex-col gap-2 px-5 py-3" key={i}>
						<Skeleton className="h-2.5 w-16" />
						<Skeleton className="h-5 w-12" />
					</div>
				))}
			</Card>
			<div className="flex gap-4 border-b border-border pb-2">
				{Array.from({length: 3}).map((_, i) => (
					<Skeleton className="h-4 w-24" key={i} />
				))}
			</div>
			<div className="flex flex-col gap-3">
				{Array.from({length: 3}).map((_, i) => (
					<Skeleton className="h-24 w-full" key={i} />
				))}
			</div>
		</section>
	)
}
