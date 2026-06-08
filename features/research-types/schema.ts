// features/research-types/schema.ts
import {z} from "zod"
import {CUSTOM_TYPES, RESERVED_KEYS, TARGET_OPTIONS, derivedTypeForTarget, type Target} from "@/features/research-types/targets"

const FIELD_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "EMAIL", "ENUM", "GENDER"] as const

const outputFieldSchema = z
	.object({
		key: z
			.string()
			.trim()
			.min(1, "Podaj klucz pola")
			.max(40)
			.regex(/^[A-Za-z][A-Za-z0-9]*$/, "Klucz: litery i cyfry, bez spacji, zaczyna się literą"),
		label: z.string().trim().min(1, "Podaj etykietę pola").max(80),
		target: z.enum(TARGET_OPTIONS as [string, ...string[]]),
		type: z.enum(FIELD_TYPES),
		required: z.boolean().default(false),
		description: z
			.string()
			.trim()
			.max(300)
			.optional()
			.transform((v) => (v ? v : null)),
	})
	.refine((f) => f.target !== "CUSTOM" || !RESERVED_KEYS.has(f.key), {
		message: "Ten klucz jest zarezerwowany (wbudowany placeholder)",
		path: ["key"],
	})
	.refine(
		(f) => {
			if (f.target === "CUSTOM") return (CUSTOM_TYPES as readonly string[]).includes(f.type)
			return f.type === derivedTypeForTarget(f.target as Target)
		},
		{message: "Typ pola nie zgadza się z wybranym celem", path: ["type"]},
	)

export const researchTypeSchema = z
	.object({
		name: z.string().trim().min(1, "Podaj nazwę").max(120),
		prompt: z.string().trim().min(1, "Podaj prompt").max(8000),
		modelId: z
			.string()
			.trim()
			.max(80)
			.optional()
			.transform((v) => (v ? v : null)),
		webSearchEnabled: z.boolean().default(false),
		kind: z.enum(["RESEARCH", "SCORING", "CONTENT"]).default("RESEARCH"),
		outputFields: z.array(outputFieldSchema).min(1, "Dodaj co najmniej jedno pole wyjściowe"),
	})
	.refine((d) => new Set(d.outputFields.map((f) => f.key)).size === d.outputFields.length, {
		message: "Klucze pól muszą być unikalne",
		path: ["outputFields"],
	})
	.refine(
		(d) => {
			const targets = d.outputFields.filter((f) => f.target !== "CUSTOM").map((f) => f.target)
			return new Set(targets).size === targets.length
		},
		{message: "Każde pole Lead można zmapować tylko raz", path: ["outputFields"]},
	)
	.refine((d) => d.kind !== "SCORING" || d.outputFields.some((f) => f.target === "score"), {
		message: "Typ oceny musi mieć pole z celem 'score'",
		path: ["outputFields"],
	})
	.refine((d) => d.kind !== "CONTENT" || d.outputFields.some((f) => f.target === "aiHook" || f.target === "CUSTOM"), {
		message: "Typ treści musi mieć pole z celem 'aiHook' lub pole własne (CUSTOM)",
		path: ["outputFields"],
	})

export type OutputField = z.infer<typeof outputFieldSchema>
export type ResearchTypeInput = z.infer<typeof researchTypeSchema>
