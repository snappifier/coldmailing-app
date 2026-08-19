import {describe, it, expect} from "vitest"
import {CampaignStatus, CampaignLeadStatus, SequenceCondition, InboundKind, ResearchTypeKind, PlaceholderType, Role, ResearchRunStatus, ResearchBatchStatus, EmailAccountStatus} from "@/generated/prisma/client"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT, LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT, CONDITION_LABEL, INBOUND_KIND_LABEL, INBOUND_KIND_VARIANT, RESEARCH_KIND_LABEL, RESEARCH_KIND_VARIANT, PLACEHOLDER_TYPE_LABEL, ROLE_LABEL, RESEARCH_STATUS_LABEL, RESEARCH_STATUS_VARIANT, EMAIL_ACCOUNT_STATUS_LABEL, EMAIL_ACCOUNT_STATUS_VARIANT} from "@/features/enums/labels"

function total(enumObj: Record<string, string>, map: Record<string, string>) {
	for (const v of Object.values(enumObj)) {
		expect(typeof map[v], `missing key ${v}`).toBe("string")
		expect(map[v]).not.toBe("")
	}
}

describe("enum labels", () => {
	it("label maps are total over their enum", () => {
		total(CampaignStatus, CAMPAIGN_STATUS_LABEL)
		total(CampaignLeadStatus, LEAD_STATUS_LABEL)
		total(SequenceCondition, CONDITION_LABEL)
		total(InboundKind, INBOUND_KIND_LABEL)
		total(ResearchTypeKind, RESEARCH_KIND_LABEL)
		total(PlaceholderType, PLACEHOLDER_TYPE_LABEL)
		total(Role, ROLE_LABEL)
		total(ResearchRunStatus, RESEARCH_STATUS_LABEL)
		total(ResearchBatchStatus, RESEARCH_STATUS_LABEL)
		total(EmailAccountStatus, EMAIL_ACCOUNT_STATUS_LABEL)
	})
	it("variant maps are total over their enum", () => {
		total(CampaignStatus, CAMPAIGN_STATUS_VARIANT)
		total(CampaignLeadStatus, LEAD_STATUS_VARIANT)
		total(InboundKind, INBOUND_KIND_VARIANT)
		total(ResearchTypeKind, RESEARCH_KIND_VARIANT)
		total(ResearchRunStatus, RESEARCH_STATUS_VARIANT)
		total(ResearchBatchStatus, RESEARCH_STATUS_VARIANT)
		total(EmailAccountStatus, EMAIL_ACCOUNT_STATUS_VARIANT)
	})
	it("spot-checks labels + variants", () => {
		expect(CAMPAIGN_STATUS_LABEL.ACTIVE).toBe("Aktywna")
		expect(LEAD_STATUS_LABEL.REPLIED).toBe("Odpowiedział")
		expect(RESEARCH_KIND_LABEL.DRAFT).toBe("Draft maila")
		expect(CONDITION_LABEL.SEND_IF_NO_REPLY).toBe("Jeśli brak odpowiedzi")
		expect(RESEARCH_STATUS_LABEL.PARTIAL).toBe("Częściowe")
		expect(CAMPAIGN_STATUS_VARIANT.ACTIVE).toBe("ok")
		expect(LEAD_STATUS_VARIANT.FAILED).toBe("bad")
	})
})
