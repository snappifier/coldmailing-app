"use client"
// app/(app)/sidebar.tsx
import {useSyncExternalStore} from "react"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {cn} from "@/lib/cn"
import {isNavActive} from "@/features/nav/active"
import {signOutAction} from "@/features/auth/actions"
import {NAV_GROUPS, SETTINGS_ITEM, type NavItem} from "./nav-items"
import {ThemeToggle} from "@/components/ui/theme-toggle"
import {ChevronLeftIcon, LogOutIcon} from "@/components/ui/icons"

export interface SidebarUser {name: string | null; email: string | null; role: string; orgName: string}

// Tiny external store for the collapse flag: reads localStorage via useSyncExternalStore so the
// server snapshot is "expanded" (no hydration mismatch) and toggling notifies subscribers — no
// setState-in-effect.
const NAV_KEY = "nav-collapsed"
let navListeners: (() => void)[] = []
function subscribeNav(cb: () => void) {
	navListeners = [...navListeners, cb]
	return () => { navListeners = navListeners.filter((l) => l !== cb) }
}
function readNavCollapsed(): boolean {
	try { return localStorage.getItem(NAV_KEY) === "1" } catch { return false }
}
function setNavCollapsed(v: boolean) {
	try { localStorage.setItem(NAV_KEY, v ? "1" : "0") } catch { /* ignore */ }
	for (const l of navListeners) l()
}

function SideLink({item, active, labelCls}: {item: NavItem; active: boolean; labelCls: string}) {
	const {Icon} = item
	return (
		<Link
			className={cn(
				"relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
				active
					? "text-fg before:absolute before:-left-2 before:bottom-1.5 before:top-1.5 before:w-[3px] before:rounded-r before:bg-accent"
					: "text-fg-muted hover:bg-surface-2 hover:text-fg",
			)}
			href={item.href}
			title={item.label}
			aria-current={active ? "page" : undefined}
		>
			<Icon className={cn("size-[18px] flex-none", active && "text-accent")} />
			<span className={cn("truncate", labelCls)}>{item.label}</span>
		</Link>
	)
}

export function Sidebar({user}: {user: SidebarUser}) {
	const pathname = usePathname()
	const collapsed = useSyncExternalStore(subscribeNav, readNavCollapsed, () => false)
	const labelCls = collapsed ? "hidden" : "hidden lg:inline"
	const initials = (user.name ?? user.email ?? "?").trim().slice(0, 2).toUpperCase()

	return (
		<aside className={cn("sticky top-0 flex h-screen flex-none flex-col border-r border-border bg-surface-1 transition-[width] duration-200", collapsed ? "w-14" : "w-14 lg:w-[212px]")}>
			<Link className="flex h-[52px] flex-none items-center gap-2 px-4 text-[14px] font-bold tracking-[-0.02em]" href="/">
				<span className="text-accent">●</span>
				<span className={cn("truncate", labelCls)}>cold·mail</span>
			</Link>

			<nav className="flex-1 overflow-y-auto px-2 pb-2">
				{NAV_GROUPS.map((g) => (
					<div className="mt-3 first:mt-1" key={g.label}>
						<div className={cn("px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-faint", labelCls)}>{g.label}</div>
						<div className="flex flex-col gap-0.5">
							{g.items.map((item) => (
								<SideLink key={item.href} item={item} active={isNavActive(pathname, item.href)} labelCls={labelCls} />
							))}
						</div>
					</div>
				))}
			</nav>

			<div className="flex flex-col gap-1 border-t border-border p-2">
				<SideLink item={SETTINGS_ITEM} active={isNavActive(pathname, SETTINGS_ITEM.href)} labelCls={labelCls} />
				<button
					className="hidden items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:flex"
					type="button"
					onClick={() => setNavCollapsed(!collapsed)}
					aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
				>
					<ChevronLeftIcon className={cn("size-[18px] flex-none transition-transform", collapsed && "rotate-180")} />
					<span className={cn("truncate", labelCls)}>Zwiń</span>
				</button>

				<div className="flex items-center px-1 py-1">
					<ThemeToggle />
				</div>

				<details className="relative">
					<summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1.5 hover:bg-surface-2" aria-label="Menu konta">
						<span className="grid size-7 flex-none place-items-center rounded-full bg-accent text-[10px] font-bold text-primary-fg">{initials}</span>
						<span className={cn("min-w-0 flex-1 text-left", labelCls)}>
							<span className="block truncate text-xs font-semibold text-fg">{user.name ?? user.email ?? "—"}</span>
							<span className="block truncate text-[10px] text-fg-faint">{user.orgName} · {user.role}</span>
						</span>
					</summary>
					<div className="absolute bottom-full left-0 z-50 mb-2 w-60 rounded-lg border border-border-strong bg-surface-1 p-1.5 shadow-[0_12px_32px_-16px_rgba(0,0,0,.6)]">
						<div className="px-2 py-1.5">
							<div className="truncate text-sm font-semibold text-fg">{user.name ?? "—"}</div>
							<div className="truncate text-xs text-fg-muted">{user.email ?? ""}</div>
						</div>
						<div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
							<span className="truncate text-xs text-fg-muted">{user.orgName}</span>
							<span className="flex-none rounded-full border border-border-strong px-2 py-0.5 text-[10px] font-semibold text-fg-muted">{user.role}</span>
						</div>
						<form className="border-t border-border pt-1" action={signOutAction}>
							<button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg" type="submit">
								<LogOutIcon className="size-4 flex-none" /> Wyloguj
							</button>
						</form>
					</div>
				</details>
			</div>
		</aside>
	)
}
