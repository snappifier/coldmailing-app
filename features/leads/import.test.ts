// features/leads/import.test.ts
import {describe, it, expect} from "vitest"
import {detectDelimiter, splitRow, parseTable, normalizeEmail, normalizeWebsite, parseHonorific, mapRowsToLeads, buildImportSpec, defaultCustomKey} from "@/features/leads/import"

describe("detectDelimiter", () => {
	it("prefers tab, then semicolon, then comma", () => {
		expect(detectDelimiter("a\tb\tc")).toBe("\t")
		expect(detectDelimiter("a;b;c")).toBe(";")
		expect(detectDelimiter("a,b,c")).toBe(",")
	})
})

describe("splitRow", () => {
	it("splits plain cells", () => {
		expect(splitRow("a,b,c", ",")).toEqual(["a", "b", "c"])
	})
	it("respects double-quoted cells containing the delimiter", () => {
		expect(splitRow('"Kowalski, Jan",x', ",")).toEqual(["Kowalski, Jan", "x"])
	})
})

describe("parseTable", () => {
	it("parses rows and ignores blank lines", () => {
		expect(parseTable("a,b\n1,2\n\n3,4")).toEqual([
			["a", "b"],
			["1", "2"],
			["3", "4"],
		])
	})
})

describe("normalizeEmail", () => {
	it("lowercases and trims", () => {
		expect(normalizeEmail("  Foo@Bar.PL ")).toBe("foo@bar.pl")
	})
	it("returns null for empty/invalid", () => {
		expect(normalizeEmail("   ")).toBeNull()
		expect(normalizeEmail("not-an-email")).toBeNull()
	})
})

describe("normalizeWebsite", () => {
	it("adds https and strips trailing slash", () => {
		expect(normalizeWebsite("example.pl/")).toBe("https://example.pl")
		expect(normalizeWebsite("http://x.pl")).toBe("http://x.pl")
	})
	it("returns null for empty", () => {
		expect(normalizeWebsite("")).toBeNull()
	})
})

describe("parseHonorific", () => {
	it("maps common forms", () => {
		expect(parseHonorific("Pan")).toBe("PAN")
		expect(parseHonorific("pani")).toBe("PANI")
		expect(parseHonorific("")).toBeNull()
		expect(parseHonorific("xyz")).toBeNull()
	})
})

describe("mapRowsToLeads", () => {
	const rows = [
		["Nazwa", "Email", "WWW", "Zwrot"],
		["I LO Zamość", "Sekretariat@1lo.com.pl", "1lo.com.pl", "Pani"],
		["", "brak", "", ""],
	]
	const mapping = {organizationName: 0, email: 1, website: 2, honorific: 3}

	it("maps with header row skipped and normalizes fields", () => {
		const leads = mapRowsToLeads(rows, mapping, {hasHeader: true})
		expect(leads).toHaveLength(1) // second data row dropped: no organizationName
		expect(leads[0]).toMatchObject({
			organizationName: "I LO Zamość",
			email: "sekretariat@1lo.com.pl",
			website: "https://1lo.com.pl",
			honorific: "PANI",
		})
	})

	it("requires organizationName (drops rows without it)", () => {
		const leads = mapRowsToLeads([["", "a@b.pl"]], {organizationName: 0, email: 1}, {hasHeader: false})
		expect(leads).toHaveLength(0)
	})
})

describe("buildImportSpec", () => {
	it("maps known fields (last column wins) and collects custom columns", () => {
		const spec = buildImportSpec([
			{kind: "field", field: "organizationName"},
			{kind: "field", field: "email"},
			{kind: "custom", key: "liczba_uczniow"},
			{kind: "ignore"},
			{kind: "field", field: "email"},
		])
		expect(spec.mapping).toEqual({organizationName: 0, email: 4})
		expect(spec.customColumns).toEqual([{index: 2, key: "liczba_uczniow"}])
	})
	it("drops custom columns with an empty/whitespace key and trims keys", () => {
		const spec = buildImportSpec([{kind: "custom", key: "  "}, {kind: "custom", key: " patron "}])
		expect(spec.customColumns).toEqual([{index: 1, key: "patron"}])
	})
})

describe("mapRowsToLeads with customColumns", () => {
	const rows = [
		["Nazwa", "Email", "Liczba", "Patron"],
		["LO Rej", "a@b.pl", "612", "M. Rej"],
		["ZSP 3", "c@d.pl", "", ""],
	]
	it("builds customFields and skips empty cells", () => {
		const leads = mapRowsToLeads(rows, {organizationName: 0, email: 1}, {
			hasHeader: true,
			customColumns: [{index: 2, key: "liczba"}, {index: 3, key: "patron"}],
		})
		expect(leads[0].customFields).toEqual({liczba: "612", patron: "M. Rej"})
		expect(leads[1].customFields).toBeNull()
	})
	it("sets customFields null when no customColumns", () => {
		const leads = mapRowsToLeads(rows, {organizationName: 0}, {hasHeader: true})
		expect(leads[0].customFields).toBeNull()
	})
})

describe("defaultCustomKey", () => {
	it("uses the trimmed header, else kolumna_N", () => {
		expect(defaultCustomKey("  Liczba uczniów ", 3)).toBe("Liczba uczniów")
		expect(defaultCustomKey(null, 3)).toBe("kolumna_4")
		expect(defaultCustomKey("", 0)).toBe("kolumna_1")
	})
})
