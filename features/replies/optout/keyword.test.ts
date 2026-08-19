import {describe, it, expect} from "vitest"
import {keywordDetector} from "@/features/replies/optout/keyword"

describe("keywordDetector", () => {
	it("detects an explicit opt-out (diacritics + caps)", async () => {
		expect((await keywordDetector.detect("Nie jestem zainteresowany, dziekuje")).optOut).toBe(true)
	})
	it("detects 'prosze usunac' with Polish letters", async () => {
		expect((await keywordDetector.detect("Proszę usunąć mnie z listy")).optOut).toBe(true)
	})
	it("detects 'rezygnuje' (stem match)", async () => {
		expect((await keywordDetector.detect("Rezygnuję z oferty")).optOut).toBe(true)
	})
	it("does not flag an interested reply", async () => {
		expect((await keywordDetector.detect("Bardzo interesująca oferta, porozmawiajmy")).optOut).toBe(false)
	})
	it("score is 1 on hit, 0 on miss", async () => {
		expect((await keywordDetector.detect("wypisz")).score).toBe(1)
		expect((await keywordDetector.detect("dzien dobry")).score).toBe(0)
	})
})
