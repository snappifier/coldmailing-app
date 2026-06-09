# destructive-action-safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a confirmation dialog + pending state + consistent danger styling + success toast to 13 destructive actions, by building one `ConfirmButton` primitive and adopting it across the app.

**Architecture:** New client primitive `components/ui/confirm-button.tsx` wraps a bound server action: on click it `await`s the existing `useConfirm()` dialog, then runs the action in a `useTransition` (pending -> disabled + `Spinner`), then fires an optional `useToast`. Replace each `<form action={X.bind(null,id)}><button>…</button></form>` with `<ConfirmButton action={X.bind(null,id)} …>`. Two client sites (`cancelBatch`, `disconnect`) are handled specially. Spec: `docs/superpowers/specs/2026-06-09-phase-7-destructive-action-safety-design.md`.

**Tech Stack:** Next 16 (App Router, server actions), React 19 (`useTransition`), Tailwind v4 tokens, TypeScript 6.

**Conventions:** tabs, no semicolons, `"use client"` on line 1 then the path comment on line 2, `className` first, `import {x}` no inner spaces, NO emoji. Providers (`ToastProvider` > `ConfirmProvider`) are already mounted in `app/(app)/layout.tsx`.

**Testing note:** `ConfirmButton` is framework glue with no extractable pure logic, so it gets no new unit test (the existing `confirm-state` / `button-variant` / `toast-reducer` pure tests already cover the primitives it builds on). Gates are `tsc` 0, `eslint` clean, `next build` green, and `vitest` unchanged at 207 — matching how `design-foundation` verified pure UI.

---

## Task 1: ConfirmButton primitive

**Files:**
- Create: `components/ui/confirm-button.tsx`

- [ ] **Step 1: Create the component.** Exact content:

```tsx
"use client"
// components/ui/confirm-button.tsx
import {useTransition} from "react"
import {Button} from "@/components/ui/button"
import {Spinner} from "@/components/ui/spinner"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"
import type {ConfirmOptions} from "@/components/ui/confirm-state"
import type {ButtonVariant} from "@/components/ui/button-variants"

interface Props {
	action: () => Promise<unknown>
	confirm: ConfirmOptions
	children: React.ReactNode
	variant?: ButtonVariant
	size?: "sm" | "md"
	toast?: string
	className?: string
}

export function ConfirmButton({action, confirm, children, variant = "danger", size = "sm", toast, className}: Props) {
	const ask = useConfirm()
	const notify = useToast()
	const [pending, start] = useTransition()

	async function onClick() {
		if (!(await ask(confirm))) return
		start(async () => {
			await action()
			if (toast) notify(toast)
		})
	}

	return (
		<Button className={className} type="button" variant={variant} size={size} disabled={pending} onClick={onClick}>
			{pending ? <Spinner className="size-3.5" /> : null}
			{children}
		</Button>
	)
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0 errors.
- [ ] **Step 3: Commit.**

```bash
git add components/ui/confirm-button.tsx
git commit -m "feat(phase7): ConfirmButton primitive (confirm + pending + toast)"
```

---

## Task 2: Adopt at the 10 plain form-delete sites

Each site today is exactly: `<form action={ACTION}><button className="…text-danger…" type="submit">LABEL</button></form>`. For each, (a) add the import `import {ConfirmButton} from "@/components/ui/confirm-button"`, and (b) replace the whole `<form>…</form>` with a single `<ConfirmButton>` using the row's values from the table. All 10 use the default `variant="danger"` and `size="sm"` (do NOT pass `variant`/`size`). Keep the surrounding markup (the `<td>`, the `? :` conditionals like szablony's "w sekwencji" / timeline's `MANUAL.has(...)` / sequence-and-leads' wrapping `<form>` inside the `<li>`) intact — only the `<form>` element is replaced.

**Canonical transform (example — site #6 deleteLead in `leady/page.tsx`):**

Before:
```tsx
<form action={deleteLead.bind(null, lead.id)}>
	<button className="text-danger" type="submit">
		Usuń
	</button>
</form>
```
After:
```tsx
<ConfirmButton action={deleteLead.bind(null, lead.id)} confirm={{title: "Usunąć leada?", body: "Lead i jego dane zostaną usunięte. Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto leada">
	Usuń
</ConfirmButton>
```

**Per-site values** (all `confirmLabel` and label `children` shown; `danger: true` for every row in this task):

| # | File | `action` (bound) | `title` | `body` | `confirmLabel` / label | `toast` |
|---|---|---|---|---|---|---|
| 1 | `app/(app)/badania/page.tsx` | `deleteResearchType.bind(null, t.id)` | Usunąć typ badania? | Tej operacji nie można cofnąć. | Usuń | Usunięto typ badania |
| 2 | `app/(app)/placeholdery/page.tsx` | `deletePlaceholder.bind(null, p.id)` | Usunąć placeholder? | Tej operacji nie można cofnąć. | Usuń | Usunięto placeholder |
| 3 | `app/(app)/linie/page.tsx` | `deleteOfferingLine.bind(null, line.id)` | Usunąć linię usług? | Tej operacji nie można cofnąć. | Usuń | Usunięto linię |
| 4 | `app/(app)/szablony/page.tsx` | `deleteTemplate.bind(null, t.id)` | Usunąć szablon? | Tej operacji nie można cofnąć. | Usuń | Usunięto szablon |
| 5 | `app/(app)/kampanie/page.tsx` | `deleteCampaign.bind(null, c.id)` | Usunąć kampanię? | Kampania i jej powiązania zostaną usunięte. Tej operacji nie można cofnąć. | Usuń | Usunięto kampanię |
| 6 | `app/(app)/leady/page.tsx` | `deleteLead.bind(null, lead.id)` | Usunąć leada? | Lead i jego dane zostaną usunięte. Tej operacji nie można cofnąć. | Usuń | Usunięto leada |
| 7 | `app/(app)/leady/[id]/timeline.tsx` | `deleteLeadActivity.bind(null, it.id)` | Usunąć wpis? | Tej operacji nie można cofnąć. | Usuń | Usunięto wpis |
| 8 | `app/(app)/kampanie/[id]/sequence-and-leads.tsx` | `deleteSequenceStep.bind(null, s.id, campaignId)` | Usunąć krok sekwencji? | Tej operacji nie można cofnąć. | Usuń | Usunięto krok |
| 9 | `app/(app)/suppression/page.tsx` | `removeSuppression.bind(null, e.id)` | Usunąć z listy wykluczeń? | Adres będzie mógł ponownie otrzymywać wiadomości. | Usuń | Usunięto z wykluczeń |
| 13 | `app/(app)/kampanie/[id]/lead-inbox.tsx` | `markDoNotContact.bind(null, r.id)` | Oznaczyć: nie kontaktować? | Adres trafi na listę wykluczeń, a sekwencja zostanie zatrzymana. | Nie kontaktować | Oznaczono: nie kontaktować |

Notes: site #7 `timeline.tsx` keeps its `it.source === "activity" && MANUAL.has(it.kind) ? (…) : null` wrapper. Site #8 label is "Usuń"; the action takes two bound args (`s.id, campaignId`) — keep both. Site #13 label is "Nie kontaktować".

- [ ] **Step 1:** Apply the transform to all 10 files (add the import + swap the `<form>` for `<ConfirmButton>` per the table).
- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0 errors.
- [ ] **Step 3: Lint.** Run: `npx eslint "app/(app)"` — Expected: clean.
- [ ] **Step 4: Commit.**

```bash
git add "app/(app)/badania/page.tsx" "app/(app)/placeholdery/page.tsx" "app/(app)/linie/page.tsx" "app/(app)/szablony/page.tsx" "app/(app)/kampanie/page.tsx" "app/(app)/leady/page.tsx" "app/(app)/leady/[id]/timeline.tsx" "app/(app)/kampanie/[id]/sequence-and-leads.tsx" "app/(app)/suppression/page.tsx" "app/(app)/kampanie/[id]/lead-inbox.tsx"
git commit -m "feat(phase7): confirm + toast on 10 delete actions (ConfirmButton)"
```

---

## Task 3: disconnect-mailbox + pause-campaign

**Files:**
- Modify: `app/(app)/skrzynki/page.tsx`
- Modify: `app/(app)/kampanie/[id]/sending-controls.tsx`

**Site #10 — `skrzynki/page.tsx`** (currently an inline `use server` closure form). Add `import {ConfirmButton} from "@/components/ui/confirm-button"`. Replace:

```tsx
<form
	action={async () => {
		"use server"
		await disconnectEmailAccount(a.id)
	}}
>
	<button className="text-danger" type="submit">
		Odłącz
	</button>
</form>
```
with:
```tsx
<ConfirmButton action={disconnectEmailAccount.bind(null, a.id)} confirm={{title: "Odłączyć skrzynkę?", body: "Odłączenie usuwa też historię wiadomości tej skrzynki i wyłącza wykrywanie odpowiedzi. Tej operacji nie można cofnąć.", confirmLabel: "Odłącz", danger: true}} toast="Odłączono skrzynkę">
	Odłącz
</ConfirmButton>
```
(`disconnectEmailAccount` is already imported; the page stays a server component passing the bound action to the client `ConfirmButton`.)

**Site #11 — `sending-controls.tsx`** (client component). Add the import. Replace the pause form (lines ~45-49):

```tsx
<form action={pauseCampaign.bind(null, campaignId)}>
	<button className="rounded border border-border px-3 py-1.5 text-sm" type="submit">
		Pauza
	</button>
</form>
```
with (neutral `secondary` trigger, `size="md"` to match the neighbouring buttons, non-danger confirm):
```tsx
<ConfirmButton action={pauseCampaign.bind(null, campaignId)} confirm={{title: "Wstrzymać kampanię?", body: "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później.", confirmLabel: "Wstrzymaj", danger: false}} variant="secondary" size="md" toast="Wstrzymano kampanię">
	Pauza
</ConfirmButton>
```

- [ ] **Step 1:** Apply both edits.
- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0 errors.
- [ ] **Step 3: Commit.**

```bash
git add "app/(app)/skrzynki/page.tsx" "app/(app)/kampanie/[id]/sending-controls.tsx"
git commit -m "feat(phase7): confirm on disconnect-mailbox + pause-campaign"
```

---

## Task 4: cancel-batch (gate the existing client handler)

**Files:**
- Modify: `app/(app)/badania/batches/[id]/batch-view.tsx`

This component already has a client `onCancel` handler that needs `cancelBatch`'s result, so do NOT use `ConfirmButton`. Instead gate the handler with `useConfirm` and add a success toast via `useToast`.

- [ ] **Step 1:** Add the hooks. In the imports add `import {useConfirm} from "@/components/ui/use-confirm"` and `import {useToast} from "@/components/ui/use-toast"`. Inside the component body (near the other hooks) add:

```tsx
	const ask = useConfirm()
	const notify = useToast()
```

- [ ] **Step 2:** Replace the `onCancel` handler (lines ~56-63) with:

```tsx
	async function onCancel() {
		if (!(await ask({title: "Anulować badanie zbiorcze?", body: "Oczekujące zadania zostaną anulowane.", confirmLabel: "Anuluj badanie", cancelLabel: "Anuluj", danger: false}))) return
		setBusy(true)
		setMsg(null)
		const res = await cancelBatch(batchId)
		if (!res.ok) setMsg(res.error)
		else {
			notify("Anulowano badanie")
			await refresh()
		}
		setBusy(false)
	}
```

- [ ] **Step 3: Typecheck.** Run: `npx tsc --noEmit` — Expected: 0 errors.
- [ ] **Step 4: Commit.**

```bash
git add "app/(app)/badania/batches/[id]/batch-view.tsx"
git commit -m "feat(phase7): confirm on cancel-batch"
```

---

## Task 5: Gates + roadmap + graph

- [ ] **Step 1: Full gates.** Run (dev server OFF for the build):
  - `npx tsc --noEmit` — Expected: 0.
  - `npx vitest run` — Expected: 207 passed (unchanged).
  - `npx eslint "app/(app)" components` — Expected: clean.
  - `npm run build` — Expected: green.
- [ ] **Step 2: Update `docs/superpowers/ROADMAP.md`:** mark `destructive-action-safety` DONE + verified (code/test/build); note the new `ConfirmButton` primitive guards all 13 destructive actions (confirm + pending + danger styling + toast); set the next sub-project to `import-customfields-mapping`. Update the Phase 7 table row + the NEXT TASK line + the How-to-resume line.
- [ ] **Step 3:** `graphify update .` (AST-only, no API cost).
- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase7): mark destructive-action-safety DONE + refresh graph"
```

---

## Self-review

**Spec coverage:** ConfirmButton primitive (Task 1) ✓; all 13 sites — 10 plain swaps (Task 2) + disconnect & pause (Task 3) + cancel-batch (Task 4) ✓; danger vs secondary variant + per-site copy/toast encoded in the tables ✓; excluded `removeField`/sign-out untouched (not in any task) ✓; gates/roadmap/graph (Task 5) ✓.

**Placeholder scan:** every adoption row has concrete action binding + title + body + confirmLabel + toast; the primitive and both special cases show full code. No TBD.

**Type consistency:** `ConfirmButton` Props (`action`/`confirm`/`children`/`variant`/`size`/`toast`/`className`) are used consistently in Tasks 2-3; `confirm` matches the existing `ConfirmOptions` shape (`title`/`body?`/`confirmLabel?`/`cancelLabel?`/`danger?`); `cancelBatch` returns `BatchActionResult` so Task 4 keeps the result-handling handler rather than the void-action primitive.

**Notes:** Task 1 must land first (everything imports it). Tasks 2-4 are independent (disjoint files) and may be parallelized; commits stay per-task. Mechanical and low-risk — the only logic is the small primitive.
