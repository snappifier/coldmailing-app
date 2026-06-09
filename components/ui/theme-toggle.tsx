"use client"
// components/ui/theme-toggle.tsx
import {useEffect, useState} from "react"
import {SunIcon, MoonIcon} from "@/components/ui/icons"

export function ThemeToggle() {
	const [theme, setTheme] = useState<"light" | "dark">("light")
	useEffect(() => {
		const t = document.documentElement.dataset.theme
		setTheme(t === "dark" ? "dark" : "light")
	}, [])
	function toggle() {
		const next = theme === "dark" ? "light" : "dark"
		document.documentElement.dataset.theme = next
		try { localStorage.setItem("theme", next) } catch {}
		setTheme(next)
	}
	return (
		<button type="button" onClick={toggle} aria-label="Przełącz motyw" className="grid size-[30px] place-items-center rounded-md border border-border bg-surface-1 text-fg-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
			{theme === "dark" ? <MoonIcon className="size-[15px]" /> : <SunIcon className="size-[15px]" />}
		</button>
	)
}