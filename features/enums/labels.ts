// features/enums/labels.ts
import type {CampaignStatus, CampaignLeadStatus, SequenceCondition, InboundKind, ResearchTypeKind, PlaceholderType, Role, ResearchRunStatus, ResearchBatchStatus} from "@/generated/prisma/client"
import type {BadgeVariant} from "@/components/ui/badge"

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {DRAFT: "Szkic", ACTIVE: "Aktywna", PAUSED: "Wstrzymana", DONE: "Zakończona"}
export const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, BadgeVariant> = {DRAFT: "neutral", ACTIVE: "ok", PAUSED: "warn", DONE: "neutral"}

export const LEAD_STATUS_LABEL: Record<CampaignLeadStatus, string> = {PENDING: "Oczekuje", ACTIVE: "W toku", REPLIED: "Odpowiedział", BOUNCED: "Odbicie", UNSUBSCRIBED: "Rezygnacja", SKIPPED: "Pominięty", FAILED: "Błąd", DONE: "Zakończony"}
export const LEAD_STATUS_VARIANT: Record<CampaignLeadStatus, BadgeVariant> = {PENDING: "neutral", ACTIVE: "ok", REPLIED: "info", BOUNCED: "bad", UNSUBSCRIBED: "warn", SKIPPED: "neutral", FAILED: "bad", DONE: "neutral"}

export const CONDITION_LABEL: Record<SequenceCondition, string> = {ALWAYS: "Zawsze", SEND_IF_NO_REPLY: "Jeśli brak odpowiedzi"}

export const INBOUND_KIND_LABEL: Record<InboundKind, string> = {REPLY: "Odpowiedź", BOUNCE: "Odbicie", AUTO_REPLY: "Auto-odpowiedź", OPT_OUT_SUSPECT: "Możliwa rezygnacja"}
export const INBOUND_KIND_VARIANT: Record<InboundKind, BadgeVariant> = {REPLY: "info", BOUNCE: "bad", AUTO_REPLY: "neutral", OPT_OUT_SUSPECT: "warn"}

export const RESEARCH_KIND_LABEL: Record<ResearchTypeKind, string> = {RESEARCH: "Badanie", SCORING: "Ocena", CONTENT: "Treść", DRAFT: "Draft maila"}
export const RESEARCH_KIND_VARIANT: Record<ResearchTypeKind, BadgeVariant> = {RESEARCH: "neutral", SCORING: "warn", CONTENT: "info", DRAFT: "neutral"}

export const PLACEHOLDER_TYPE_LABEL: Record<PlaceholderType, string> = {TEXT: "Tekst", CHOICE: "Wybór"}

export const ROLE_LABEL: Record<Role, string> = {OWNER: "Właściciel", ADMIN: "Administrator", MEMBER: "Członek"}

// ResearchRunStatus = QUEUED|RUNNING|DONE|FAILED|CANCELLED; ResearchBatchStatus = QUEUED|RUNNING|DONE|PARTIAL|CANCELLED
export const RESEARCH_STATUS_LABEL: Record<ResearchRunStatus | ResearchBatchStatus, string> = {QUEUED: "W kolejce", RUNNING: "W toku", DONE: "Gotowe", FAILED: "Błąd", CANCELLED: "Anulowane", PARTIAL: "Częściowe"}
