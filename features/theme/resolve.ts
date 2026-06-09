// features/theme/resolve.ts
export type Theme = "light" | "dark"

// Default LIGHT during Phase 7 migration so un-converted pages stay readable.
// Flip to "dark" (or prefers-color-scheme) once page-level-visual-pass lands.
export function resolveInitialTheme(stored: string | null): Theme {
	return stored === "dark" || stored === "light" ? stored : "light"
}
