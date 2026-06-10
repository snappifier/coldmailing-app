// app/(app)/not-found.tsx
import Link from "next/link"
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return (
		<EmptyState
			title="Nie znaleziono strony"
			description="Ten zasób nie istnieje lub został przeniesiony."
			action={<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć do pulpitu</Link>}
		/>
	)
}
