import {Skeleton} from "@/components/ui/skeleton"
import {Card} from "@/components/ui/card"

// Dashboard-shaped skeleton: the header row is EXACTLY as tall as the real h1 row (h-7) so the
// content below does not shift on the skeleton -> page swap (the generic (app) skeleton mimics a
// PageHeader, 75px vs the pulpit's 28px - a measured 47px jump on every load).
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex h-7 items-center justify-between">
				<Skeleton className="h-5 w-20" />
				<Skeleton className="h-3 w-24" />
			</div>
			<Card className="divide-y divide-border">
				<div className="grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
					{Array.from({length: 4}).map((_, i) => (
						<div className="flex flex-col gap-2 px-5 py-4" key={i}>
							<Skeleton className="h-2.5 w-16" />
							<Skeleton className="h-7 w-14" />
							<Skeleton className="h-2.5 w-20" />
						</div>
					))}
				</div>
				<div className="flex flex-col gap-2.5 px-5 py-4">
					<Skeleton className="h-2.5 w-40" />
					<Skeleton className="h-16 w-full" />
				</div>
				<div className="grid lg:grid-cols-2">
					{Array.from({length: 2}).map((_, i) => (
						<div className="flex flex-col gap-3 px-5 py-4" key={i}>
							<Skeleton className="h-2.5 w-28" />
							{Array.from({length: 5}).map((_, k) => (
								<Skeleton className="h-3 w-full" key={k} />
							))}
						</div>
					))}
				</div>
			</Card>
		</section>
	)
}
