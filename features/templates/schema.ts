import {z} from "zod"

export const templateSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(120),
	subject: z.string().trim().min(1, "Podaj temat").max(300),
	body: z.string().trim().min(1, "Treść nie może być pusta"),
	isFollowup: z.preprocess((v) => v === "on" || v === true, z.boolean()),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
	visibility: z.enum(["TEAM", "PRIVATE"]).default("TEAM"),
	folder: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
})

export type TemplateInput = z.infer<typeof templateSchema>

export const templateUpdateSchema = templateSchema.extend({
	templateId: z.string().trim().min(1),
})
