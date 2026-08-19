import {Skeleton} from "@/components/ui/skeleton"
import {Card, CardBody} from "@/components/ui/card"

// Lead-detail skeleton: quick-facts header + the [1.6fr_1fr] data/AI grid.
export default function Loading() {
	return (
		<section className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<Skeleton className="h-6 w-56" />
					<Skeleton className="h-5 w-16" />
					<Skeleton className="h-5 w-12" />
				</div>
				<Skeleton className="h-3 w-72" />
			</div>
			<div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
				<div className="flex flex-col gap-6">
					<Card>
						<CardBody className="flex flex-col gap-3">
							<Skeleton className="h-2.5 w-16" />
							{Array.from({length: 7}).map((_, i) => (
								<Skeleton className="h-9 w-full" key={i} />
							))}
						</CardBody>
					</Card>
					<Card>
						<CardBody className="flex flex-col gap-3">
							<Skeleton className="h-2.5 w-20" />
							{Array.from({length: 4}).map((_, i) => (
								<Skeleton className="h-12 w-full" key={i} />
							))}
						</CardBody>
					</Card>
				</div>
				<div className="flex flex-col gap-6">
					<Card>
						<CardBody className="flex flex-col gap-3">
							<Skeleton className="h-2.5 w-20" />
							<Skeleton className="h-24 w-full" />
						</CardBody>
					</Card>
					<Card>
						<CardBody className="flex flex-col gap-3">
							<Skeleton className="h-2.5 w-14" />
							<Skeleton className="h-32 w-full" />
						</CardBody>
					</Card>
				</div>
			</div>
		</section>
	)
}
