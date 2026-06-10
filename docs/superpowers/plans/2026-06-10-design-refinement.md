# Design Refinement (mono UI + Linear micro-accent) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the app to a monochrome UI where the accent (Linear indigo `#5e6ad2` light / `#828fff` dark) survives only on the logo dot, active-tab bars, checked controls, and keyboard focus — plus finish the remaining rough surfaces (login, route states, shadow scale, dead tokens).

**Architecture:** Pure-presentation change driven by `app/globals.css` tokens (Tailwind v4 `@theme inline`). Tokens land first (Task 1) because later tasks reference the new `border-focus` / `shadow-*` utilities; Tasks 2-10 are then independent class-string swaps per surface; Task 11 runs gates + guard greps. Spec: `docs/superpowers/specs/2026-06-10-design-refinement-design.md`.

**Tech Stack:** Next 16 (App Router), Tailwind v4 tokens, React 19. No new dependencies, no migration, no server/behavior changes.

**Testing note:** No new unit tests — there is no new logic anywhere in this plan (class strings, CSS values, one static page). Verification = exact guard greps per task + the Task 11 gates (`tsc`, `vitest` 258 unchanged, `eslint`, `next build`). Do NOT "drive-by improve" anything outside the listed edits.

**Conventions (binding):** tabs, no semicolons, path comment on line 1 (line 2 after a directive), `className` first attribute, no emoji. The user pushes; you may commit.

## File map

- Modify: `app/globals.css` (Task 1)
- Modify: `components/ui/input.tsx`, `components/ui/select.tsx`, `components/ui/textarea.tsx` (Task 2)
- Modify: `components/ui/badge.tsx`, `components/ui/note.tsx` (Task 3)
- Modify: `components/ui/card.tsx`, `app/(app)/pipeline/card.tsx`, `components/ui/modal.tsx`, `components/ui/toast-provider.tsx`, `app/(app)/sidebar.tsx` (shadow only) (Task 4)
- Modify: `components/ui/confirm.tsx` (Task 5)
- Modify: `app/(app)/sidebar.tsx` (icon + avatar) (Task 6)
- Modify: 13 link-site files (Task 7)
- Modify: `app/(app)/dashboard-parts.tsx`, `app/(app)/page.tsx`, `app/(app)/leady/import/import-wizard.tsx`, `app/(app)/leady/lead-create-button.tsx`, `app/(app)/skrzynki/page.tsx`, `app/(app)/pipeline/board.tsx` (Task 8)
- Rewrite: `app/logowanie/page.tsx` (Task 9)
- Modify: `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/not-found.tsx`, `app/not-found.tsx` (Task 10)
- Modify: `docs/superpowers/ROADMAP.md` (Task 11)

NOT touched (accent allowlist, verified in Task 11): `app/(app)/sidebar.tsx` logo dot + active `before:bg-accent` bar, `app/(app)/ustawienia/settings-shell.tsx` active rail, `components/ui/switch.tsx` checked `bg-accent`, `app/(app)/skrzynki/mailbox-settings-form.tsx` day chips, the `:focus-visible` rule. Plus the new login logo dot (Task 9) joins the allowlist.

---

### Task 1: Tokens + confirmIn keyframe (`app/globals.css`)

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the `:root` block**

Old:

```css
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
```

New:

```css
:root {
	--bg: #fbfbfc;
	--surface-1: #ffffff; --surface-2: #f6f6f7; --surface-3: #efeff1;
	--border: rgba(9,9,11,.09); --border-strong: rgba(9,9,11,.16); --border-focus: rgba(9,9,11,.45);
	--text: #18181b; --text-muted: #56565e; --text-faint: #9b9ba3;
	--accent: #5e6ad2; --accent-quiet: rgba(94,106,210,.10);
	--primary-bg: #18181b; --primary-fg: #fafafa;
	--success: #16a34a; --success-quiet: rgba(22,163,74,.10);
	--danger: #dc2626; --danger-quiet: rgba(220,38,38,.09);
	--warning: #b45309; --warning-quiet: rgba(180,83,9,.10);
	--ring: rgba(94,106,210,.45);
	--selection: rgba(9,9,11,.12);
}
```

- [ ] **Step 2: Replace the `[data-theme="dark"]` block**

Old:

```css
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
```

New:

```css
[data-theme="dark"] {
	--bg: #08090a;
	--surface-1: #131316; --surface-2: #1a1a1f; --surface-3: #212127;
	--border: rgba(255,255,255,.08); --border-strong: rgba(255,255,255,.15); --border-focus: rgba(255,255,255,.55);
	--text: #f3f3f4; --text-muted: #9a9aa3; --text-faint: #66666f;
	--accent: #828fff; --accent-quiet: rgba(130,143,255,.14);
	--primary-bg: #fafafa; --primary-fg: #0a0a0b;
	--success: #3ddc97; --success-quiet: rgba(61,220,151,.13);
	--danger: #ff6b6b; --danger-quiet: rgba(255,107,107,.13);
	--warning: #f5c451; --warning-quiet: rgba(245,196,81,.13);
	--ring: rgba(130,143,255,.60);
	--selection: rgba(255,255,255,.16);
}
```

- [ ] **Step 3: Extend the `@theme inline` block**

Keep `--color-ring: var(--ring);` — it IS referenced (`focus:ring-ring` on the skip link in `app/(app)/layout.tsx`). After that line, add:

```css
	--color-border-focus: var(--border-focus);
	--shadow-card: 0 1px 2px rgba(9,9,11,.04);
	--shadow-pop: 0 8px 24px -12px rgba(0,0,0,.35);
	--shadow-modal: 0 16px 48px -16px rgba(0,0,0,.5);
```

(`--shadow-card` is a small extension over the spec: `Card` and the pipeline card carry a `shadow-[0_1px_2px_rgba(9,9,11,.04)]` literal that would break the "zero `shadow-[` literals" guard — tokenizing it keeps the guard absolute.)

- [ ] **Step 4: Neutral `::selection` + confirmIn keyframe in `@layer base`**

Old: `::selection { background: var(--accent-quiet); }`
New: `::selection { background: var(--selection); }`

After the `@keyframes toastIn` line, add:

```css
	@keyframes confirmIn { from { opacity: 0; transform: scale(.96) translateY(8px); } to { opacity: 1; transform: none; } }
```

(The existing global `prefers-reduced-motion` reset already covers it — no extra media query needed.)

- [ ] **Step 5: Verify dead token is gone**

Run: `rg -n "bg-glow" app components`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): mono token base - Linear accent, border-focus, selection, shadow scale, drop bg-glow"
```

---

### Task 2: Hairline focus on Input / Select / Textarea

**Files:**
- Modify: `components/ui/input.tsx:5`, `components/ui/select.tsx:10`, `components/ui/textarea.tsx:10`

In all three, the SAME three changes inside the class string: `transition-[border-color,box-shadow,background]` → `transition-[border-color,background]`; `focus:border-accent` → `focus:border-border-focus`; drop ` focus:[box-shadow:0_0_0_3px_var(--accent-quiet)]` entirely.

- [ ] **Step 1: `input.tsx` — replace the `base` string**

```ts
const base = "w-full rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-fg-faint transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-none focus:border-border-focus focus:bg-surface-1"
```

- [ ] **Step 2: `select.tsx` — replace the `<select>` className**

```ts
className="w-full cursor-pointer appearance-none rounded-md border border-border bg-surface-2 py-2 pl-2.5 pr-8 text-[13px] text-fg transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-none focus:border-border-focus focus:bg-surface-1"
```

- [ ] **Step 3: `textarea.tsx` — replace the first `cn()` argument**

```ts
"w-full min-h-24 resize-y rounded-md border border-border bg-surface-2 p-2.5 font-mono text-[12.5px] leading-relaxed text-fg placeholder:text-fg-faint transition-[border-color,background] duration-150 hover:border-border-strong focus:outline-none focus:border-border-focus focus:bg-surface-1"
```

- [ ] **Step 4: Verify the glow is dead**

Run: `rg -n "0_0_0_3px" app components`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add components/ui/input.tsx components/ui/select.tsx components/ui/textarea.tsx
git commit -m "feat(design): hairline neutral focus on form controls - no glow"
```

---

### Task 3: Neutral Badge `info` + Note `info`

**Files:**
- Modify: `components/ui/badge.tsx:11`, `components/ui/note.tsx:6`

- [ ] **Step 1: `badge.tsx` — info variant**

Old: `	info: "bg-accent-quiet text-accent",`
New: `	info: "bg-surface-3 text-fg border border-border",`

(`neutral` keeps `text-fg-muted`, so `info` still reads one step stronger. Variant keys/API unchanged — zero caller edits.)

- [ ] **Step 2: `note.tsx` — info variant**

Old: `	info: "bg-accent-quiet text-accent border-accent/25",`
New: `	info: "bg-surface-2 text-fg-muted border-border",`

- [ ] **Step 3: Commit**

```bash
git add components/ui/badge.tsx components/ui/note.tsx
git commit -m "feat(design): neutral info badge and note - accent off the tint surfaces"
```

---

### Task 4: Shadow tokens adoption (5 literals → 3 utilities)

**Files:**
- Modify: `components/ui/card.tsx:4`, `app/(app)/pipeline/card.tsx:17`, `components/ui/modal.tsx:42`, `components/ui/toast-provider.tsx:22`, `app/(app)/sidebar.tsx:111`

- [ ] **Step 1: swap the five literals**

| File | Old fragment | New fragment |
|---|---|---|
| `components/ui/card.tsx` | `shadow-[0_1px_2px_rgba(9,9,11,.04)]` | `shadow-card` |
| `app/(app)/pipeline/card.tsx` | `shadow-[0_1px_2px_rgba(9,9,11,.04)]` | `shadow-card` |
| `components/ui/modal.tsx` | `shadow-[0_24px_64px_-24px_rgba(0,0,0,.8)]` | `shadow-modal` |
| `components/ui/toast-provider.tsx` | `shadow-[0_8px_24px_-16px_rgba(0,0,0,.4)]` | `shadow-pop` |
| `app/(app)/sidebar.tsx` (account dropdown) | `shadow-[0_12px_32px_-16px_rgba(0,0,0,.6)]` | `shadow-pop` |

Each is a literal substring swap inside an otherwise-unchanged className.

- [ ] **Step 2: Verify zero arbitrary shadows remain**

Run: `rg -n "shadow-\[" app components`
Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add components/ui/card.tsx app/(app)/pipeline/card.tsx components/ui/modal.tsx components/ui/toast-provider.tsx "app/(app)/sidebar.tsx"
git commit -m "feat(design): single shadow scale - card/pop/modal tokens replace ad-hoc literals"
```

---

### Task 5: Confirm dialog — shadow + CSS-only entrance

**Files:**
- Modify: `components/ui/confirm.tsx:33`

- [ ] **Step 1: extend the `<dialog>` className**

Old:

```tsx
					className="m-auto w-[380px] max-w-[calc(100vw-32px)] rounded-lg border border-border-strong bg-surface-1 p-[18px] text-fg backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
```

New:

```tsx
					className="m-auto w-[380px] max-w-[calc(100vw-32px)] rounded-lg border border-border-strong bg-surface-1 p-[18px] text-fg shadow-modal open:[animation:confirmIn_.2s_var(--ease-out-quart)] backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
```

Rationale (web-animation-design): entering element → ease-out, 200ms (modal class), transform+opacity only; the `open:` variant fires the keyframe each `showModal()`; exit stays instant (native `close()`); the global reduced-motion reset neutralizes it. Same idiom as the toast's `[animation:toastIn_.3s_var(--ease-out)]`.

- [ ] **Step 2: Commit**

```bash
git add components/ui/confirm.tsx
git commit -m "feat(design): confirm dialog gets shadow-modal and a 200ms ease-out entrance"
```

---

### Task 6: Sidebar — mono icon + neutral avatar

**Files:**
- Modify: `app/(app)/sidebar.tsx:49,105`

KEEP untouched: the logo dot (`<span className="text-accent">●</span>`) and the active bar (`before:bg-accent`).

- [ ] **Step 1: active icon loses its accent**

Old: `			<Icon className={cn("size-[18px] flex-none", active && "text-accent")} />`
New: `			<Icon className="size-[18px] flex-none" />`

(`cn` stays imported — used elsewhere in the file.)

- [ ] **Step 2: avatar goes neutral**

Old: `						<span className="grid size-7 flex-none place-items-center rounded-full bg-accent text-[10px] font-bold text-primary-fg">{initials}</span>`
New: `						<span className="grid size-7 flex-none place-items-center rounded-full bg-surface-3 text-[10px] font-bold text-fg">{initials}</span>`

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/sidebar.tsx"
git commit -m "feat(design): sidebar mono - active icon and avatar lose accent, dot and bar keep it"
```

---

### Task 7: Links sweep — two recipes, 16 sites

**Files:** 13 files listed below.

Recipes:
- **Data link** (entity/row links): `text-fg font-medium hover:underline underline-offset-2`
- **Secondary link** (back/aux actions): `text-fg-muted hover:text-fg hover:underline underline-offset-2`
- **Inline-prose link** (one site): link inside muted running text must be findable without hover → `text-fg underline underline-offset-2` (always underlined). Deviation from spec §2's blanket secondary recipe, justified: `text-fg-muted` inside a `text-fg-muted` paragraph would be invisible.

- [ ] **Step 1: secondary links (9 sites)** — replace each className:

| File:line | Old className | New className |
|---|---|---|
| `app/(app)/szablony/page.tsx:48` | `text-sm text-accent hover:underline` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/import/page.tsx:20` | `text-sm text-accent hover:underline` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/import/import-wizard.tsx:184` | `text-sm text-accent hover:underline` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/[id]/page.tsx:36` | `text-sm text-accent` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/kampanie/[id]/page.tsx:51` | `text-sm text-accent` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/badania/batches/[id]/page.tsx:14` | `text-sm text-accent` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/page.tsx:55` | `text-sm text-accent` | `text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/lead-create-button.tsx:83` | `text-[11.5px] text-accent hover:underline` | `text-[11.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2` |
| `app/(app)/leady/[id]/lead-edit-form.tsx:112` | `self-start text-xs text-accent` | `self-start text-xs text-fg-muted hover:text-fg hover:underline underline-offset-2` |

- [ ] **Step 2: data links (3 sites)**

| File:line | Old className | New className |
|---|---|---|
| `app/(app)/leady/page.tsx:106` | `text-accent hover:underline` | `text-fg font-medium hover:underline underline-offset-2` |
| `app/(app)/badania/batches/[id]/batch-view.tsx:151` | `text-accent hover:underline` | `text-fg font-medium hover:underline underline-offset-2` |
| `app/(app)/page.tsx:92` | `font-medium text-fg hover:text-accent` | `font-medium text-fg hover:underline underline-offset-2` |

- [ ] **Step 3: hover-only title links (3 sites)** — parent already styles them `text-sm font-semibold text-fg`:

| File:line | Old className | New className |
|---|---|---|
| `app/(app)/badania/page.tsx:45` | `truncate hover:text-accent` | `truncate hover:underline underline-offset-2` |
| `app/(app)/badania/page.tsx:72` | `truncate hover:text-accent` | `truncate hover:underline underline-offset-2` |
| `app/(app)/kampanie/page.tsx:43` | `truncate hover:text-accent` | `truncate hover:underline underline-offset-2` |

- [ ] **Step 4: inline-prose link (1 site)**

`app/(app)/kampanie/[id]/sending-controls.tsx:58`:
Old: `<a className="text-accent" href="/skrzynki">`
New: `<a className="text-fg underline underline-offset-2" href="/skrzynki">`

- [ ] **Step 5: Verify no text-accent links remain**

Run: `rg -n "text-accent|hover:text-accent" app`
Expected: exactly 3 matches until Task 8 lands — `app/(app)/sidebar.tsx` (logo dot), `app/(app)/skrzynki/mailbox-settings-form.tsx` (day chips `peer-checked:text-accent`), and `app/(app)/skrzynki/page.tsx` (the "odpowiedzi: on" pill — Task 8 scope, do NOT touch it here). After Task 8 it drops to 2; after Task 9 the login dot makes it 3 again.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat(design): mono links - fg plus underline replaces accent across 16 sites"
```

---

### Task 8: Charts, progress, pills, drag-over go neutral

**Files:**
- Modify: `app/(app)/dashboard-parts.tsx:44-58`, `app/(app)/page.tsx:99`, `app/(app)/leady/import/import-wizard.tsx:128`, `app/(app)/leady/lead-create-button.tsx:105`, `app/(app)/skrzynki/page.tsx:52`, `app/(app)/pipeline/board.tsx:52`

- [ ] **Step 1: Sparkline → fg ink (`dashboard-parts.tsx`)**

Old:

```tsx
					<stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
					<stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
```
```tsx
			<path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--accent)" /> : null}
```

New:

```tsx
					<stop offset="0" stopColor="var(--text)" stopOpacity=".12" />
					<stop offset="1" stopColor="var(--text)" stopOpacity="0" />
```
```tsx
			<path d={line} fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
			{end ? <circle cx={end.x} cy={end.y} r="2.5" fill="var(--text)" /> : null}
```

- [ ] **Step 2: FunnelRow — neutral default tone, renamed honestly**

The tone value `"accent"` would no longer be accent-colored, and the literal would pollute the Task 11 guard grep — rename it to `"neutral"` at all 3 places.

`app/(app)/dashboard-parts.tsx:55` (signature + default):
Old: `export function FunnelRow({label, count, max, tone = "accent"}: {label: string; count: number; max: number; tone?: "accent" | "won" | "lost"}) {`
New: `export function FunnelRow({label, count, max, tone = "neutral"}: {label: string; count: number; max: number; tone?: "neutral" | "won" | "lost"}) {`

`app/(app)/dashboard-parts.tsx:58` (fill):
Old: `	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-accent"`
New: `	const fill = tone === "won" ? "bg-success" : tone === "lost" ? "bg-danger/55" : "bg-fg-muted"`

`app/(app)/page.tsx:60` (call site):
Old: `tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "accent"}`
New: `tone={f.stage === "WON" ? "won" : f.stage === "LOST" ? "lost" : "neutral"}`

- [ ] **Step 3: dashboard reply-rate mini bar (`app/(app)/page.tsx:99`)**

In the line `<span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{width: ...}} />`: `bg-accent` → `bg-fg`.

- [ ] **Step 4: wizard step bars (2 files)**

`app/(app)/leady/import/import-wizard.tsx:128` and `app/(app)/leady/lead-create-button.tsx:105`:
Old: `className="h-full rounded-full bg-accent"`
New: `className="h-full rounded-full bg-fg"`

- [ ] **Step 5: skrzynki "odpowiedzi: on" pill (`app/(app)/skrzynki/page.tsx:52`)**

Old: `<span className="rounded-full bg-accent-quiet px-2 py-0.5 text-xs text-accent">odpowiedzi: on</span>`
New: `<span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs text-fg-muted">odpowiedzi: on</span>`

- [ ] **Step 6: pipeline drag-over (`app/(app)/pipeline/board.tsx:52`)**

In the template string `${over ? "bg-accent-quiet" : "bg-surface-2"}`: `bg-accent-quiet` → `bg-surface-3`.

- [ ] **Step 7: Verify bg-accent / accent-quiet surface**

Run: `rg -n "bg-accent|accent-quiet" app components`
Expected: only `components/ui/switch.tsx` (checked `bg-accent`), `app/(app)/sidebar.tsx` (`before:bg-accent`), `app/(app)/ustawienia/settings-shell.tsx` (`before:bg-accent`), `app/(app)/skrzynki/mailbox-settings-form.tsx` (`peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent`), `app/globals.css` (token definitions).

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/dashboard-parts.tsx" "app/(app)/page.tsx" "app/(app)/leady/import/import-wizard.tsx" "app/(app)/leady/lead-create-button.tsx" "app/(app)/skrzynki/page.tsx" "app/(app)/pipeline/board.tsx"
git commit -m "feat(design): neutral charts, progress bars, pills and drag-over"
```

---

### Task 9: Login page rebuild

**Files:**
- Rewrite: `app/logowanie/page.tsx`

- [ ] **Step 1: replace the whole file**

```tsx
// app/logowanie/page.tsx
import {signIn, auth} from "@/lib/auth"
import {redirect} from "next/navigation"
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"

export default async function LoginPage() {
	const session = await auth()
	if (session?.user) redirect("/leady")

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-[360px] flex-col justify-center gap-5 p-6">
			<div className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.02em]">
				<span className="text-[9px] text-accent">●</span> cold·mail
			</div>
			<Card>
				<CardBody className="flex flex-col gap-4">
					<div>
						<h1 className="text-[15px] font-semibold tracking-[-0.02em]">Zaloguj się</h1>
						<p className="mt-1 text-[12.5px] text-fg-muted">Wewnętrzne narzędzie cold mailingu. Dostęp przez konto Google.</p>
					</div>
					<form
						action={async () => {
							"use server"
							await signIn("google", {redirectTo: "/leady"})
						}}
					>
						<Button className="w-full justify-center" type="submit">
							<svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 11v2.7h6.4c-.26 1.65-1.93 4.84-6.4 4.84-3.85 0-6.99-3.19-6.99-7.12S8.15 4.3 12 4.3c2.19 0 3.66.93 4.5 1.74l2.07-2C17.24 2.8 14.86 1.8 12 1.8 6.48 1.8 2 6.28 2 11.8s4.48 10 10 10c5.77 0 9.6-4.06 9.6-9.77 0-.66-.07-1.16-.16-1.66H12z"/></svg>
							Zaloguj przez Google
						</Button>
					</form>
				</CardBody>
			</Card>
			<p className="text-center text-[11.5px] text-fg-faint">Dostęp tylko dla zaproszonych kont.</p>
		</main>
	)
}
```

Notes: the auth flow is byte-identical (session check, inline `"use server"` action, `redirectTo: "/leady"`). `Button` has no `"use client"` directive — safe to render in a server component; no `variant` prop → `secondary`. The G mark is monochrome `currentColor` (mono UI — no brand colors). The logo dot joins the accent allowlist.

- [ ] **Step 2: Commit**

```bash
git add app/logowanie/page.tsx
git commit -m "feat(design): login page to design-foundation level - card, wordmark, mono google button"
```

---

### Task 10: Route states (loading / error / 2x not-found)

**Files:**
- Modify: `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/not-found.tsx`, `app/not-found.tsx`

- [ ] **Step 1: loading caption**

Replace the whole `app/(app)/loading.tsx`:

```tsx
// app/(app)/loading.tsx
import {Spinner} from "@/components/ui/spinner"
export default function Loading() {
	return (
		<div className="grid place-items-center py-24">
			<div className="flex flex-col items-center gap-3 text-fg-faint">
				<Spinner />
				<span className="text-[12.5px]">Wczytywanie…</span>
			</div>
		</div>
	)
}
```

- [ ] **Step 2: error page gets a way home**

Replace the whole `app/(app)/error.tsx`:

```tsx
"use client"
// app/(app)/error.tsx
import Link from "next/link"
import {Card, CardBody} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
export default function Error({reset}: {error: Error; reset: () => void}) {
	return (
		<Card className="mx-auto max-w-md">
			<CardBody>
				<h2 className="text-sm font-semibold text-fg">Coś poszło nie tak</h2>
				<p className="mt-1 text-[12.5px] text-fg-muted">Wystąpił błąd podczas ładowania tej strony.</p>
				<div className="mt-4 flex items-center gap-3">
					<Button variant="secondary" onClick={reset}>Spróbuj ponownie</Button>
					<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć do pulpitu</Link>
				</div>
			</CardBody>
		</Card>
	)
}
```

- [ ] **Step 3: both not-found pages get an action link**

`app/(app)/not-found.tsx`:

```tsx
// app/(app)/not-found.tsx
import Link from "next/link"
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return (
		<EmptyState
			title="Nie znaleziono strony"
			description="Ten zasób nie istnieje lub został przeniesiony."
			action={<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć do pulpitu</Link>}
		/>
	)
}
```

`app/not-found.tsx`:

```tsx
// app/not-found.tsx
import Link from "next/link"
import {EmptyState} from "@/components/ui/empty-state"
export default function NotFound() {
	return (
		<div className="grid min-h-screen place-items-center bg-bg text-fg">
			<EmptyState
				title="404"
				description="Nie znaleziono strony."
				action={<Link className="text-[12.5px] text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/">Wróć na stronę główną</Link>}
			/>
		</div>
	)
}
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/loading.tsx" "app/(app)/error.tsx" "app/(app)/not-found.tsx" app/not-found.tsx
git commit -m "feat(design): quiet route states - loading caption, error and 404 escape links"
```

---

### Task 11: Gates, guard greps, graphify, ROADMAP

**Files:**
- Modify: `docs/superpowers/ROADMAP.md` (NEXT TASK line)

- [ ] **Step 1: TypeScript**

Run: `npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 2: Tests**

Run: `npx vitest run`
Expected: 258 passed (same count as before — no logic changed).

- [ ] **Step 3: Lint**

Run: `npx eslint app components`
Expected: clean (the known pre-existing `any` warnings live in `lib/inngest` test files, outside this scope).

- [ ] **Step 4: Production build (the twice-deferred gate)**

Precondition: the dev server must be OFF (user-run; it was OFF at handoff). If `npx next build` fails on a locked `.next`, STOP and report — do not kill user processes.
Run: `npx next build`
Expected: build success, 20 pages.

- [ ] **Step 5: Full accent guard grep**

Run: `rg -n "accent" app components --glob "!**/*.css"`
Expected matches ONLY in: `app/(app)/sidebar.tsx` (logo dot `text-accent`, active `before:bg-accent`), `app/(app)/ustawienia/settings-shell.tsx` (`before:bg-accent`), `components/ui/switch.tsx` (`bg-accent`), `app/(app)/skrzynki/mailbox-settings-form.tsx` (day-chip `peer-checked:*` trio), `app/logowanie/page.tsx` (logo dot `text-accent`).
Then: `rg -n "accent" app/globals.css` → only the token definitions and `--color-accent*` mappings.
Also re-run the three earlier guards (`bg-glow`, `0_0_0_3px`, `shadow-\[`) → all zero.

- [ ] **Step 6: graphify**

Run: `graphify update .`
Expected: graph refreshed (AST-only). Skip `--obsidian` (GEMINI_API_KEY unset).

- [ ] **Step 7: ROADMAP handoff line**

Update the `▶ NEXT TASK` paragraph in `docs/superpowers/ROADMAP.md`: design-refinement DONE + verified (mono UI + Linear micro-accent #5e6ad2/#828fff; accent allowlist = logo dots, active bars, switch/chips, focus-visible; hairline focus; shadow tokens; login/route-states rebuilt; `next build` GREEN — gate closed). Next: user live eyeball both themes, then the pre-launch items (team-role smoke, funded AI runs, deploy runbook).

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: design-refinement DONE - mono UI shipped, build gate closed"
```
