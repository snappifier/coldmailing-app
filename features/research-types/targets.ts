
// Lead columns a research output field may write to; the value type is derived from the column.
export const LEAD_TARGETS = {
	contactPersonName: "TEXT",
	contactRole: "TEXT",
	honorific: "GENDER",
	aiHook: "TEXT",
	aiNotes: "TEXT",
	siteQuality: "NUMBER",
	priority: "NUMBER",
	score: "NUMBER",
	city: "TEXT",
	region: "TEXT",
	schoolType: "TEXT",
	email: "EMAIL",
} as const

export type LeadTarget = keyof typeof LEAD_TARGETS
export type Target = LeadTarget | "CUSTOM"
export type FieldType = "TEXT" | "NUMBER" | "BOOLEAN" | "EMAIL" | "ENUM" | "GENDER"

// Types a CUSTOM (customFields[key]) output may use. GENDER is reserved for honorific only.
export const CUSTOM_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "EMAIL", "ENUM"] as const

// Builtin placeholder keys (features/templates/render.ts) a CUSTOM key must not shadow.
export const RESERVED_KEYS = new Set(["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"])

export const TARGET_OPTIONS: Target[] = [...(Object.keys(LEAD_TARGETS) as LeadTarget[]), "CUSTOM"]

export function derivedTypeForTarget(target: Target): FieldType | null {
	if (target === "CUSTOM") return null
	return LEAD_TARGETS[target]
}
