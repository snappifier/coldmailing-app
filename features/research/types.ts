// features/research/types.ts
export type ResearchFindings = Record<string, unknown>

export interface AppliedField {
	key: string
	target: string
	label: string
	value: string | number | null
}
export interface ProposedField extends AppliedField {
	current: string | number | null
}
export interface SkippedField {
	key: string
	label: string
	reason: string
}
export interface ResearchDiff {
	applied: AppliedField[]
	proposed: ProposedField[]
	skipped: SkippedField[]
}
export type EngineResult = {ok: true; findings: ResearchFindings} | {ok: false; error: string}
