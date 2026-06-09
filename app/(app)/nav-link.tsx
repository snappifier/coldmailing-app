"use client"
// app/(app)/nav-link.tsx
import Link from "next/link"
import {usePathname} from "next/navigation"
import {cn} from "@/lib/cn"

export function NavLink({href, children}: {href: string; children: React.ReactNode}) {
	const pathname = usePathname()
	const active = pathname === href || pathname.startsWith(href + "/")
	return (
		<Link href={href} aria-current={active ? "page" : undefined} className={cn("rounded-md px-2 py-1 text-sm transition-colors duration-150", active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg")}>
			{children}
		</Link>
	)
}