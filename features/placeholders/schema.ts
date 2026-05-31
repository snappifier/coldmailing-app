// features/placeholders/schema.ts
import {z} from "zod"

const RESERVED_KEYS = new Set(["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"])

export const placeholderSchema = z
	.object({
		key: z
			.string()
			.trim()
			.min(1, "Podaj klucz")
			.max(40)
			.regex(/^[A-Za-z][A-Za-z0-9]*$/, "Klucz: litery i cyfry, bez spacji, zaczyna się literą"),
		label: z.string().trim().min(1, "Podaj etykietę").max(80),
		type: z.enum(["TEXT", "CHOICE"]),
		options: z
			.string()
			.trim()
			.optional()
			.transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null)),
		fallback: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
		source: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
	})
	.refine((d) => !RESERVED_KEYS.has(d.key), {message: "Ten klucz jest zarezerwowany (wbudowany placeholder)", path: ["key"]})

export type PlaceholderInput = z.infer<typeof placeholderSchema>
