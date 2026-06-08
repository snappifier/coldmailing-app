// lib/inngest/draft.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"
import {buildLeadContextBlock} from "@/features/research/lead-context"
import {buildDraftSchema, coerceDraft} from "@/features/research/draft"
import {runResearch} from "@/features/research/engine"

const DRAFT_SYSTEM =
	"Jesteś copywriterem B2B. Na podstawie instrukcji i danych leada napisz zwięzłego, spersonalizowanego maila: temat i treść. Pisz po polsku, naturalnie i konkretnie; nie zmyślaj faktów. Zwróć wynik przez narzędzie (pola subject, body)."

export const runDraftFn = inngest.createFunction(
	{
		id: "run-draft",
		triggers: {event: "research/draft.requested"},
		concurrency: {limit: 3, key: "event.data.organizationId"},
		retries: 3,
		onFailure: async ({event, error}: {event: {data: {event: {data: {draftId?: string}}}}; error: unknown}) => {
			const draftId = event.data.event.data.draftId
			if (!draftId) return
			await prisma.leadDraft.updateMany({where: {id: draftId, status: {notIn: ["DONE", "FAILED"]}}, data: {status: "FAILED", error: String(error).slice(0, 500)}})
		},
	},
	async ({event, step}) => {
		const {draftId, organizationId} = event.data as {draftId: string; organizationId: string}
		const draft = await prisma.leadDraft.findFirst({where: {id: draftId, organizationId}, include: {lead: true, sourceType: true}})
		if (!draft) return {skipped: true}
		if (!draft.lead || !draft.sourceType || draft.sourceType.kind !== "DRAFT" || draft.lead.organizationId !== draft.organizationId) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: "Brak typu/leada lub niezgodność"}})
			return {skipped: true}
		}
		const lead = draft.lead
		const type = draft.sourceType
		await step.run("mark-running", () => prisma.leadDraft.update({where: {id: draftId}, data: {status: "RUNNING"}}))

		const placeholders = await prisma.placeholder.findMany({where: {organizationId: draft.organizationId}, select: {key: true, source: true, fallback: true}})

		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			const base = buildResearchPrompt(type.prompt, ctx)
			const block = buildLeadContextBlock(lead)
			const renderedPrompt = block ? `${base}\n\n${block}` : base
			return runResearch({renderedPrompt, inputSchema: buildDraftSchema(), modelId: type.modelId, webSearchEnabled: type.webSearchEnabled, system: DRAFT_SYSTEM})
		})

		if (!result.ok) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: result.error}})
			return {ok: false}
		}
		const out = coerceDraft(result.findings)
		if (!out.ok) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: "Model nie zwrócił poprawnego draftu (subject/body)"}})
			return {ok: false}
		}
		await step.run("save", () => prisma.leadDraft.update({where: {id: draftId}, data: {subject: out.subject, body: out.body, status: "DONE", error: null}}))
		await step.sendEvent("draft-ready", {name: "research/draft.ready", data: {leadId: lead.id, organizationId: draft.organizationId}})
		return {ok: true}
	},
)
