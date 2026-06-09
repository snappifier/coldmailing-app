// app/(app)/badania/batches/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {getBatch} from "@/features/research/batch-actions"
import {BatchView} from "./batch-view"

export default async function BatchPage({params}: {params: Promise<{id: string}>}) {
	const {id} = await params
	const batch = await getBatch(id)
	if (!batch) notFound()

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-accent" href="/badania">
				← Badania
			</Link>
			<BatchView batchId={id} initial={batch} />
		</section>
	)
}
