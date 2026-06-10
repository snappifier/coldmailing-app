"use client"
// app/(app)/error.tsx
import Link from "next/link"
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
export default function Error({reset}: {error: Error; reset: () => void}) {
	return (
		<Card className="mx-auto max-w-md">
			<CardBody>
				<h2 className="text-sm font-semibold text-fg">Coś poszło nie tak</h2>
				<p className="mt-1 text-[12.5px] text-fg-muted">Wystąpił błąd podczas ładowania tej strony.</p>
				<div className="mt-4 flex items-center gap-3">
					<Button variant="secondary" onClick={reset}>Spróbuj ponownie</Button>
					<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć do pulpitu</Link>
				</div>
			</CardBody>
		</Card>
	)
}
