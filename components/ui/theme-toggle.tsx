"use client"
import {SunIcon, MoonIcon} from "@/components/ui/icons"

export function ThemeToggle() {
	function toggle() {
		const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"
		document.documentElement.dataset.theme = next
		try { localStorage.setItem("theme", next) } catch { /* ignore */ }
	}
	// Icon swap is CSS-driven via the dark: variant — no state, no hydration mismatch.
	return (
		<button type="button" onClick={toggle} aria-label="Przełącz motyw" className="grid size-[30px] place-items-center rounded-md border border-border bg-surface-1 text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
			<SunIcon className="size-[15px] dark:hidden" />
			<MoonIcon className="hidden size-[15px] dark:block" />
		</button>
	)
}
