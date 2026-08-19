
export type DraftDecision = "template" | "draft" | "wait"

export interface DraftForSend {
	status: string
	subject: string
	body: string
}

// Pure: choose the content source for a sequence step.
// - flag off            -> render the template (unchanged behavior)
// - flag on + ready      -> send the lead's draft verbatim
// - flag on + not ready  -> wait for the draft to become ready
export function resolveDraftDecision(useLeadDraft: boolean, draft: DraftForSend | null): DraftDecision {
	if (!useLeadDraft) return "template"
	if (draft && draft.status === "DONE" && draft.subject.trim() !== "" && draft.body.trim() !== "") return "draft"
	return "wait"
}
