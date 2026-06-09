# shell-and-nav-redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the flat top-bar nav with a left icon sidebar (variant C) that collapses to an icon-only rail, with grouped sections, per-item icons + active state, and an account menu surfacing user/org/role.

**Architecture:** A pure `isNavActive` helper (TDD), then ~13 stroke icons, then a `nav-items` config + a client `Sidebar` (collapse state + localStorage, account menu via native `<details>`), then a layout refactor that swaps the nav region for the sidebar and fetches the org name. No migration. Spec: `docs/superpowers/specs/2026-06-09-phase-7-shell-and-nav-redesign-design.md`.

**Tech Stack:** Next 16 (App Router, server + client components), React 19 (`usePathname`, `useState`/`useEffect`), Tailwind v4 tokens, next-auth `signOut`, Vitest 4, TypeScript 6.

**Conventions:** tabs, no semicolons, `"use client"` line 1 then path comment line 2, `className` first, `import {x}` no inner spaces, NO emoji. Reuse `cn` from `@/lib/cn`.

---

## Task 1: Pure active-state helper (TDD)

**Files:**
- Create: `features/nav/active.ts`
- Test: `features/nav/active.test.ts`

- [ ] **Step 1: Write the failing test** (`features/nav/active.test.ts`):

```ts
// features/nav/active.test.ts
import {describe, it, expect} from "vitest"
import {isNavActive} from "@/features/nav/active"

describe("isNavActive", () => {
	it("matches the home route only on exact /", () => {
		expect(isNavActive("/", "/")).toBe(true)
		expect(isNavActive("/leady", "/")).toBe(false)
	})
	it("matches a section and its sub-routes", () => {
		expect(isNavActive("/leady", "/leady")).toBe(true)
		expect(isNavActive("/leady/123", "/leady")).toBe(true)
		expect(isNavActive("/kampanie", "/leady")).toBe(false)
	})
})
```

- [ ] **Step 2: Run to verify it fails.** Run: `npx vitest run features/nav/active.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `features/nav/active.ts`:

```ts
// features/nav/active.ts
export function isNavActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(href + "/")
}
```
(For `href === "/"`, `pathname.startsWith("//")` is never true, so home is active only on exact `/`.)

- [ ] **Step 4: Run tests to verify they pass.** Run: `npx vitest run features/nav/active.test.ts` — Expected: PASS. Then `npx tsc --noEmit` — Expected: 0.
- [ ] **Step 5: Commit.**

```bash
git add features/nav/active.ts features/nav/active.test.ts
git commit -m "feat(phase7): pure isNavActive helper (TDD)"
```

---

## Task 2: Section icons

**Files:**
- Modify: `components/ui/icons.tsx`

- [ ] **Step 1: Append these icons** to `components/ui/icons.tsx` (they reuse the existing `Svg` wrapper already in that file):

```tsx
export function HomeIcon({className}: IconProps) {
	return <Svg className={className}><path d="M3 9.5L12 3l9 6.5" /><path d="M5 9.2V20h14V9.2" /><path d="M9.5 20v-6h5v6" /></Svg>
}
export function UsersIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="9" cy="8" r="3.4" /><path d="M2.6 20a6.4 6.4 0 0112.8 0" /><path d="M16.2 5.3a3.4 3.4 0 010 5.4M21.4 20a6.4 6.4 0 00-4.6-6.1" /></Svg>
}
export function ColumnsIcon({className}: IconProps) {
	return <Svg className={className}><rect x="3" y="5" width="5" height="14" rx="1.2" /><rect x="9.5" y="5" width="5" height="9" rx="1.2" /><rect x="16" y="5" width="5" height="12" rx="1.2" /></Svg>
}
export function LayersIcon({className}: IconProps) {
	return <Svg className={className}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></Svg>
}
export function FileTextIcon({className}: IconProps) {
	return <Svg className={className}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /><path d="M8 13h8M8 17h6" /></Svg>
}
export function BracesIcon({className}: IconProps) {
	return <Svg className={className}><path d="M8 4c-2 0-3 1-3 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3" /><path d="M16 4c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3" /></Svg>
}
export function SearchIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Svg>
}
export function SendIcon({className}: IconProps) {
	return <Svg className={className}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></Svg>
}
export function InboxIcon({className}: IconProps) {
	return <Svg className={className}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a1 1 0 01-1 1H3a1 1 0 01-1-1v-6l3.5-7z" /></Svg>
}
export function BanIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></Svg>
}
export function SettingsIcon({className}: IconProps) {
	return <Svg className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8z" /></Svg>
}
export function ChevronLeftIcon({className}: IconProps) {
	return <Svg className={className}><path d="M15 18l-6-6 6-6" /></Svg>
}
export function LogOutIcon({className}: IconProps) {
	return <Svg className={className}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></Svg>
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0.
- [ ] **Step 3: Commit.**

```bash
git add components/ui/icons.tsx
git commit -m "feat(phase7): nav section icons"
```

---

## Task 3: Nav config + sign-out action + Sidebar

**Files:**
- Create: `app/(app)/nav-items.tsx`
- Create: `features/auth/actions.ts`
- Create: `app/(app)/sidebar.tsx`

- [ ] **Step 1: Create the nav config** `app/(app)/nav-items.tsx`:

```tsx
// app/(app)/nav-items.tsx
import {HomeIcon, UsersIcon, ColumnsIcon, LayersIcon, FileTextIcon, BracesIcon, SearchIcon, SendIcon, InboxIcon, BanIcon, SettingsIcon} from "@/components/ui/icons"

export interface NavItem {href: string; label: string; Icon: ({className}: {className?: string}) => React.ReactNode}
export interface NavGroup {label: string; items: NavItem[]}

export const NAV_GROUPS: NavGroup[] = [
	{label: "Sprzedaż", items: [
		{href: "/", label: "Pulpit", Icon: HomeIcon},
		{href: "/leady", label: "Leady", Icon: UsersIcon},
		{href: "/pipeline", label: "Pipeline", Icon: ColumnsIcon},
	]},
	{label: "Treści", items: [
		{href: "/linie", label: "Linie usług", Icon: LayersIcon},
		{href: "/szablony", label: "Szablony", Icon: FileTextIcon},
		{href: "/placeholdery", label: "Placeholdery", Icon: BracesIcon},
	]},
	{label: "Wysyłka", items: [
		{href: "/badania", label: "Badania", Icon: SearchIcon},
		{href: "/kampanie", label: "Kampanie", Icon: SendIcon},
		{href: "/skrzynki", label: "Skrzynki", Icon: InboxIcon},
		{href: "/suppression", label: "Suppression", Icon: BanIcon},
	]},
]

export const SETTINGS_ITEM: NavItem = {href: "/ustawienia", label: "Ustawienia", Icon: SettingsIcon}
```

- [ ] **Step 2: Create the sign-out action** `features/auth/actions.ts`:

```ts
"use server"
// features/auth/actions.ts
import {signOut} from "@/lib/auth"

export async function signOutAction(): Promise<void> {
	await signOut({redirectTo: "/logowanie"})
}
```

- [ ] **Step 3: Create the sidebar** `app/(app)/sidebar.tsx`:

```tsx
"use client"
// app/(app)/sidebar.tsx
import {useEffect, useState} from "react"
import Link from "next/link"
import {usePathname} from "next/navigation"
import {cn} from "@/lib/cn"
import {isNavActive} from "@/features/nav/active"
import {signOutAction} from "@/features/auth/actions"
import {NAV_GROUPS, SETTINGS_ITEM, type NavItem} from "./nav-items"
import {ThemeToggle} from "@/components/ui/theme-toggle"
import {ChevronLeftIcon, LogOutIcon} from "@/components/ui/icons"

export interface SidebarUser {name: string | null; email: string | null; role: string; orgName: string}

function SideLink({item, active, labelCls}: {item: NavItem; active: boolean; labelCls: string}) {
	const {Icon} = item
	return (
		<Link
			href={item.href}
			title={item.label}
			aria-current={active ? "page" : undefined}
			className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-accent-quiet text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}
		>
			<Icon className="size-[18px] flex-none" />
			<span className={cn("truncate", labelCls)}>{item.label}</span>
		</Link>
	)
}

export function Sidebar({user}: {user: SidebarUser}) {
	const pathname = usePathname()
	const [collapsed, setCollapsed] = useState(false)
	useEffect(() => {
		try { setCollapsed(localStorage.getItem("nav-collapsed") === "1") } catch { /* ignore */ }
	}, [])
	function toggle() {
		setCollapsed((c) => {
			const next = !c
			try { localStorage.setItem("nav-collapsed", next ? "1" : "0") } catch { /* ignore */ }
			return next
		})
	}
	const labelCls = collapsed ? "hidden" : "hidden lg:inline"
	const initials = (user.name ?? user.email ?? "?").trim().slice(0, 2).toUpperCase()

	return (
		<aside className={cn("sticky top-0 flex h-screen flex-none flex-col border-r border-border bg-surface-1 transition-[width] duration-200", collapsed ? "w-14" : "w-14 lg:w-[212px]")}>
			<Link href="/" className="flex h-[52px] flex-none items-center gap-2 px-4 text-[14px] font-bold tracking-[-0.02em]">
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
					type="button"
					onClick={toggle}
					aria-label={collapsed ? "Rozwiń panel" : "Zwiń panel"}
					className="hidden items-center gap-3 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:flex"
				>
					<ChevronLeftIcon className={cn("size-[18px] flex-none transition-transform", collapsed && "rotate-180")} />
					<span className={cn("truncate", labelCls)}>Zwiń</span>
				</button>

				<div className="flex items-center gap-2 px-1 py-1">
					<ThemeToggle />
				</div>

				<details className="relative">
					<summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-1.5 hover:bg-surface-2">
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
						<form action={signOutAction} className="border-t border-border pt-1">
							<button type="submit" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
								<LogOutIcon className="size-4 flex-none" /> Wyloguj
							</button>
						</form>
					</div>
				</details>
			</div>
		</aside>
	)
}
```

- [ ] **Step 4: Typecheck + lint.** Run: `npx tsc --noEmit` (Expected: 0) and `npx eslint "app/(app)/sidebar.tsx" "app/(app)/nav-items.tsx" "features/auth"` (Expected: clean).
- [ ] **Step 5: Commit.**

```bash
git add "app/(app)/sidebar.tsx" "app/(app)/nav-items.tsx" features/auth/actions.ts
git commit -m "feat(phase7): icon Sidebar (groups, collapse, account menu) + signOut action"
```

---

## Task 4: Wire the layout

**Files:**
- Modify: `app/(app)/layout.tsx`
- Delete: `app/(app)/nav-link.tsx` (superseded — verify no other importer first)

- [ ] **Step 1: Replace `app/(app)/layout.tsx`** with:

```tsx
// app/(app)/layout.tsx
import {auth} from "@/lib/auth"
import {redirect} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {ToastProvider} from "@/components/ui/toast-provider"
import {ConfirmProvider} from "@/components/ui/confirm"
import {Container} from "@/components/ui/container"
import {Sidebar} from "./sidebar"

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")
	const org = session.user.orgId ? await prisma.organization.findUnique({where: {id: session.user.orgId}, select: {name: true}}) : null

	return (
		<ToastProvider>
			<ConfirmProvider>
				<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-1.5 focus:text-sm focus:ring-2 focus:ring-ring">Przejdź do treści</a>
				<div className="flex min-h-screen">
					<Sidebar user={{name: session.user.name ?? null, email: session.user.email ?? null, role: String(session.user.role ?? ""), orgName: org?.name ?? ""}} />
					<main id="main" className="min-w-0 flex-1">
						<Container className="py-8">{children}</Container>
					</main>
				</div>
			</ConfirmProvider>
		</ToastProvider>
	)
}
```

- [ ] **Step 2: Delete the dead nav-link.** Confirm nothing else imports it: `npx grep -r "nav-link" app` is not available — use the editor's search or `git grep "nav-link"`. Expected: only the old layout referenced it. Then run `git rm "app/(app)/nav-link.tsx"`.

- [ ] **Step 3: Typecheck + lint.** Run: `npx tsc --noEmit` (Expected: 0) and `npx eslint "app/(app)"` (Expected: clean).
- [ ] **Step 4: Commit.**

```bash
git add "app/(app)/layout.tsx" "app/(app)/nav-link.tsx"
git commit -m "feat(phase7): app shell uses the icon Sidebar (drop top-bar nav)"
```

---

## Task 5: Gates + roadmap + graph

- [ ] **Step 1: Full gates** (dev server OFF for the build):
  - `npx tsc --noEmit` — 0.
  - `npx vitest run` — all pass (expect ~232: prior 230 + 2 isNavActive cases).
  - `npx eslint "app/(app)" features components` — clean.
  - `npm run build` — green.
- [ ] **Step 2: Live eyeball (high-taste — required for this one).** With the dev server, check: the sidebar shows on every page with the correct active item; the collapse toggle shrinks to icons + persists across reload; below the `lg` breakpoint it is icon-only; the account menu shows name/email/org/role and Wyloguj works; theme toggle works; tooltips show in icon-only mode. Fix any visual issues and commit them.
- [ ] **Step 3: Update `docs/superpowers/ROADMAP.md`:** mark `shell-and-nav-redesign` DONE + verified; note the icon sidebar (variant C, collapses to icons; localStorage-persisted; account menu surfacing user/org/role; `signOutAction`); `/` nav uses the new shell. Set the next sub-project to `page-level-visual-pass` (the last high-taste pass; waits for user direction) — then `team-role-ui`. Update the Phase 7 table row + the NEXT TASK line + the recommended-order list + the How-to-resume line.
- [ ] **Step 4:** `graphify update .` (AST-only).
- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark shell-and-nav-redesign DONE + refresh graph"
```

---

## Self-review

**Spec coverage:** `isNavActive` (Task 1, TDD) ✓; ~13 icons (Task 2) ✓; nav config + `signOutAction` + `Sidebar` with collapse/persistence/account-menu/groups (Task 3) ✓; layout refactor + nav-link deletion + org-name fetch (Task 4) ✓; collapse-to-icons responsive (sidebar width/label Tailwind classes) ✓; account menu surfaces user/email/org/role + Wyloguj ✓; gates + live eyeball + roadmap (Task 5) ✓. No migration (spec says none).

**Placeholder scan:** every step has complete code; icons are concrete paths; the sidebar is full. No TBD. (Task 4 Step 2's "confirm no other importer" is a real check with a concrete command, not a placeholder.)

**Type consistency:** `NavItem`/`NavGroup`/`SidebarUser` defined in Tasks 3 are used consistently; `isNavActive(pathname, href)` signature matches Task 1; `signOutAction` (Task 3) imported by the Sidebar; icon component names in Task 2 match the imports in `nav-items.tsx` (Task 3); the layout passes exactly the `SidebarUser` shape the Sidebar expects.

**Notes:** Task 1 lands the tested helper; Tasks 2-4 build the UI (tsc stays green throughout — the Sidebar imports the icons + helper that already exist by Task 3). The only client component is the Sidebar; everything else stays server-rendered. `collapsed` is applied post-mount so SSR and first client render both show expanded (no hydration mismatch). Native `<details>` account menu does not close on outside-click (acceptable for an internal tool; can add a click-away later).
