// features/replies/optout/llm.ts
import Anthropic from "@anthropic-ai/sdk"
import type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

const SYSTEM =
	"Jestes klasyfikatorem odpowiedzi na cold-mail B2B po polsku. Oceniasz, czy nadawca prosi o zaprzestanie kontaktu lub jednoznacznie nie jest zainteresowany. Odpowiadasz WYLACZNIE jednym obiektem JSON: {\"optOut\": boolean, \"score\": number od 0 do 1}."

export const llmDetector: OptOutDetector = {
	async detect(text: string): Promise<OptOutResult> {
		if (!process.env.ANTHROPIC_API_KEY) return {optOut: false, score: 0}
		try {
			const client = new Anthropic()
			const res = await client.messages.create({
				model: "claude-haiku-4-5",
				max_tokens: 64,
				system: SYSTEM,
				messages: [{role: "user", content: text.slice(0, 4000)}],
			})
			const block = res.content.find((b) => b.type === "text")
			const raw = block && block.type === "text" ? block.text : "{}"
			const parsed = JSON.parse(raw) as {optOut?: boolean; score?: number}
			const optOut = Boolean(parsed.optOut)
			return {optOut, score: typeof parsed.score === "number" ? parsed.score : optOut ? 1 : 0}
		} catch {
			return {optOut: false, score: 0}
		}
	},
}
