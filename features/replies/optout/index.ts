// features/replies/optout/index.ts
import type {OptOutDetector} from "@/features/replies/optout/types"
import {keywordDetector} from "@/features/replies/optout/keyword"
import {llmDetector} from "@/features/replies/optout/llm"

export type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

export function getDetector(kind: "KEYWORD" | "LLM"): OptOutDetector {
	return kind === "LLM" ? llmDetector : keywordDetector
}
