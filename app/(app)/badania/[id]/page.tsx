// app/(app)/badania/[id]/page.tsx
import {notFound} from "next/navigation"
import {requireOrg} from "@/lib/org"
import {getResearchType} from "@/features/research-types/queries"
import {updateResearchType} from "@/features/research-types/actions"
import {ResearchTypeForm} from "../research-type-form"
import type {OutputField} from "@/features/research-types/schema"

export default async function EditResearchTypePage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const type = await getResearchType(orgId, id)
	if (!type) notFound()

	const initial = {
		name: type.name,
		kind: type.kind,
		prompt: type.prompt,
		modelId: type.modelId ?? "",
		webSearchEnabled: type.webSearchEnabled,
		outputFields: (type.outputFields as OutputField[]) ?? [],
	}

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Edytuj typ badania</h1>
			<ResearchTypeForm action={updateResearchType.bind(null, id)} initial={initial} />
		</section>
	)
}
