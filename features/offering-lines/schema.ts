import {z} from "zod"

export const offeringLineSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(80, "Za długa nazwa"),
	description: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v ? v : null)),
})

export type OfferingLineInput = z.infer<typeof offeringLineSchema>
