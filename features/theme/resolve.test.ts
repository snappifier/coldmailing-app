// features/theme/resolve.test.ts
import {describe, it, expect} from "vitest"
import {resolveInitialTheme} from "@/features/theme/resolve"

describe("resolveInitialTheme", () => {
	it("uses a valid stored theme", () => {
		expect(resolveInitialTheme("dark")).toBe("dark")
		expect(resolveInitialTheme("light")).toBe("light")
	})
	it("defaults to light during migration when nothing is stored", () => {
		expect(resolveInitialTheme(null)).toBe("light")
		expect(resolveInitialTheme("bogus")).toBe("light")
	})
})
