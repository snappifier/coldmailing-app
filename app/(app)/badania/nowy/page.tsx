// app/(app)/badania/nowy/page.tsx
import {createResearchType} from "@/features/research-types/actions"
import {ResearchTypeForm} from "../research-type-form"

export default function NewResearchTypePage() {
	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Nowy typ researchu</h1>
			<ResearchTypeForm action={createResearchType} />
		</section>
	)
}
