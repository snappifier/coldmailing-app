export interface RenderLead {
	organizationName: string
	contactPersonName: string | null
	city: string | null
	website: string | null
	aiHook: string | null
	honorific: "PAN" | "PANI" | null
	customFields: Record<string, unknown> | null
}

export interface RenderPlaceholder {
	key: string
	source: string | null
	fallback: string | null
}

export interface RenderContext {
	lead: RenderLead
	senderName: string
	placeholders: RenderPlaceholder[]
}

export interface RenderResult {
	rendered: string
	missing: string[]
}

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g
const BUILTIN_KEYS = new Set(["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"])

function resolveBuiltin(key: string, ctx: RenderContext): string | null {
	const {lead, senderName} = ctx
	if (key === "nazwaPlacowki") return lead.organizationName || null
	if (key === "osoba") return lead.contactPersonName
	if (key === "miasto") return lead.city
	if (key === "www") return lead.website
	if (key === "hookAI") return lead.aiHook
	if (key === "podpisNadawcy") return senderName || null
	if (key === "zwrot") return lead.honorific === "PAN" ? "Pan" : lead.honorific === "PANI" ? "Pani" : null
	return null
}

export function renderTemplate(text: string, ctx: RenderContext): RenderResult {
	const missing: string[] = []
	const rendered = text.replace(TOKEN_RE, (_full, rawInner: string) => {
		const inner = rawInner.trim()

		if (inner.includes("|")) {
			const parts = inner.split("|").map((s) => s.trim())
			const masc = parts[0] ?? ""
			const fem = parts[1] ?? ""
			if (ctx.lead.honorific === "PAN") return masc
			if (ctx.lead.honorific === "PANI") return fem
			missing.push(inner)
			return masc
		}

		if (BUILTIN_KEYS.has(inner)) {
			const value = resolveBuiltin(inner, ctx)
			if (value) return value
			missing.push(inner)
			return `[brak: ${inner}]`
		}

		const ph = ctx.placeholders.find((p) => p.key === inner)
		if (ph) {
			const raw = ctx.lead.customFields?.[ph.source ?? ph.key]
			const value = raw === null || raw === undefined || raw === "" ? null : String(raw)
			if (value) return value
			if (ph.fallback) return ph.fallback
			missing.push(inner)
			return `[brak: ${inner}]`
		}

		missing.push(inner)
		return `[brak: ${inner}]`
	})
	return {rendered, missing}
}
