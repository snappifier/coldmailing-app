"use client"
// app/(app)/error.tsx
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
export default function Error({reset}: {error: Error; reset: () => void}) {
	return (
		<Card className="mx-auto max-w-md">
			<CardBody>
				<h2 className="text-sm font-semibold text-fg">Coś poszło nie tak</h2>
				<p className="mt-1 text-[12.5px] text-fg-muted">Wystąpił błąd podczas ładowania tej strony.</p>
				<Button variant="secondary" className="mt-4" onClick={reset}>Spróbuj ponownie</Button>
			</CardBody>
		</Card>
	)
}
