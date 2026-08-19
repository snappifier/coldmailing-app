export interface ScoreFields {
	score: number | null
	priority: number | null
	siteQuality: number | null
	aiHook: string | null
	aiNotes: string | null
}

function clampInt(raw: string | null, min: number, max: number): number | null {
	const s = String(raw ?? "").trim()
	if (!s) return null
	const n = Number(s)
	if (!Number.isFinite(n)) return null
	return Math.max(min, Math.min(max, Math.round(n)))
}

function text(raw: string | null): string | null {
	const s = String(raw ?? "").trim()
	return s ? s : null
}

export function parseScoreFields(get: (name: string) => string | null): ScoreFields {
	return {
		score: clampInt(get("score"), 0, 100),
		priority: clampInt(get("priority"), 1, 5),
		siteQuality: clampInt(get("siteQuality"), 1, 5),
		aiHook: text(get("aiHook")),
		aiNotes: text(get("aiNotes")),
	}
}
