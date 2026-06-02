// features/replies/optout/keyword.ts
import type {OptOutDetector, OptOutResult} from "@/features/replies/optout/types"

// NOTE: substring match with no negation parsing -- e.g. "prosze nie pisac po angielsku" falsely
// matches "nie pisac". Acceptable in SUGGEST mode (a human reviews the badge); the LLM detector is
// the path to fewer false positives. Short bare stems ("wypisz", "nie pisac") carry this risk.
// All entries are pre-normalized (lowercase, no diacritics, l for the Polish stroked-l).
const PHRASES = [
	"nie jestem zainteresowany",
	"nie jestesmy zainteresowani",
	"nie zainteresowany",
	"prosze nie wysylac",
	"prosze o niekontaktowanie",
	"nie piszcie",
	"nie pisac",
	"rezygnuj",
	"prosze usunac",
	"usuncie mnie",
	"wypisz",
	"odczepcie sie",
	"unsubscribe",
]

// Lowercase, strip combining diacritics, and map the Polish stroked-l (not decomposed by NFD).
function normalize(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/ł/g, "l")
}

export const keywordDetector: OptOutDetector = {
	async detect(text: string): Promise<OptOutResult> {
		const n = normalize(text)
		const optOut = PHRASES.some((p) => n.includes(p))
		return {optOut, score: optOut ? 1 : 0}
	},
}
