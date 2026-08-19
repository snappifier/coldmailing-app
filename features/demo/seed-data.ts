import type {DealStage, Honorific, LeadActivityKind} from "@/generated/prisma/client"

export const DEMO_EMAIL_SUFFIX = ".demo.pl"
export const DEMO_NAME_SUFFIX = " (demo)"
export const DEMO_KEY_PREFIX = "demo_"

// Deterministic PRNG so every seed run produces the same dataset.
let state = 42
export function resetRng() {
	state = 42
}
function rnd() {
	state = (state * 1103515245 + 12345) % 2147483648
	return state / 2147483648
}
function pick<T>(arr: T[]): T {
	return arr[Math.floor(rnd() * arr.length)]
}
function int(min: number, max: number) {
	return min + Math.floor(rnd() * (max - min + 1))
}

const STEMS = [
	"Stalmet", "Drewpol", "Elektro-Bud", "Termoplast", "Aquatech", "Logistar", "Meblomax", "Grawerton", "Instalex", "Betoniarnia Piast",
	"Okna Sudety", "Dachpol", "Klimatext", "Autoserwis Orlik", "Piekarnia Złoty Kłos", "Hurtownia Delta", "Ogrodnictwo Flora", "Drukarnia Kolor",
	"Transkop", "Metaloplastyka Wit", "Kamieniarstwo Skała", "Cukiernia Marcelina", "Fotowoltaika Sun", "Geodezja Azymut", "Weterynaria Reks",
	"Studio Fryzur Iza",
]
const FORMS = ["Sp. z o.o.", "S.A.", "s.c.", ""]
const CITIES = ["Kraków", "Warszawa", "Wrocław", "Poznań", "Gdańsk", "Katowice", "Rzeszów", "Lublin", "Łódź", "Szczecin", "Tarnów", "Nowy Sącz"]
const FIRST_M = ["Marek", "Tomasz", "Piotr", "Andrzej", "Krzysztof", "Paweł", "Michał", "Jacek", "Grzegorz", "Rafał"]
const FIRST_F = ["Anna", "Katarzyna", "Magdalena", "Agnieszka", "Joanna", "Beata", "Ewa", "Monika", "Iwona", "Dorota"]
const LAST = ["Nowak", "Kowalski", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Woźniak", "Dąbrowski", "Kozłowski", "Jankowski", "Mazur", "Krawczyk", "Piotrowski", "Grabowski", "Zając", "Pawłowski", "Michalski"]
const ROLES = ["Właściciel", "Prezes", "Dyrektor handlowy", "Kierownik marketingu", "Manager sprzedaży", "Współwłaściciel"]
const HOOKS = [
	"Strona nie ma wersji mobilnej — realna utrata ruchu z telefonów.",
	"Brak zakładki z cennikiem; konkurencja z regionu ją ma.",
	"Ostatni wpis w aktualnościach sprzed dwóch lat.",
	"Formularz kontaktowy zwraca błąd 500.",
	"Wysokie oceny w Google, ale strona ich nie eksponuje.",
	"Konkurent z sąsiedniej ulicy właśnie wdrożył sklep online.",
]

function slugify(s: string) {
	const map: Record<string, string> = {ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z"}
	return s
		.toLowerCase()
		.replace(/[ąćęłńóśźż]/g, (ch) => map[ch] ?? ch)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
}

// Funnel spread: bulk NEW, thinning toward WON/LOST.
const STAGE_PLAN: [DealStage, number][] = [
	["NEW", 18],
	["AUDIT", 8],
	["PROPOSAL", 7],
	["MEETING", 6],
	["OFFER", 5],
	["WON", 4],
	["LOST", 4],
]

export interface DemoLead {
	organizationName: string
	website: string
	contactPersonName: string
	contactRole: string
	email: string
	phone: string
	city: string
	honorific: Honorific
	siteQuality: number
	score: number
	priority: number
	aiHook: string | null
	dealStage: DealStage
	source: string
}

export function buildDemoLeads(): DemoLead[] {
	resetRng()
	const leads: DemoLead[] = []
	let i = 0
	for (const [stage, count] of STAGE_PLAN) {
		for (let k = 0; k < count; k++) {
			const stem = STEMS[i % STEMS.length]
			const form = FORMS[i % FORMS.length]
			const name = form ? `${stem} ${form}` : stem
			const female = rnd() < 0.4
			const first = female ? pick(FIRST_F) : pick(FIRST_M)
			let last = pick(LAST)
			if (female && last.endsWith("ski")) last = last.slice(0, -1) + "a"
			const slug = slugify(stem) + (i >= STEMS.length ? `-${Math.floor(i / STEMS.length) + 1}` : "")
			const score = stage === "WON" ? int(75, 95) : stage === "LOST" ? int(20, 45) : int(35, 90)
			leads.push({
				organizationName: name,
				website: `https://www.${slug}.pl`,
				contactPersonName: `${first} ${last}`,
				contactRole: pick(ROLES),
				email: `biuro@${slug}${DEMO_EMAIL_SUFFIX}`,
				phone: `+48 ${int(500, 799)} ${int(100, 999)} ${int(100, 999)}`,
				city: pick(CITIES),
				honorific: female ? "PANI" : "PAN",
				siteQuality: int(1, 5),
				score,
				priority: score >= 75 ? int(4, 5) : score >= 50 ? int(2, 4) : int(1, 2),
				aiHook: rnd() < 0.45 ? pick(HOOKS) : null,
				dealStage: stage,
				source: "demo",
			})
			i++
		}
	}
	return leads
}

export const DEMO_OFFERING_LINES = [
	{name: `Strony internetowe${DEMO_NAME_SUFFIX}`, description: "Projekt i wdrożenie stron firmowych"},
	{name: `Sklepy e-commerce${DEMO_NAME_SUFFIX}`, description: "Sklepy internetowe z integracjami płatności"},
	{name: `Automatyzacje AI${DEMO_NAME_SUFFIX}`, description: "Chatboty i automatyzacja obsługi klienta"},
]

export const DEMO_TEMPLATES = [
	{
		name: `Intro — audyt strony${DEMO_NAME_SUFFIX}`,
		subject: "Krótka uwaga o stronie {{nazwaFirmy}}",
		body: "{{zwrot}},\n\nprzeglądałem stronę {{nazwaFirmy}} i zwróciłem uwagę na kilka rzeczy, które mogą kosztować Państwa zapytania z Google.\n\nPrzygotowałem krótki audyt — mogę go przesłać w odpowiedzi na tego maila. Czy to temat, który jest teraz u Państwa na stole?\n\nPozdrawiam\n{{podpisNadawcy}}",
		isFollowup: false,
	},
	{
		name: `Follow-up 1 — audyt${DEMO_NAME_SUFFIX}`,
		subject: "Re: Krótka uwaga o stronie {{nazwaFirmy}}",
		body: "{{zwrot}},\n\nwracam z pytaniem, czy mieli Państwo okazję zerknąć na poprzednią wiadomość. Audyt mam gotowy — wystarczy krótka odpowiedź.\n\nPozdrawiam\n{{podpisNadawcy}}",
		isFollowup: true,
	},
	{
		name: `Intro — sklep online${DEMO_NAME_SUFFIX}`,
		subject: "Sklep internetowy dla {{nazwaFirmy}}?",
		body: "{{zwrot}},\n\ncoraz więcej firm z Państwa branży sprzedaje online. Robimy sklepy, które zwracają się średnio w 6 miesięcy — mogę pokazać dwa wdrożenia z regionu.\n\nCzy 15-minutowa rozmowa w przyszłym tygodniu ma sens?\n\nPozdrawiam\n{{podpisNadawcy}}",
		isFollowup: false,
	},
	{
		name: `Follow-up — sklep${DEMO_NAME_SUFFIX}`,
		subject: "Re: Sklep internetowy dla {{nazwaFirmy}}?",
		body: "{{zwrot}},\n\nkrótki follow-up do poprzedniej wiadomości — jeśli temat sklepu wróci za kwartał, też chętnie porozmawiam. Wystarczy jedno zdanie zwrotne.\n\nPozdrawiam\n{{podpisNadawcy}}",
		isFollowup: true,
	},
]

export const DEMO_PLACEHOLDERS = [
	{key: `${DEMO_KEY_PREFIX}oferta`, label: "Skrót oferty (demo)", type: "TEXT" as const, fallback: "audyt strony WWW"},
	{key: `${DEMO_KEY_PREFIX}region`, label: "Region kampanii (demo)", type: "CHOICE" as const, options: ["Małopolska", "Mazowsze", "Śląsk"], fallback: "Małopolska"},
]

export const DEMO_CAMPAIGNS = [
	{name: `Strony WWW — Małopolska Q3${DEMO_NAME_SUFFIX}`, status: "ACTIVE" as const},
	{name: `E-commerce — jesień${DEMO_NAME_SUFFIX}`, status: "PAUSED" as const},
	{name: `Automatyzacje — pilotaż${DEMO_NAME_SUFFIX}`, status: "DRAFT" as const},
]

export const DEMO_SUPPRESSIONS = [
	{email: `kontakt@rezygnacja${DEMO_EMAIL_SUFFIX}`, reason: "UNSUBSCRIBED" as const},
	{email: `biuro@zwrot-twardy${DEMO_EMAIL_SUFFIX}`, reason: "BOUNCED" as const},
	{email: `info@nie-kontaktowac${DEMO_EMAIL_SUFFIX}`, reason: "MANUAL" as const},
]

export interface DemoActivity {
	leadIndex: number
	kind: LeadActivityKind
	body: string | null
	fromStage: DealStage | null
	toStage: DealStage | null
	daysAgo: number
}

export const DEMO_ACTIVITIES: DemoActivity[] = [
	{leadIndex: 26, kind: "NOTE", body: "Prosili o kontakt po 15-tym, wraca temat budżetu.", fromStage: null, toStage: null, daysAgo: 6},
	{leadIndex: 26, kind: "STAGE_CHANGE", body: null, fromStage: "NEW", toStage: "AUDIT", daysAgo: 9},
	{leadIndex: 27, kind: "CALL", body: "Rozmowa 20 min — zainteresowani audytem, decyzja po urlopie prezesa.", fromStage: null, toStage: null, daysAgo: 4},
	{leadIndex: 28, kind: "NOTE", body: "Strona faktycznie bez wersji mobilnej, screeny w załączniku oferty.", fromStage: null, toStage: null, daysAgo: 11},
	{leadIndex: 34, kind: "STAGE_CHANGE", body: null, fromStage: "AUDIT", toStage: "PROPOSAL", daysAgo: 7},
	{leadIndex: 35, kind: "MEETING", body: "Spotkanie online — pokazany audyt, pytali o utrzymanie po wdrożeniu.", fromStage: null, toStage: null, daysAgo: 3},
	{leadIndex: 41, kind: "MEETING", body: "Spotkanie w siedzibie klienta, dobre wrażenie, czekają na wycenę.", fromStage: null, toStage: null, daysAgo: 5},
	{leadIndex: 42, kind: "STAGE_CHANGE", body: null, fromStage: "MEETING", toStage: "OFFER", daysAgo: 2},
	{leadIndex: 47, kind: "OFFER_SENT", body: "Oferta 12 400 zł netto, ważna 30 dni.", fromStage: null, toStage: null, daysAgo: 8},
	{leadIndex: 44, kind: "STAGE_CHANGE", body: null, fromStage: "OFFER", toStage: "WON", daysAgo: 1},
	{leadIndex: 44, kind: "NOTE", body: "Umowa podpisana, start wdrożenia w przyszłym miesiącu.", fromStage: null, toStage: null, daysAgo: 1},
	{leadIndex: 50, kind: "STAGE_CHANGE", body: null, fromStage: "OFFER", toStage: "LOST", daysAgo: 10},
	{leadIndex: 50, kind: "NOTE", body: "Wybrali tańszą ofertę lokalnej agencji.", fromStage: null, toStage: null, daysAgo: 10},
	{leadIndex: 3, kind: "NOTE", body: "Ciekawy profil — duży potencjał na sklep, wrócić w Q4.", fromStage: null, toStage: null, daysAgo: 13},
]

// Outbound sends spread over the last `days` calendar days: weekdays 2-4, weekends 0-1.
export function buildSendPlan(days = 30): number[] {
	resetRng()
	const plan: number[] = []
	const now = new Date()
	for (let d = days - 1; d >= 0; d--) {
		const date = new Date(now.getTime() - d * 86_400_000)
		const dow = date.getDay()
		const weekend = dow === 0 || dow === 6
		const count = weekend ? int(0, 1) : int(2, 4)
		for (let k = 0; k < count; k++) plan.push(d)
	}
	return plan
}
