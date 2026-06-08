// features/research/engine.ts
import Anthropic from "@anthropic-ai/sdk"
import {resolveModel, tuningForModel} from "@/features/research/model"
import type {EngineResult} from "@/features/research/types"

const SUBMIT_TOOL = "submit_findings"
const SYSTEM =
	"Jesteś asystentem researchu B2B. Zbierz wymagane informacje o podmiocie (w razie potrzeby wyszukując w sieci), a następnie wywołaj narzędzie submit_findings z wynikami. Podawaj tylko zweryfikowane fakty; gdy czegoś nie ustalisz, pomiń pole. Nie zgaduj."

interface RunArgs {
	renderedPrompt: string
	inputSchema: object
	modelId: string | null
	webSearchEnabled: boolean
}

export async function runResearch({renderedPrompt, inputSchema, modelId, webSearchEnabled}: RunArgs): Promise<EngineResult> {
	if (!process.env.ANTHROPIC_API_KEY) return {ok: false, error: "Brak ANTHROPIC_API_KEY"}

	const client = new Anthropic()
	const model = resolveModel(modelId)

	const tools: unknown[] = [{name: SUBMIT_TOOL, description: "Zgłoś zebrane wyniki researchu zgodnie ze schematem.", input_schema: inputSchema, strict: true}]
	if (webSearchEnabled) {
		tools.push({type: "web_search_20260209", name: "web_search"})
		tools.push({type: "web_fetch_20260209", name: "web_fetch"})
	}

	const messages: Anthropic.Messages.MessageParam[] = [{role: "user", content: renderedPrompt}]

	try {
		for (let i = 0; i < 12; i++) {
			const res = await client.messages.create({
				model,
				max_tokens: 16000,
				system: SYSTEM,
				tools: tools as Anthropic.Messages.ToolUnion[],
				messages,
				...tuningForModel(model),
			})

			const submit = res.content.find((b) => b.type === "tool_use" && b.name === SUBMIT_TOOL)
			if (submit && submit.type === "tool_use") {
				return {ok: true, findings: (submit.input ?? {}) as Record<string, unknown>}
			}
			if (res.stop_reason === "end_turn") return {ok: false, error: "Model nie zwrócił wyników (brak submit_findings)"}
			// pause_turn (server-side web_search/web_fetch loop hit its limit) or any other stop:
			// append the assistant turn and re-send so the server-side tool loop resumes.
			messages.push({role: "assistant", content: res.content})
		}
		return {ok: false, error: "Przekroczono limit iteracji researchu"}
	} catch (e) {
		return {ok: false, error: e instanceof Error ? e.message : "Błąd API"}
	}
}
