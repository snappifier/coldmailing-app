// features/pipeline/group.ts
import type {DealStage} from "@/generated/prisma/client"
import {STAGE_ORDER} from "./types"

export interface StageColumn<T> {
	stage: DealStage
	leads: T[]
}

export function groupLeadsByStage<T extends {dealStage: DealStage}>(leads: T[]): StageColumn<T>[] {
	const buckets: Record<DealStage, T[]> = {NEW: [], AUDIT: [], PROPOSAL: [], MEETING: [], OFFER: [], WON: [], LOST: []}
	for (const lead of leads) buckets[lead.dealStage].push(lead)
	return STAGE_ORDER.map((stage) => ({stage, leads: buckets[stage]}))
}
