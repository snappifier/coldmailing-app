// features/leads/import.test.ts
import {describe, it, expect} from "vitest"
import {detectDelimiter, splitRow, parseTable, normalizeEmail, normalizeWebsite, parseHonorific, mapRowsToLeads} from "@/features/leads/import"

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
