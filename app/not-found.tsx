// app/not-found.tsx
import Link from "next/link"
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return (
		<div className="grid min-h-screen place-items-center bg-bg text-fg">
			<EmptyState
				title="404"
				description="Nie znaleziono strony."
				action={<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć na stronę główną</Link>}
			/>
		</div>
	)
}
