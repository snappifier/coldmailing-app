// features/research/prompt.ts
import {renderTemplate, type RenderContext, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"

interface PromptLead {
	organizationName: string
	contactPersonName: string | null
	city: string | null
	website: string | null
	aiHook: string | null
	honorific: "PAN" | "PANI" | null
	customFields: unknown
}

export function leadToRenderContext(lead: PromptLead, senderName: string, placeholders: RenderPlaceholder[]): RenderContext {
	const renderLead: RenderLead = {
		organizationName: lead.organizationName,
		contactPersonName: lead.contactPersonName,
		city: lead.city,
		website: lead.website,
		aiHook: lead.aiHook,
		honorific: lead.honorific,
		customFields: (lead.customFields as Record<string, unknown> | null) ?? null,
	}
	return {lead: renderLead, senderName, placeholders}
}

export function buildResearchPrompt(rawPrompt: string, ctx: RenderContext): string {
	const {rendered} = renderTemplate(rawPrompt, ctx)
	return rendered
		.replace(/\[brak: [^\]]+\]/g, "")
		.replace(/[ \t]{2,}/g, " ")
		.trim()
}
