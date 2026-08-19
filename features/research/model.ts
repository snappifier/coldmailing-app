export const DEFAULT_RESEARCH_MODEL = "claude-opus-4-8"

export function resolveModel(modelId: string | null | undefined): string {
	return modelId && modelId.trim() ? modelId : DEFAULT_RESEARCH_MODEL
}

// effort + adaptive thinking are supported on opus/sonnet 4.6+, but 400 on haiku-4-5 -> gate them.
export function tuningForModel(model: string): {thinking?: {type: "adaptive"}; output_config?: {effort: "high"}} {
	const supports = model.startsWith("claude-opus") || model.startsWith("claude-sonnet")
	if (!supports) return {}
	return {thinking: {type: "adaptive"}, output_config: {effort: "high"}}
}
