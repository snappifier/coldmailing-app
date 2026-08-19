import {Skeleton} from "@/components/ui/skeleton"

// Mailboxes skeleton: PageHeader + two tall mailbox cards with a settings-form grid.
export default function Loading() {
	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-3 w-44" />
				</div>
				<Skeleton className="h-8 w-36" />
			</div>
			{Array.from({length: 2}).map((_, i) => (
				<div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4" key={i}>
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-52" />
						<Skeleton className="h-5 w-20" />
					</div>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{Array.from({length: 8}).map((_, k) => (
							<Skeleton className="h-9 w-full" key={k} />
						))}
					</div>
					<Skeleton className="h-8 w-28" />
				</div>
			))}
		</section>
	)
}
