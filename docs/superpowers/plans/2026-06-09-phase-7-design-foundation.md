# design-foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the app's shared visual layer — Tailwind v4 design tokens (dark+light), a typed `components/ui/*` primitive library, global scaffolding (toast, confirm, route boundaries, container, a11y), motion conventions — and validate it by rebuilding `/ustawienia` as the reference surface.

**Architecture:** Tokens live as per-theme CSS variables in `globals.css`, mapped to Tailwind utilities via `@theme inline`; `[data-theme]` on `<html>` flips them. Primitives are small presentational components built on `cn()` (clsx + tailwind-merge) using token utilities. Motion (`motion/react`) drives the settings fluid-body; CSS + easing tokens drive micro-interactions. Pure logic (theme resolution, button variants, toast reducer, confirm state) is unit-tested; components are validated by `tsc`/`build`/the committed sketch.

**Tech Stack:** Next 16.2.6, React 19.2, Tailwind v4.3, `motion` (new), `clsx`+`tailwind-merge` (present), Vitest 4, TypeScript 6.

**Visual source of truth:** `docs/superpowers/design/design-foundation-sketch.html` (committed). Token values + component look are taken from it verbatim.

---

## Token utility names (defined in Task 1, used everywhere after)

`@theme inline` generates these utilities from the CSS vars: backgrounds `bg-bg bg-surface-1 bg-surface-2 bg-surface-3 bg-accent-quiet bg-primary bg-success-quiet bg-danger-quiet bg-warning-quiet`; text `text-fg text-fg-muted text-fg-faint text-accent text-primary-fg text-success text-danger text-warning`; borders `border-border border-border-strong`; radius `rounded-sm rounded-md rounded-lg`; easing `ease-out ease-out-quart`; fonts `font-sans font-mono`. Use ONLY these (never literal `zinc-*`) in new `components/ui/*`.

## File structure

- `app/globals.css` — tokens, `@custom-variant`, `@theme inline`, base layer.
- `app/layout.tsx` — `next/font` Inter + Geist Mono, no-flash theme script, token body.
- `features/theme/resolve.ts` (+ test) — pure initial-theme resolution.
- `components/ui/` — `button.tsx` `badge.tsx` `input.tsx` `textarea.tsx` `select.tsx` `field.tsx` `note.tsx` `card.tsx` `table.tsx` `switch.tsx` `empty-state.tsx` `spinner.tsx` `icons.tsx` `container.tsx` `theme-toggle.tsx`.
- `components/ui/button-variants.ts` (+ test) — pure variant→class map.
- `components/ui/toast.tsx` `toast-reducer.ts` (+ test) `use-toast.ts` `toast-provider.tsx`.
- `components/ui/confirm.tsx` `confirm-state.ts` (+ test) `use-confirm.ts`.
- `app/(app)/layout.tsx` — providers + container + nav re-skin + `nav-link.tsx`.
- `app/(app)/loading.tsx` `error.tsx` `not-found.tsx`; `app/not-found.tsx`.
- `app/(app)/ustawienia/*` — `settings-shell.tsx` + `general-form.tsx` + migrated `sender-signature-form.tsx` + `settings-form.tsx`; `features/org/settings.ts` (+ `setOrgName`, `name` in `getOrgSettings`).
- `package.json` — add `motion`.

---

## Task 1: Tokens, theme bootstrap, fonts

**Files:** Create `features/theme/resolve.ts` + `features/theme/resolve.test.ts`; Modify `app/globals.css`, `app/layout.tsx`.

- [ ] **Step 1: Failing test for the theme resolver**

Create `features/theme/resolve.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run it — expect FAIL** — `npx vitest run features/theme/resolve.test.ts` (cannot resolve module).

- [ ] **Step 3: Implement the resolver**

Create `features/theme/resolve.ts`:
```typescript
// features/theme/resolve.ts
export type Theme = "light" | "dark"

// Default LIGHT during Phase 7 migration so un-converted pages stay readable.
// Flip to "dark" (or prefers-color-scheme) once page-level-visual-pass lands.
export function resolveInitialTheme(stored: string | null): Theme {
	return stored === "dark" || stored === "light" ? stored : "light"
}
```

- [ ] **Step 4: Run it — expect PASS** — `npx vitest run features/theme/resolve.test.ts`.

- [ ] **Step 5: Write `globals.css`**

Replace the entire contents of `app/globals.css`:
```css
@import "tailwindcss";

@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

:root {
	--bg: #fbfbfc; --bg-glow: #f2f5fb;
	--surface-1: #ffffff; --surface-2: #f6f6f7; --surface-3: #efeff1;
	--border: rgba(9,9,11,.09); --border-strong: rgba(9,9,11,.16);
	--text: #18181b; --text-muted: #56565e; --text-faint: #9b9ba3;
	--accent: #4f56c6; --accent-quiet: rgba(79,86,198,.11);
	--primary-bg: #18181b; --primary-fg: #fafafa;
	--success: #16a34a; --success-quiet: rgba(22,163,74,.10);
	--danger: #dc2626; --danger-quiet: rgba(220,38,38,.09);
	--warning: #b45309; --warning-quiet: rgba(180,83,9,.10);
	--ring: rgba(79,86,198,.42);
}
[data-theme="dark"] {
	--bg: #08090a; --bg-glow: #0e1014;
	--surface-1: #131316; --surface-2: #1a1a1f; --surface-3: #212127;
	--border: rgba(255,255,255,.08); --border-strong: rgba(255,255,255,.15);
	--text: #f3f3f4; --text-muted: #9a9aa3; --text-faint: #66666f;
	--accent: #7c86dd; --accent-quiet: rgba(124,134,221,.15);
	--primary-bg: #fafafa; --primary-fg: #0a0a0b;
	--success: #3ddc97; --success-quiet: rgba(61,220,151,.13);
	--danger: #ff6b6b; --danger-quiet: rgba(255,107,107,.13);
	--warning: #f5c451; --warning-quiet: rgba(245,196,81,.13);
	--ring: rgba(124,134,221,.55);
}

@theme inline {
	--color-bg: var(--bg);
	--color-surface-1: var(--surface-1);
	--color-surface-2: var(--surface-2);
	--color-surface-3: var(--surface-3);
	--color-border: var(--border);
	--color-border-strong: var(--border-strong);
	--color-fg: var(--text);
	--color-fg-muted: var(--text-muted);
	--color-fg-faint: var(--text-faint);
	--color-accent: var(--accent);
	--color-accent-quiet: var(--accent-quiet);
	--color-primary: var(--primary-bg);
	--color-primary-fg: var(--primary-fg);
	--color-success: var(--success);
	--color-success-quiet: var(--success-quiet);
	--color-danger: var(--danger);
	--color-danger-quiet: var(--danger-quiet);
	--color-warning: var(--warning);
	--color-warning-quiet: var(--warning-quiet);
	--color-ring: var(--ring);
	--radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px;
	--ease-out: cubic-bezier(0.215, 0.61, 0.355, 1);
	--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
	--font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	--font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace;
}

@layer base {
	body { background: var(--bg); color: var(--text); letter-spacing: -0.006em; }
	::selection { background: var(--accent-quiet); }
	:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; border-radius: 4px; }
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
	}
}
```

- [ ] **Step 6: Wire fonts + no-flash theme in `app/layout.tsx`**

Replace the entire contents of `app/layout.tsx`:
```tsx
// app/layout.tsx
import type {Metadata} from "next"
import {Inter, Geist_Mono} from "next/font/google"
import "./globals.css"

const inter = Inter({subsets: ["latin"], variable: "--font-inter", display: "swap"})
const geistMono = Geist_Mono({subsets: ["latin"], variable: "--font-geist-mono", display: "swap"})

export const metadata: Metadata = {
	title: "Cold Mailing",
	description: "Wewnętrzne narzędzie do cold-mailingu",
}

// Inline, render-blocking: set the theme before first paint to avoid a flash. Default light (see features/theme/resolve.ts).
const themeScript = `(function(){try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=(t==="dark"||t==="light")?t:"light";}catch(e){document.documentElement.dataset.theme="light";}})();`

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
	return (
		<html lang="pl" data-theme="light" className={`h-full antialiased ${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
			<body className="min-h-full font-sans bg-bg text-fg">
				<script suppressHydrationWarning dangerouslySetInnerHTML={{__html: themeScript}} />
				{children}
			</body>
		</html>
	)
}
```
(The inline script is the first child of `<body>` so it sets `data-theme` before the page content paints — App-Router-safe, no manual `<head>`.)

- [ ] **Step 7: Verify Geist Mono resolves + gates**

Run: `npx tsc --noEmit` (expect 0). If `Geist_Mono` is not exported by `next/font/google`, install the `geist` package (`npm i geist`) and use `import {GeistMono} from "geist/font/mono"` with `GeistMono.variable` instead — note this swap in the commit if used.
Run: `npx vitest run` (expect prior + 2 new theme tests).

- [ ] **Step 8: Commit**
```bash
git add app/globals.css app/layout.tsx features/theme
git commit -m "feat(phase7): design tokens (@theme dark+light) + fonts + no-flash theme bootstrap"
```

---

## Task 2: Button + Badge (+ pure variant map)

**Files:** Create `components/ui/button-variants.ts` (+ `.test.ts`), `components/ui/button.tsx`, `components/ui/badge.tsx`.

- [ ] **Step 1: Failing test for the variant map**

Create `components/ui/button-variants.test.ts`:
```typescript
// components/ui/button-variants.test.ts
import {describe, it, expect} from "vitest"
import {buttonVariant} from "@/components/ui/button-variants"

describe("buttonVariant", () => {
	it("returns the primary classes", () => {
		expect(buttonVariant("primary")).toContain("bg-primary")
	})
	it("defaults to secondary for an unknown variant", () => {
		expect(buttonVariant(undefined)).toContain("bg-surface-2")
	})
	it("has a danger variant", () => {
		expect(buttonVariant("danger")).toContain("text-danger")
	})
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run components/ui/button-variants.test.ts`

- [ ] **Step 3: Implement the variant map**

Create `components/ui/button-variants.ts`:
```typescript
// components/ui/button-variants.ts
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"

const VARIANTS: Record<ButtonVariant, string> = {
	primary: "bg-primary text-primary-fg hover:opacity-90",
	secondary: "bg-surface-2 text-fg border border-border hover:bg-surface-3 hover:border-border-strong",
	ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
	danger: "bg-danger-quiet text-danger border border-transparent hover:bg-danger-quiet",
}

export function buttonVariant(v: ButtonVariant | undefined): string {
	return VARIANTS[v ?? "secondary"]
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Implement Button**

Create `components/ui/button.tsx`:
```tsx
// components/ui/button.tsx
import {forwardRef, type ButtonHTMLAttributes} from "react"
import {cn} from "@/lib/cn"
import {buttonVariant, type ButtonVariant} from "@/components/ui/button-variants"

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	size?: "sm" | "md"
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button({variant, size = "md", className, ...props}, ref) {
	return (
		<button
			ref={ref}
			className={cn(
				"inline-flex items-center gap-2 rounded-md font-medium tracking-[-0.01em] transition-[transform,background,border-color,opacity] duration-150 ease-out active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none",
				size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
				buttonVariant(variant),
				className,
			)}
			{...props}
		/>
	)
})
```

- [ ] **Step 6: Implement Badge**

Create `components/ui/badge.tsx`:
```tsx
// components/ui/badge.tsx
import {cn} from "@/lib/cn"

type BadgeVariant = "neutral" | "ok" | "warn" | "bad" | "info"

const MAP: Record<BadgeVariant, string> = {
	neutral: "bg-surface-3 text-fg-muted border border-border",
	ok: "bg-success-quiet text-success",
	warn: "bg-warning-quiet text-warning",
	bad: "bg-danger-quiet text-danger",
	info: "bg-accent-quiet text-accent",
}

export function Badge({variant = "neutral", dot, className, children}: {variant?: BadgeVariant; dot?: boolean; className?: string; children: React.ReactNode}) {
	return (
		<span className={cn("inline-flex h-[21px] items-center gap-1.5 rounded-[999px] px-2 text-[11.5px] font-medium", MAP[variant], className)}>
			{dot ? <span className="size-[5px] rounded-full bg-current" /> : null}
			{children}
		</span>
	)
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0).
```bash
git add components/ui/button.tsx components/ui/button-variants.ts components/ui/button-variants.test.ts components/ui/badge.tsx
git commit -m "feat(phase7): ui Button + Badge primitives (token-backed)"
```

---

## Task 3: Form primitives — Input, Textarea, Select, Field, Note

**Files:** Create `components/ui/{input,textarea,select,field,note}.tsx`.

- [ ] **Step 1: Input + Textarea + Select**

Create `components/ui/input.tsx`:
```tsx
// components/ui/input.tsx
import {forwardRef, type InputHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

const base = "w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-fg-faint transition-[border-color,box-shadow,background] duration-150 hover:border-border-strong focus:outline-none focus:border-accent focus:bg-surface-1 focus:[box-shadow:0_0_0_3px_var(--accent-quiet)]"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({className, ...props}, ref) {
	return <input ref={ref} className={cn(base, className)} {...props} />
})
```

Create `components/ui/textarea.tsx`:
```tsx
// components/ui/textarea.tsx
import {forwardRef, type TextareaHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({className, ...props}, ref) {
	return (
		<textarea
			ref={ref}
			className={cn(
				"w-full min-h-24 resize-y rounded-md border border-border bg-surface-2 p-2.5 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-fg-faint transition-[border-color,box-shadow,background] duration-150 hover:border-border-strong focus:outline-none focus:border-accent focus:bg-surface-1 focus:[box-shadow:0_0_0_3px_var(--accent-quiet)]",
				className,
			)}
			{...props}
		/>
	)
})
```

Create `components/ui/select.tsx`:
```tsx
// components/ui/select.tsx
import {forwardRef, type SelectHTMLAttributes} from "react"
import {cn} from "@/lib/cn"

// className targets the WRAPPER (width constraints like max-w-xs); the select is always w-full of it.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({className, children, ...props}, ref) {
	return (
		<div className={cn("relative", className)}>
			<select
				ref={ref}
				className="w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-2 py-2 pl-2.5 pr-8 text-[13px] text-fg transition-[border-color,box-shadow,background] duration-150 hover:border-border-strong focus:outline-none focus:border-accent focus:bg-surface-1 focus:[box-shadow:0_0_0_3px_var(--accent-quiet)]"
				{...props}
			>
				{children}
			</select>
			<svg className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-faint" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
		</div>
	)
})
```

- [ ] **Step 2: Field + Note**

Create `components/ui/field.tsx`:
```tsx
// components/ui/field.tsx
export function Field({label, hint, error, children}: {label?: string; hint?: React.ReactNode; error?: string; children: React.ReactNode}) {
	return (
		<label className="flex flex-col gap-1.5">
			{label ? <span className="text-[12.5px] font-medium text-fg">{label}</span> : null}
			{children}
			{error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-fg-faint">{hint}</span> : null}
		</label>
	)
}
```

Create `components/ui/note.tsx`:
```tsx
// components/ui/note.tsx
import {cn} from "@/lib/cn"

const MAP = {
	warning: "bg-warning-quiet text-warning border-warning/25",
	info: "bg-accent-quiet text-accent border-accent/25",
} as const

export function Note({variant = "warning", className, children}: {variant?: "warning" | "info"; className?: string; children: React.ReactNode}) {
	return <p className={cn("rounded-md border px-3 py-2.5 text-[12.5px] leading-snug", MAP[variant], className)}>{children}</p>
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0).
```bash
git add components/ui/input.tsx components/ui/textarea.tsx components/ui/select.tsx components/ui/field.tsx components/ui/note.tsx
git commit -m "feat(phase7): ui form primitives (Input, Textarea, Select, Field, Note)"
```

---

## Task 4: Card, Table, Switch, EmptyState, Spinner, Icons

**Files:** Create `components/ui/{card,table,switch,empty-state,spinner,icons}.tsx`.

- [ ] **Step 1: Card + Table**

Create `components/ui/card.tsx`:
```tsx
// components/ui/card.tsx
import {cn} from "@/lib/cn"
export function Card({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("rounded-lg border border-border bg-surface-1 shadow-[0_1px_2px_rgba(9,9,11,.04)]", className)}>{children}</div>
}
export function CardBody({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("p-[18px]", className)}>{children}</div>
}
export function CardFooter({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("flex items-center justify-between gap-3 rounded-b-lg border-t border-border bg-surface-2/60 px-[18px] py-3 text-[12.5px] text-fg-muted", className)}>{children}</div>
}
```

Create `components/ui/table.tsx`:
```tsx
// components/ui/table.tsx
import {cn} from "@/lib/cn"
export function Table({className, children}: {className?: string; children: React.ReactNode}) {
	return <table className={cn("w-full border-collapse text-[13px]", className)}>{children}</table>
}
export function Th({className, children}: {className?: string; children: React.ReactNode}) {
	return <th className={cn("border-b border-border px-3.5 pb-2.5 text-left text-[11.5px] font-medium uppercase tracking-wide text-fg-faint", className)}>{children}</th>
}
export function Td({className, children}: {className?: string; children: React.ReactNode}) {
	return <td className={cn("border-b border-border px-3.5 py-3", className)}>{children}</td>
}
```

- [ ] **Step 2: Switch + EmptyState + Spinner**

Create `components/ui/switch.tsx`:
```tsx
// components/ui/switch.tsx
"use client"
import {cn} from "@/lib/cn"
export function Switch({checked, onChange, className}: {checked: boolean; onChange: (v: boolean) => void; className?: string}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-[22px] w-[38px] flex-none rounded-[999px] border transition-colors duration-200",
				checked ? "border-transparent bg-accent" : "border-border-strong bg-surface-3",
				"after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:transition-all after:duration-200",
				checked ? "after:left-[18px] after:bg-white" : "after:bg-fg-faint",
				className,
			)}
		/>
	)
}
```

Create `components/ui/spinner.tsx`:
```tsx
// components/ui/spinner.tsx
import {cn} from "@/lib/cn"
export function Spinner({className}: {className?: string}) {
	return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-border-strong border-t-fg", className)} aria-hidden />
}
```

Create `components/ui/empty-state.tsx`:
```tsx
// components/ui/empty-state.tsx
export function EmptyState({title, description, action}: {title: string; description?: string; action?: React.ReactNode}) {
	return (
		<div className="px-5 py-12 text-center">
			<h3 className="text-sm font-medium text-fg">{title}</h3>
			{description ? <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-fg-muted">{description}</p> : null}
			{action ? <div className="mt-4 flex justify-center">{action}</div> : null}
		</div>
	)
}
```

- [ ] **Step 3: Icons**

Create `components/ui/icons.tsx` (only the few we use; all inherit `currentColor`):
```tsx
// components/ui/icons.tsx
type P = {className?: string}
const svg = (path: React.ReactNode) => ({className}: P) => (
	<svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
)
export const CheckIcon = svg(<path d="M20 6L9 17l-5-5" />)
export const SunIcon = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)
export const MoonIcon = svg(<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 109.8 9.8z" />)
export const WarningIcon = svg(<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></>)
export const SaveIcon = svg(<><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>)
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0).
```bash
git add components/ui/card.tsx components/ui/table.tsx components/ui/switch.tsx components/ui/spinner.tsx components/ui/empty-state.tsx components/ui/icons.tsx
git commit -m "feat(phase7): ui Card, Table, Switch, Spinner, EmptyState, Icons"
```

---

## Task 5: Toast (provider + reducer + hook)

**Files:** Create `components/ui/toast-reducer.ts` (+ `.test.ts`), `components/ui/toast-provider.tsx`, `components/ui/use-toast.ts`.

- [ ] **Step 1: Failing test for the reducer**

Create `components/ui/toast-reducer.test.ts`:
```typescript
// components/ui/toast-reducer.test.ts
import {describe, it, expect} from "vitest"
import {toastReducer, type ToastState} from "@/components/ui/toast-reducer"

const empty: ToastState = {toasts: []}

describe("toastReducer", () => {
	it("adds a toast", () => {
		const s = toastReducer(empty, {type: "add", toast: {id: "1", title: "Hi", variant: "success"}})
		expect(s.toasts).toHaveLength(1)
		expect(s.toasts[0].title).toBe("Hi")
	})
	it("removes a toast by id", () => {
		const s1 = toastReducer(empty, {type: "add", toast: {id: "1", title: "Hi", variant: "success"}})
		const s2 = toastReducer(s1, {type: "remove", id: "1"})
		expect(s2.toasts).toHaveLength(0)
	})
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the reducer**

Create `components/ui/toast-reducer.ts`:
```typescript
// components/ui/toast-reducer.ts
export interface Toast {
	id: string
	title: string
	variant: "success" | "neutral"
}
export interface ToastState {
	toasts: Toast[]
}
export type ToastAction = {type: "add"; toast: Toast} | {type: "remove"; id: string}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
	switch (action.type) {
		case "add":
			return {toasts: [...state.toasts, action.toast]}
		case "remove":
			return {toasts: state.toasts.filter((t) => t.id !== action.id)}
	}
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Provider + hook + visual toast**

Create `components/ui/use-toast.ts`:
```typescript
// components/ui/use-toast.ts
"use client"
import {createContext, useContext} from "react"

export type ToastFn = (title: string, variant?: "success" | "neutral") => void
export const ToastContext = createContext<ToastFn | null>(null)

export function useToast(): ToastFn {
	const fn = useContext(ToastContext)
	if (!fn) throw new Error("useToast must be used within <ToastProvider>")
	return fn
}
```

Create `components/ui/toast-provider.tsx`:
```tsx
"use client"
// components/ui/toast-provider.tsx
import {useCallback, useReducer, useRef} from "react"
import {toastReducer} from "@/components/ui/toast-reducer"
import {ToastContext, type ToastFn} from "@/components/ui/use-toast"
import {CheckIcon} from "@/components/ui/icons"
import {cn} from "@/lib/cn"

export function ToastProvider({children}: {children: React.ReactNode}) {
	const [state, dispatch] = useReducer(toastReducer, {toasts: []})
	const seq = useRef(0)
	const toast = useCallback<ToastFn>((title, variant = "success") => {
		const id = String(++seq.current)
		dispatch({type: "add", toast: {id, title, variant}})
		setTimeout(() => dispatch({type: "remove", id}), 2600)
	}, [])
	return (
		<ToastContext.Provider value={toast}>
			{children}
			<div className="fixed bottom-[18px] right-[18px] z-[60] flex flex-col gap-2">
				{state.toasts.map((t) => (
					<div key={t.id} className="flex min-w-[240px] items-center gap-2.5 rounded-md border border-border-strong bg-surface-1 px-3 py-2.5 text-[13px] text-fg shadow-[0_8px_24px_-16px_rgba(0,0,0,.4)] [animation:toastIn_.3s_var(--ease-out)]">
						<span className={cn("grid size-[18px] flex-none place-items-center rounded-full", t.variant === "success" ? "bg-success-quiet text-success" : "bg-surface-3 text-fg-muted")}>
							<CheckIcon className="size-3" />
						</span>
						{t.title}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}
```

Add the keyframe to `app/globals.css` inside `@layer base` (append after the reduced-motion block):
```css
	@keyframes toastIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
```

- [ ] **Step 6: Typecheck + run tests + commit**

Run: `npx tsc --noEmit` (0). Run: `npx vitest run components/ui/toast-reducer.test.ts` (pass).
```bash
git add components/ui/toast-reducer.ts components/ui/toast-reducer.test.ts components/ui/use-toast.ts components/ui/toast-provider.tsx app/globals.css
git commit -m "feat(phase7): ui Toast (reducer + provider + useToast)"
```

---

## Task 6: ConfirmDialog (native <dialog> + hook)

**Files:** Create `components/ui/confirm-state.ts` (+ `.test.ts`), `components/ui/confirm.tsx`, `components/ui/use-confirm.ts`.

- [ ] **Step 1: Failing test for the confirm state helper**

Create `components/ui/confirm-state.test.ts`:
```typescript
// components/ui/confirm-state.test.ts
import {describe, it, expect} from "vitest"
import {defaultConfirmOptions} from "@/components/ui/confirm-state"

describe("defaultConfirmOptions", () => {
	it("fills sensible defaults", () => {
		const o = defaultConfirmOptions({title: "Na pewno?"})
		expect(o.confirmLabel).toBe("Potwierdź")
		expect(o.cancelLabel).toBe("Anuluj")
		expect(o.danger).toBe(false)
	})
	it("keeps provided values", () => {
		const o = defaultConfirmOptions({title: "X", confirmLabel: "Usuń", danger: true})
		expect(o.confirmLabel).toBe("Usuń")
		expect(o.danger).toBe(true)
	})
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement the helper**

Create `components/ui/confirm-state.ts`:
```typescript
// components/ui/confirm-state.ts
export interface ConfirmOptions {
	title: string
	body?: string
	confirmLabel?: string
	cancelLabel?: string
	danger?: boolean
}
export interface ResolvedConfirm extends Required<Omit<ConfirmOptions, "body">> {
	body: string
}
export function defaultConfirmOptions(o: ConfirmOptions): ResolvedConfirm {
	return {
		title: o.title,
		body: o.body ?? "",
		confirmLabel: o.confirmLabel ?? "Potwierdź",
		cancelLabel: o.cancelLabel ?? "Anuluj",
		danger: o.danger ?? false,
	}
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Provider/hook + dialog**

Create `components/ui/use-confirm.ts`:
```typescript
// components/ui/use-confirm.ts
"use client"
import {createContext, useContext} from "react"
import type {ConfirmOptions} from "@/components/ui/confirm-state"

export type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>
export const ConfirmContext = createContext<ConfirmFn | null>(null)

export function useConfirm(): ConfirmFn {
	const fn = useContext(ConfirmContext)
	if (!fn) throw new Error("useConfirm must be used within <ConfirmProvider>")
	return fn
}
```

Create `components/ui/confirm.tsx`:
```tsx
"use client"
// components/ui/confirm.tsx
import {useCallback, useRef, useState} from "react"
import {defaultConfirmOptions, type ConfirmOptions, type ResolvedConfirm} from "@/components/ui/confirm-state"
import {ConfirmContext, type ConfirmFn} from "@/components/ui/use-confirm"
import {Button} from "@/components/ui/button"

export function ConfirmProvider({children}: {children: React.ReactNode}) {
	const dialogRef = useRef<HTMLDialogElement>(null)
	const resolver = useRef<((v: boolean) => void) | null>(null)
	const [opts, setOpts] = useState<ResolvedConfirm | null>(null)

	const confirm = useCallback<ConfirmFn>((o: ConfirmOptions) => {
		setOpts(defaultConfirmOptions(o))
		dialogRef.current?.showModal()
		return new Promise<boolean>((resolve) => {
			resolver.current = resolve
		})
	}, [])

	const settle = (v: boolean) => {
		dialogRef.current?.close()
		resolver.current?.(v)
		resolver.current = null
	}

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			<dialog
				ref={dialogRef}
				onCancel={(e) => {e.preventDefault(); settle(false)}}
				className="m-auto w-[380px] max-w-[calc(100vw-32px)] rounded-lg border border-border-strong bg-surface-1 p-[18px] text-fg backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
			>
				{opts ? (
					<>
						<h3 className="text-[15px] font-semibold tracking-[-0.02em]">{opts.title}</h3>
						{opts.body ? <p className="mb-[18px] mt-1.5 text-[13px] text-fg-muted">{opts.body}</p> : <div className="mb-[18px]" />}
						<div className="flex justify-end gap-2">
							<Button variant="secondary" onClick={() => settle(false)}>{opts.cancelLabel}</Button>
							<Button variant={opts.danger ? "danger" : "primary"} onClick={() => settle(true)}>{opts.confirmLabel}</Button>
						</div>
					</>
				) : null}
			</dialog>
		</ConfirmContext.Provider>
	)
}
```

- [ ] **Step 6: Typecheck + run tests + commit**

Run: `npx tsc --noEmit` (0). Run: `npx vitest run components/ui/confirm-state.test.ts` (pass).
```bash
git add components/ui/confirm-state.ts components/ui/confirm-state.test.ts components/ui/use-confirm.ts components/ui/confirm.tsx
git commit -m "feat(phase7): ui ConfirmDialog (native <dialog> + useConfirm)"
```

---

## Task 7: Container, ThemeToggle, NavLink + wire the app shell

**Files:** Create `components/ui/container.tsx`, `components/ui/theme-toggle.tsx`, `app/(app)/nav-link.tsx`; Modify `app/(app)/layout.tsx`.

- [ ] **Step 1: Container + ThemeToggle + NavLink**

Create `components/ui/container.tsx`:
```tsx
// components/ui/container.tsx
import {cn} from "@/lib/cn"
export function Container({className, children}: {className?: string; children: React.ReactNode}) {
	return <div className={cn("mx-auto w-full max-w-[1080px] px-6", className)}>{children}</div>
}
```

Create `components/ui/theme-toggle.tsx`:
```tsx
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
```

Create `app/(app)/nav-link.tsx`:
```tsx
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
```

- [ ] **Step 2: Rewrite the app layout (providers + container + nav re-skin)**

Replace the entire contents of `app/(app)/layout.tsx`:
```tsx
// app/(app)/layout.tsx
import {auth, signOut} from "@/lib/auth"
import {redirect} from "next/navigation"
import {ToastProvider} from "@/components/ui/toast-provider"
import {ConfirmProvider} from "@/components/ui/confirm"
import {Container} from "@/components/ui/container"
import {ThemeToggle} from "@/components/ui/theme-toggle"
import {NavLink} from "./nav-link"

const LINKS: [string, string][] = [
	["/leady", "Leady"], ["/pipeline", "Pipeline"], ["/linie", "Linie usług"], ["/szablony", "Szablony"],
	["/placeholdery", "Placeholdery"], ["/badania", "Badania"], ["/kampanie", "Kampanie"], ["/skrzynki", "Skrzynki"],
	["/suppression", "Suppression"], ["/ustawienia", "Ustawienia"],
]

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")

	return (
		<ToastProvider>
			<ConfirmProvider>
				<a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-1 focus:px-3 focus:py-1.5 focus:text-sm focus:ring-2 focus:ring-ring">Przejdź do treści</a>
				<div className="flex min-h-screen flex-col">
					<header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md">
						<Container className="flex h-[52px] items-center gap-4">
							<nav className="flex flex-wrap gap-1">
								{LINKS.map(([href, label]) => <NavLink key={href} href={href}>{label}</NavLink>)}
							</nav>
							<div className="flex-1" />
							<ThemeToggle />
							<form action={async () => {"use server"; await signOut({redirectTo: "/logowanie"})}}>
								<button className="text-sm text-fg-muted transition-colors hover:text-fg" type="submit">Wyloguj</button>
							</form>
						</Container>
					</header>
					<main id="main" className="flex-1">
						<Container className="py-8">{children}</Container>
					</main>
				</div>
			</ConfirmProvider>
		</ToastProvider>
	)
}
```
(Note: pages previously sat inside `<main className="p-4">`; they now sit inside a centered `Container` with `py-8`. Existing pages keep their own internal markup.)

- [ ] **Step 3: Typecheck + build + commit**

Run: `npx tsc --noEmit` (0). Run: `npm run build` (dev server OFF; expect green, all routes present).
```bash
git add components/ui/container.tsx components/ui/theme-toggle.tsx "app/(app)/nav-link.tsx" "app/(app)/layout.tsx"
git commit -m "feat(phase7): app shell on tokens — providers, container, theme toggle, active nav"
```

---

## Task 8: Route boundaries

**Files:** Create `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/not-found.tsx`, `app/not-found.tsx`.

- [ ] **Step 1: Create the four boundary files**

`app/(app)/loading.tsx`:
```tsx
// app/(app)/loading.tsx
import {Spinner} from "@/components/ui/spinner"
export default function Loading() {
	return <div className="grid place-items-center py-24 text-fg-faint"><Spinner /></div>
}
```

`app/(app)/error.tsx`:
```tsx
"use client"
// app/(app)/error.tsx
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
export default function Error({reset}: {error: Error; reset: () => void}) {
	return (
		<Card className="mx-auto max-w-md">
			<CardBody>
				<h2 className="text-sm font-semibold text-fg">Coś poszło nie tak</h2>
				<p className="mt-1 text-[12.5px] text-fg-muted">Wystąpił błąd podczas ładowania tej strony.</p>
				<Button variant="secondary" className="mt-4" onClick={reset}>Spróbuj ponownie</Button>
			</CardBody>
		</Card>
	)
}
```

`app/(app)/not-found.tsx`:
```tsx
// app/(app)/not-found.tsx
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return <EmptyState title="Nie znaleziono strony" description="Ten zasób nie istnieje lub został przeniesiony." />
}
```

`app/not-found.tsx`:
```tsx
// app/not-found.tsx
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return <div className="grid min-h-screen place-items-center bg-bg text-fg"><EmptyState title="404" description="Nie znaleziono strony." /></div>
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (0).
```bash
git add "app/(app)/loading.tsx" "app/(app)/error.tsx" "app/(app)/not-found.tsx" app/not-found.tsx
git commit -m "feat(phase7): route-level loading / error / not-found boundaries"
```

---

## Task 9: Reference surface — `/ustawienia` (settings shell + fluid body)

**Files:** Add `motion`; Modify `features/org/settings.ts`; Create `app/(app)/ustawienia/settings-shell.tsx`, `general-form.tsx`; rewrite `sender-signature-form.tsx`, `settings-form.tsx`, `page.tsx`.

- [ ] **Step 1: Install Motion**

Run: `npm install motion` (verify it resolves with React 19; if peer warnings, they are non-blocking for Motion ≥11). Expected: `motion` added to dependencies.

- [ ] **Step 2: Add `setOrgName` + `name` to settings**

In `features/org/settings.ts`, add `name` to the `getOrgSettings` select + return, and append a `setOrgName` action:
```typescript
// in getOrgSettings: select {name: true, optOutMode: true, optOutDetector: true, senderSignature: true}; return {name: org?.name ?? "", optOutMode: ..., optOutDetector: ..., senderSignature: ...}
export async function setOrgName(_prev: unknown, formData: FormData): Promise<{ok: boolean}> {
	const {orgId} = await requireOrg()
	const name = String(formData.get("name") ?? "").trim().slice(0, 120)
	if (!name) return {ok: false}
	await prisma.organization.update({where: {id: orgId}, data: {name}})
	revalidatePath("/ustawienia")
	return {ok: true}
}
```

- [ ] **Step 3: Migrate the two existing forms to primitives + toast**

Rewrite `app/(app)/ustawienia/sender-signature-form.tsx` using `Field`/`Textarea`/`Note`/`Button` + `useToast` (replaces the inline amber span + raw button; on `state.ok` fire a toast):
```tsx
"use client"
// app/(app)/ustawienia/sender-signature-form.tsx
import {useActionState, useEffect, useState} from "react"
import {setSenderSignature} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Textarea} from "@/components/ui/textarea"
import {Note} from "@/components/ui/note"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function SenderSignatureForm({signature}: {signature: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setSenderSignature, null)
	const [value, setValue] = useState(signature)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano podpis nadawcy") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label={"Podpis nadawcy (token {{podpisNadawcy}})"} hint={"Wstawiany dosłownie w miejsce {{podpisNadawcy}}. Maks. 2000 znaków."}>
				<Textarea name="senderSignature" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-lg" placeholder={"Pozdrawiam,\nJan Kowalski"} />
			</Field>
			{value.trim() === "" ? <Note variant="warning">Nieustawiony — przy wysyłce zostanie użyta nazwa skrzynki.</Note> : null}
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
```

Rewrite `app/(app)/ustawienia/settings-form.tsx` (opt-out) using `Field`/`Select`/`Button` + toast (same `useActionState` contract, keep the `optOutMode`/`optOutDetector` selects, props unchanged):
```tsx
"use client"
// app/(app)/ustawienia/settings-form.tsx
import {useActionState, useEffect} from "react"
import {setOrgInboundSettings} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function SettingsForm({optOutMode, optOutDetector}: {optOutMode: string; optOutDetector: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgInboundSettings, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano ustawienia") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label="Wykrywanie rezygnacji">
				<Select name="optOutMode" defaultValue={optOutMode} className="max-w-xs">
					<option value="OFF">OFF — nie wykrywaj</option>
					<option value="SUGGEST">SUGGEST — flaguj, klikam ręcznie</option>
					<option value="AUTO">AUTO — sam suppresuj</option>
				</Select>
			</Field>
			<Field label="Metoda">
				<Select name="optOutDetector" defaultValue={optOutDetector} className="max-w-xs">
					<option value="KEYWORD">Lista fraz</option>
					<option value="LLM">LLM (wymaga ANTHROPIC_API_KEY)</option>
				</Select>
			</Field>
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
```

Create `app/(app)/ustawienia/general-form.tsx`:
```tsx
"use client"
// app/(app)/ustawienia/general-form.tsx
import {useActionState, useEffect} from "react"
import {setOrgName} from "@/features/org/settings"
import {Field} from "@/components/ui/field"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {useToast} from "@/components/ui/use-toast"

export function GeneralForm({name}: {name: string}) {
	const [state, action, pending] = useActionState<{ok: boolean} | null, FormData>(setOrgName, null)
	const toast = useToast()
	useEffect(() => { if (state?.ok) toast("Zapisano nazwę organizacji") }, [state, toast])
	return (
		<form className="flex flex-col gap-3" action={action}>
			<Field label="Nazwa organizacji">
				<Input name="name" defaultValue={name} className="max-w-xs" />
			</Field>
			<Button type="submit" variant="primary" disabled={pending} className="w-fit">Zapisz</Button>
		</form>
	)
}
```

- [ ] **Step 4: Settings shell with the fluid body (Motion)**

Create `app/(app)/ustawienia/settings-shell.tsx`:
```tsx
"use client"
// app/(app)/ustawienia/settings-shell.tsx
import {useState} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"
import {Card, CardBody} from "@/components/ui/card"

export interface SettingsSection {
	id: string
	label: string
	content: React.ReactNode
}

export function SettingsShell({sections}: {sections: SettingsSection[]}) {
	const [active, setActive] = useState(sections[0]?.id)
	const reduce = useReducedMotion()
	const current = sections.find((s) => s.id === active) ?? sections[0]
	return (
		<div className="grid grid-cols-[200px_1fr] gap-10 max-md:grid-cols-1">
			<nav className="flex flex-col gap-px max-md:flex-row max-md:flex-wrap">
				{sections.map((s) => (
					<button
						key={s.id}
						type="button"
						aria-current={s.id === active ? "true" : undefined}
						onClick={() => setActive(s.id)}
						className={cn(
							"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-150",
							s.id === active ? "bg-surface-2 text-fg before:absolute before:-left-px before:top-1/2 before:h-[15px] before:w-[2.5px] before:-translate-y-1/2 before:rounded before:bg-accent" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
						)}
					>
						{s.label}
					</button>
				))}
			</nav>
			<div className="min-h-[300px]">
				<AnimatePresence mode="wait">
					<motion.div
						key={current?.id}
						initial={reduce ? false : {opacity: 0, y: 8}}
						animate={{opacity: 1, y: 0}}
						exit={reduce ? {opacity: 0} : {opacity: 0, y: -4}}
						transition={{duration: 0.24, ease: [0.165, 0.84, 0.44, 1]}}
					>
						<h2 className="text-[15px] font-semibold tracking-[-0.02em]">{current?.label}</h2>
						<Card className="mt-4"><CardBody>{current?.content}</CardBody></Card>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
```

- [ ] **Step 5: Rewrite the settings page to use the shell**

Replace `app/(app)/ustawienia/page.tsx`:
```tsx
// app/(app)/ustawienia/page.tsx
import {getOrgSettings} from "@/features/org/settings"
import {SettingsShell, type SettingsSection} from "./settings-shell"
import {GeneralForm} from "./general-form"
import {SenderSignatureForm} from "./sender-signature-form"
import {SettingsForm} from "./settings-form"

export default async function SettingsPage() {
	const s = await getOrgSettings()
	const sections: SettingsSection[] = [
		{id: "ogolne", label: "Ogólne", content: <GeneralForm name={s.name} />},
		{id: "podpis", label: "Podpis nadawcy", content: <SenderSignatureForm signature={s.senderSignature} />},
		{id: "optout", label: "Wykrywanie rezygnacji", content: <SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />},
	]
	return (
		<section className="flex flex-col gap-6">
			<div>
				<h1 className="text-[21px] font-semibold tracking-[-0.025em]">Ustawienia</h1>
				<p className="mt-0.5 text-[13px] text-fg-muted">Konfiguracja organizacji, wysyłki i zespołu.</p>
			</div>
			<SettingsShell sections={sections} />
		</section>
	)
}
```

- [ ] **Step 6: Typecheck + full suite + build + commit**

Run: `npx tsc --noEmit` (0). Run: `npx vitest run` (prior + new theme/variant/toast/confirm tests pass). Run: `npm run build` (dev OFF; expect green, `/ustawienia` present).
```bash
git add package.json package-lock.json features/org/settings.ts "app/(app)/ustawienia"
git commit -m "feat(phase7): /ustawienia reference surface — settings shell + fluid body (Motion) + primitives"
```

---

## Task 10: Final gates + roadmap + graph

**Files:** Modify `docs/superpowers/ROADMAP.md`.

- [ ] **Step 1: Lint the new code** — `npx eslint components/ui features/theme "app/(app)/ustawienia" "app/(app)/layout.tsx" app/layout.tsx` (expect clean; fix any unused imports / `any`).
- [ ] **Step 2: Full typecheck** — `npx tsc --noEmit` (0).
- [ ] **Step 3: Full test suite** — `npx vitest run` (expect 198 + new pure tests: theme 2, button-variants 3, toast-reducer 2, confirm-state 2 = 207).
- [ ] **Step 4: Production build** — `npm run build` (dev OFF; green, all routes present).
- [ ] **Step 5: Update `docs/superpowers/ROADMAP.md`** — mark `design-foundation` DONE + verified (code/test/build); note tokens+primitives+scaffolding shipped, `/ustawienia` is the reference surface, runtime default = light during migration (dark built + toggle-able), next sub-project = `destructive-action-safety` (ConfirmDialog now exists). Update the test count.
- [ ] **Step 6: Refresh the graph** — `graphify update .`.
- [ ] **Step 7: Commit** —
```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark design-foundation DONE (code/test/build) + refresh graph"
```

---

## Self-review

**Spec coverage:** tokens+`@theme` (T1) ✓; fonts+theme bootstrap (T1) ✓; primitives Button/Badge (T2), Input/Textarea/Select/Field/Note (T3), Card/Table/Switch/EmptyState/Spinner/Icons (T4), Toast (T5), ConfirmDialog (T6) ✓; scaffolding container/toggle/nav + a11y skip-link/focus/aria-current (T7), route boundaries (T8) ✓; reference surface `/ustawienia` full shell + fluid body + 3 sections + `setOrgName` (T9) ✓; Motion dep (T9) ✓; gates+roadmap+graph (T10) ✓. All three resolved decisions honored (full shell, Motion, hand-rolled theme).

**Placeholder scan:** every code step has complete code; no TBD/TODO. The `getOrgSettings` edit in T9 Step 2 is described as an inline change with the exact select/return shape — the implementer has the current file (committed) to edit precisely.

**Type consistency:** `buttonVariant(v?)`/`ButtonVariant` (T2) used by Button (T2), ConfirmDialog (T6), forms (T9). `useToast(): ToastFn` (T5) used in T9 forms. `useConfirm`/`ConfirmProvider` (T6) mounted in the app layout (T7). `SettingsSection {id,label,content}` (T9 shell) matches the page (T9). Token utility names (T1) used consistently across all components.

**Risks:** (1) `@theme inline` re-theming — if utilities don't recolor on `[data-theme]` flip, confirm the `inline` keyword + that `var(--x)` indirection resolves (shadcn-v4 pattern, expected to work). (2) `Geist_Mono` from `next/font/google` — fallback to the `geist` package (noted T1 Step 7). (3) Dark default deferred to light during migration (un-converted pages stay readable) — documented; flip after page-level-visual-pass. (4) Component-level rendering is validated by tsc/build + the sketch, not jsdom tests (project has no component-test setup; out of scope).
