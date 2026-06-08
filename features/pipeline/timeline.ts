// features/pipeline/timeline.ts
import type {DealStage, InboundKind, LeadActivityKind, MessageDirection} from "@/generated/prisma/client"
import type {TimelineItem} from "./types"
import {STAGE_LABEL} from "./types"

export interface MessageLike {
	id: string
	direction: MessageDirection
	inboundKind: InboundKind | null
	subject: string
	sentAt: Date | null
	createdAt: Date
}

export interface ActivityLike {
	id: string
	kind: LeadActivityKind
	body: string | null
	fromStage: DealStage | null
	toStage: DealStage | null
	createdAt: Date
}

const INBOUND_TITLE: Record<InboundKind, string> = {
	REPLY: "Odpowiedź",
	BOUNCE: "Odbicie",
	AUTO_REPLY: "Autoresponder",
	OPT_OUT_SUSPECT: "Możliwa rezygnacja",
}

const MANUAL_LABEL: Record<Exclude<LeadActivityKind, "STAGE_CHANGE">, string> = {
	NOTE: "Notatka",
	CALL: "Telefon",
	MEETING: "Spotkanie",
	OFFER_SENT: "Oferta wysłana",
}

export function messageToTimelineItem(m: MessageLike): TimelineItem {
	if (m.direction === "OUTBOUND") {
		return {id: m.id, at: m.sentAt ?? m.createdAt, source: "message", kind: "EMAIL_OUT", title: `Wysłano: ${m.subject}`}
	}
	const title = m.inboundKind ? INBOUND_TITLE[m.inboundKind] : "Wiadomość przychodząca"
	return {id: m.id, at: m.sentAt ?? m.createdAt, source: "message", kind: "EMAIL_IN", title, detail: m.subject}
}

export function activityToTimelineItem(a: ActivityLike): TimelineItem {
	if (a.kind === "STAGE_CHANGE") {
		const from = a.fromStage ? STAGE_LABEL[a.fromStage] : "—"
		const to = a.toStage ? STAGE_LABEL[a.toStage] : "—"
		return {id: a.id, at: a.createdAt, source: "activity", kind: "STAGE_CHANGE", title: `Etap: ${from} -> ${to}`}
	}
	return {id: a.id, at: a.createdAt, source: "activity", kind: a.kind, title: MANUAL_LABEL[a.kind], detail: a.body ?? undefined}
}

export function buildTimeline(activities: ActivityLike[], messages: MessageLike[]): TimelineItem[] {
	return [...activities.map(activityToTimelineItem), ...messages.map(messageToTimelineItem)].sort((a, b) => b.at.getTime() - a.at.getTime())
}
