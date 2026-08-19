import {z} from "zod"

export const MANUAL_ACTIVITY_KINDS = ["NOTE", "CALL", "MEETING", "OFFER_SENT"] as const

export const addActivitySchema = z.object({
	leadId: z.string().min(1),
	kind: z.enum(MANUAL_ACTIVITY_KINDS),
	body: z.string().trim().min(1, "Wpisz treść wpisu"),
})

export type AddActivityInput = z.infer<typeof addActivitySchema>
