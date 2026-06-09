// features/theme/resolve.ts
export type Theme = "light" | "dark"

// Default DARK: the dark-ready token migration is complete, so every page renders
// correctly in dark. A stored "light"/"dark" preference still wins.
export function resolveInitialTheme(stored: string | null): Theme {
	return stored === "dark" || stored === "light" ? stored : "dark"
}
