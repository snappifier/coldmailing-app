// features/campaigns/schema.ts
import {z} from "zod"

export const campaignSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(120),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
})

export const sequenceStepSchema = z.object({
	campaignId: z.string().trim().min(1),
	templateId: z.string().trim().min(1, "Wybierz szablon"),
	delayDays: z.coerce.number().int().min(0).max(365),
	condition: z.enum(["ALWAYS", "SEND_IF_NO_REPLY"]),
})

export type CampaignInput = z.infer<typeof campaignSchema>
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>
