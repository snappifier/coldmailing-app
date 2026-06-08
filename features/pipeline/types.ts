// features/pipeline/types.ts
import type {CampaignLeadStatus, DealStage} from "@/generated/prisma/client"

export const STAGE_ORDER: DealStage[] = ["NEW", "AUDIT", "PROPOSAL", "MEETING", "OFFER", "WON", "LOST"]

export const STAGE_LABEL: Record<DealStage, string> = {
	NEW: "Nowy",
	AUDIT: "Audyt",
	PROPOSAL: "Propozycja",
	MEETING: "Spotkanie",
	OFFER: "Oferta",
	WON: "Wygrany",
	LOST: "Przegrany",
}

export interface TimelineItem {
	id: string
	at: Date
	source: "activity" | "message"
	kind: string
	title: string
	detail?: string
}

export interface PipelineLead {
	id: string
	organizationName: string
	city: string | null
	dealStage: DealStage
	lineName: string | null
	score: number | null
	sequenceStatus: CampaignLeadStatus | null
	lastActivityAt: Date | null
}
