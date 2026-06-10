# Creation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creation moves into modals (lead = 2-step wizard with a shared-layout morph), every library page gets a professional header (title + description + counts + primary action) — per spec `docs/superpowers/specs/2026-06-10-creation-ux-design.md`. The animation spec in that file is BINDING.

**Architecture:** Two new primitives (`Modal` on a native `<dialog>` + Motion panel; `PageHeader`). The lead wizard keeps ONE `<form>` with both steps mounted (inactive step `hidden`) so the FormData contract stays flat and uncontrolled; success side-effects run inside a `useActionState` wrapper (NOT in effects — the repo lints `set-state-in-effect`). Simple creates (kampania/linia/placeholder/wykluczenie) reuse their existing form components inside `Modal` via tiny client `*-create-button` islands; server pages keep their data fetching.

**Tech Stack:** Next 16 App Router, React 19 (`useActionState`), Motion 12 (`motion/react` — NEVER `framer-motion`), Tailwind v4 tokens, existing `components/ui/*`, `useToast` (`@/components/ui/use-toast`, returns a callable `toast(msg)`).

---

## Conventions (every step)

- Tabs, no semicolons, path comment line 1 (line 2 after `"use client"`), `className` FIRST prop, `import {x}` no inner spaces, NO emoji.
- Read every file before editing. Preserve every form field `name=` (set-diff check in T5). Gates per task: `npx tsc --noEmit` 0, `npx eslint <paths>` clean, `npx vitest run` green (258). One task = one commit, NO push, NO `next build` (dev live).
- Animation constants (binding): enter 200 ms ease-out-quart `[0.165, 0.84, 0.44, 1]`, exit 160 ms same ease; layout morph `{type: "spring", visualDuration: 0.25, bounce: 0}`; step content `x ±12 → 0` 200 ms ease-out-quart; `useReducedMotion` disables all (snap).

---

### Task 1: Primitives — `Modal` + `PageHeader`

**Files:**
- Create: `components/ui/modal.tsx`
- Create: `components/ui/page-header.tsx`

- [ ] **Step 1: `components/ui/modal.tsx`** (read `components/ui/confirm.tsx` first — same `<dialog>` idiom):

```tsx
"use client"
// components/ui/modal.tsx
import {useEffect, useRef} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"

const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const

// Native <dialog> shell (ESC + focus handled by the platform); the visual panel is a Motion child
// implementing the binding animation spec (enter 200ms ease-out-quart from scale .96, exit 160ms,
// layout morph spring visualDuration .25 bounce 0). Reduced motion snaps everything.
export function Modal({open, onClose, title, children, footer, width = 420}: {open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; width?: number}) {
	const ref = useRef<HTMLDialogElement>(null)
	const reduce = useReducedMotion()

	useEffect(() => {
		const dialog = ref.current
		if (!dialog) return
		if (open && !dialog.open) dialog.showModal()
		if (!open && dialog.open && reduce) dialog.close()
	}, [open, reduce])

	return (
		<dialog
			className="m-auto bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
			ref={ref}
			style={{width, maxWidth: "calc(100vw - 32px)"}}
			onCancel={(e) => {
				e.preventDefault()
				onClose()
			}}
			onClick={(e) => {
				if (e.target === ref.current) onClose()
			}}
		>
			<AnimatePresence onExitComplete={() => ref.current?.close()}>
				{open ? (
					<motion.div
						className="overflow-hidden rounded-lg border border-border-strong bg-surface-1 text-fg shadow-[0_24px_64px_-24px_rgba(0,0,0,.8)]"
						layout={!reduce}
						initial={reduce ? false : {opacity: 0, scale: 0.96, y: 8}}
						animate={{opacity: 1, scale: 1, y: 0}}
						exit={reduce ? {opacity: 0, transition: {duration: 0}} : {opacity: 0, scale: 0.97, transition: {duration: 0.16, ease: EASE_OUT_QUART}}}
						transition={{duration: 0.2, ease: EASE_OUT_QUART, layout: reduce ? {duration: 0} : {type: "spring", visualDuration: 0.25, bounce: 0}}}
					>
						<motion.div layout="position">
							<div className="px-[18px] pt-4">
								<h3 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
							</div>
							<div className="px-[18px] py-4">{children}</div>
							{footer ? <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/60 px-[18px] py-3">{footer}</div> : null}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</dialog>
	)
}
```
Notes: `layout="position"` on the inner wrapper prevents content squish during the panel's FLIP height morph. When `reduce` is true the dialog closes immediately (the effect) — `onExitComplete` still fires for the non-reduced path. Verify `visualDuration` exists in the installed Motion (`package.json` has ^12.40 — it does).

- [ ] **Step 2: `components/ui/page-header.tsx`** (server-safe, no client directive):

```tsx
// components/ui/page-header.tsx
export function PageHeader({title, description, meta, action}: {title: string; description?: string; meta?: React.ReactNode; action?: React.ReactNode}) {
	return (
		<div className="flex items-start justify-between gap-4 border-b border-border pb-4">
			<div className="min-w-0">
				<h1 className="text-[17px] font-semibold tracking-[-0.02em]">{title}</h1>
				{description ? <p className="mt-0.5 text-[12.5px] text-fg-muted">{description}</p> : null}
				{meta ? <p className="mt-1.5 text-[11px] tabular-nums text-fg-faint">{meta}</p> : null}
			</div>
			{action ? <div className="flex flex-none items-center gap-2">{action}</div> : null}
		</div>
	)
}
```

- [ ] **Step 3: Gates + commit** — `npx tsc --noEmit` 0; `npx eslint components/ui/modal.tsx components/ui/page-header.tsx` clean.
```bash
git add components/ui/modal.tsx components/ui/page-header.tsx
git commit -m "feat(creation-ux): Modal primitive (dialog + motion morph) + PageHeader"
```

---

### Task 2: Lead wizard + `createLead` additive fields + leady header

**Files:**
- Modify: `features/leads/actions.ts` (schema + create gain `honorific`/`phone`/`region` — columns exist, NO migration)
- Create: `app/(app)/leady/lead-create-button.tsx` (client: trigger + Modal + 2-step wizard)
- Modify: `app/(app)/leady/page.tsx` (PageHeader + counts + EmptyState CTA; delete the inline `LeadForm` usage)
- Delete: `app/(app)/leady/lead-form.tsx` (superseded; verify no other imports first)

- [ ] **Step 1: extend `leadFormSchema` + `createLead`** in `features/leads/actions.ts` — add to the schema object (after `contactRole`):
```ts
	honorific: z.string().trim().optional().transform((v) => (v === "PAN" || v === "PANI" ? (v as "PAN" | "PANI") : null)),
	phone: z.string().trim().optional().transform((v) => (v ? v : null)),
	region: z.string().trim().optional().transform((v) => (v ? v : null)),
```
`createLead` body unchanged (`...parsed.data` already spreads new fields). Type-check that Prisma accepts `honorific: "PAN" | "PANI" | null` (the `Honorific?` column).

- [ ] **Step 2: `app/(app)/leady/lead-create-button.tsx`:**

```tsx
"use client"
// app/(app)/leady/lead-create-button.tsx
import {useActionState, useRef, useState} from "react"
import Link from "next/link"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {createLead, type LeadActionResult} from "@/features/leads/actions"
import {Modal} from "@/components/ui/modal"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"

const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const
const STEPS = ["Organizacja", "Kontakt"] as const

export function LeadCreateButton({offeringLines, variant = "primary"}: {offeringLines: {id: string; name: string}[]; variant?: "primary" | "secondary"}) {
	const [open, setOpen] = useState(false)
	const [step, setStep] = useState(0)
	const formRef = useRef<HTMLFormElement>(null)
	const stepRef = useRef<HTMLDivElement>(null)
	const toast = useToast()
	const reduce = useReducedMotion()

	const [state, formAction, pending] = useActionState<LeadActionResult | null, FormData>(
		async (prev, formData) => {
			const res = await createLead(prev, formData)
			if (res.ok) {
				toast("Dodano leada")
				formRef.current?.reset()
				setStep(0)
				setOpen(false)
			}
			return res
		},
		null,
	)

	const next = () => {
		const invalid = stepRef.current?.querySelector<HTMLInputElement>(":invalid")
		if (invalid) {
			invalid.reportValidity()
			return
		}
		setStep(1)
	}

	const close = () => {
		setOpen(false)
		setStep(0)
	}

	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Dodaj leada</Button>
			<Modal
				open={open}
				onClose={close}
				title="Nowy lead"
				footer={
					<>
						{step === 0 ? (
							<Link className="text-[11.5px] text-accent hover:underline" href="/leady/import" onClick={close}>Importuj z CSV →</Link>
						) : <span />}
						<span className="flex gap-2">
							{step === 0 ? (
								<>
									<Button type="button" onClick={close}>Anuluj</Button>
									<Button variant="primary" type="button" onClick={next}>Dalej</Button>
								</>
							) : (
								<>
									<Button type="button" onClick={() => setStep(0)}>Wstecz</Button>
									<Button variant="primary" type="submit" form="lead-wizard-form" disabled={pending}>Dodaj leada</Button>
								</>
							)}
						</span>
					</>
				}
			>
				<div className="mb-3">
					<p className="text-[11px] text-fg-faint">Krok {step + 1} z 2 · {STEPS[step]}</p>
					<div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-surface-3">
						<motion.div
							className="h-full rounded-full bg-accent"
							initial={false}
							animate={{width: step === 0 ? "50%" : "100%"}}
							transition={reduce ? {duration: 0} : {type: "spring", visualDuration: 0.25, bounce: 0}}
						/>
					</div>
				</div>
				<form id="lead-wizard-form" ref={formRef} action={formAction}>
					<AnimatePresence initial={false} mode="popLayout">
						<motion.div
							key={step}
							ref={stepRef}
							initial={reduce ? false : {opacity: 0, x: step === 1 ? 12 : -12}}
							animate={{opacity: 1, x: 0}}
							transition={reduce ? {duration: 0} : {duration: 0.2, ease: EASE_OUT_QUART}}
						>
							<div className={step === 0 ? "flex flex-col gap-3" : "hidden"} hidden={step !== 0}>
								<Field label="Nazwa organizacji">
									<Input name="organizationName" placeholder="np. LO im. Kopernika, Warszawa" required />
								</Field>
								<div className="grid grid-cols-2 gap-3">
									<Field label="WWW"><Input name="website" placeholder="https://…" /></Field>
									<Field label="Miasto"><Input name="city" /></Field>
								</div>
								<Field label="Linia usługi">
									<Select name="offeringLineId" defaultValue="">
										<option value="">— brak —</option>
										{offeringLines.map((l) => (
											<option key={l.id} value={l.id}>{l.name}</option>
										))}
									</Select>
								</Field>
							</div>
							<div className={step === 1 ? "flex flex-col gap-3" : "hidden"} hidden={step !== 1}>
								<Field label="Osoba kontaktowa"><Input name="contactPersonName" /></Field>
								<div className="grid grid-cols-2 gap-3">
									<Field label="Stanowisko"><Input name="contactRole" placeholder="np. dyrektor" /></Field>
									<Field label="Forma grzecznościowa">
										<Select name="honorific" defaultValue="">
											<option value="">—</option>
											<option value="PANI">Pani</option>
											<option value="PAN">Pan</option>
										</Select>
									</Field>
								</div>
								<Field label="E-mail"><Input name="email" type="email" placeholder="adres@szkola.pl" /></Field>
								<div className="grid grid-cols-2 gap-3">
									<Field label="Telefon"><Input name="phone" /></Field>
									<Field label="Region"><Input name="region" /></Field>
								</div>
							</div>
						</motion.div>
					</AnimatePresence>
					{state && !state.ok ? <p className="mt-3 text-sm text-danger">{state.error}</p> : null}
				</form>
			</Modal>
		</>
	)
}
```
**CRITICAL form-contract subtlety:** both step containers must stay MOUNTED so hidden inputs submit. The plan code keeps BOTH divs inside the keyed motion.div — but `AnimatePresence` + `key={step}` would unmount the whole motion.div (and BOTH steps) on key change, breaking the rule. FIX during implementation: the keyed/animated element must wrap ONLY the visual slide, while both step divs stay mounted OUTSIDE the keyed element. Correct structure: drop `AnimatePresence`, keep ONE non-keyed wrapper `motion.div` that re-triggers its x/opacity animation on step change via `animate={{x: 0, opacity: 1}}` + `key`-less approach using `initial` impossible — SO use this simpler, contract-safe pattern: both step divs always mounted; the ACTIVE one is wrapped in its own `motion.div` keyed by step with `initial={{opacity: 0, x: dir}} animate={{opacity: 1, x: 0}}` and the INACTIVE one rendered with `hidden` directly (no exit animation — the spec's "morph + enter" pattern, outgoing hides instantly). I.e.:
```tsx
<form ...>
	<motion.div key={step} initial={reduce ? false : {opacity: 0, x: step === 1 ? 12 : -12}} animate={{opacity: 1, x: 0}} transition={...}>
		<div hidden={step !== 0} className={step === 0 ? "flex flex-col gap-3" : undefined}>…step 1 fields…</div>
		<div hidden={step !== 1} className={step === 1 ? "flex flex-col gap-3" : undefined}>…step 2 fields…</div>
	</motion.div>
	…error p…
</form>
```
Wait — `key={step}` on a wrapper CONTAINING both steps still remounts both divs (uncontrolled inputs LOSE VALUES on remount). THE BINDING RESOLUTION: no `key` anywhere inside the form. Animate the entering step by toggling CSS classes is not Motion… Use Motion's imperative `animate()` on the active step div when `step` changes (a `useEffect` running `animate(stepEl, {opacity: [0, 1], x: [dir, 0]}, {duration: 0.2, ease: EASE_OUT_QUART})` from `motion/react`'s `animate` import) — zero remounts, values preserved, effect performs no setState (lint-safe). Implement THIS pattern; the snippet above is layout/props reference only.

- [ ] **Step 3: `app/(app)/leady/page.tsx`** — read it; replace the current `h1` + `LeadForm` block with `PageHeader`:
  - `title="Leady"`, `description="Baza placówek z importem CSV, badaniami AI i przypisaniem do kampanii."`,
  - `meta`: `"{total} leadów · {inCampaigns} w kampaniach"` — `total` from a cheap `prisma.lead.count({where: {organizationId: orgId}})`, `inCampaigns` from `prisma.campaignLead.groupBy`? NO — keep it cheap: `prisma.lead.count` + `prisma.lead.count({where: {organizationId: orgId, campaignLeads: {some: {}}}})` (two counts, Promise.all with the existing queries).
  - `action`: `<span className="flex gap-2"><Link className="..." href="/leady/import">Importuj</Link><LeadCreateButton offeringLines={lines} /></span>` — reuse the page's already-fetched offering lines (it has a `line` filter Select; if the page doesn't already fetch `{id, name}` lines, add the same cheap query used by the filter).
  - The filter/sort toolbar moves to directly under the header (unchanged controls/names).
  - The `EmptyState` (empty list) gets `action={<LeadCreateButton offeringLines={lines} variant="secondary" />}`.
  - DELETE the `LeadForm` import/usage; then delete `app/(app)/leady/lead-form.tsx` after `grep -rn "lead-form" app features` shows no other consumer.

- [ ] **Step 4: Gates + commit** — tsc 0; eslint `"app/(app)/leady/**" features/leads/actions.ts components/ui/modal.tsx`; vitest 258 green; manual grep: `grep -n "name=" app/(app)/leady/lead-create-button.tsx` covers organizationName/website/city/offeringLineId/contactPersonName/contactRole/honorific/email/phone/region.
```bash
git add "app/(app)/leady" features/leads/actions.ts
git commit -m "feat(creation-ux): 2-step lead wizard in Modal + leady PageHeader (+honorific/phone/region on createLead)"
```

---

### Task 3: Simple creation modals — kampanie / linie / placeholdery / suppression

For EACH page: read the page + its form component first. Pattern per page:
1. Create `<area>-create-button.tsx` (client): `const [open, setOpen] = useState(false)` + `<Button variant="primary" onClick>+ <label></Button>` + `<Modal open onClose title>` wrapping the EXISTING form component; pass `onSuccess={() => {setOpen(false)}}` and let the form fire its own toast.
2. Modify the existing form component: accept optional `onSuccess?: () => void`; wrap its `useActionState` action exactly like the lead wizard does (side-effects in the wrapper: `if (res.ok) {toast("…"); formRef.current?.reset(); onSuccess?.()}` — import `useToast`; add a `formRef`). Field `name`s and the server action UNTOUCHED. Remove any inline success `<p>` (the toast replaces it); keep the inline error `<p>`.
3. Modify the page: add `PageHeader` (title/description/meta/action per the table below), REMOVE the inline form render, wire the EmptyState `action` to the same create button (variant="secondary").

| Page | title | description | meta (from already-fetched data) | Modal title / button |
|---|---|---|---|---|
| `kampanie/page.tsx` | Kampanie | Sekwencje wysyłkowe powiązane z liniami usług. | `{n} kampanii · {active} aktywnych` | "Nowa kampania" / `+ Nowa kampania` |
| `linie/page.tsx` | Linie usług | Oferty, do których przypisujesz leady i kampanie. | `{n} linii` | "Nowa linia" / `+ Nowa linia` |
| `placeholdery/page.tsx` | Placeholdery | Własne pola podstawiane w szablonach. | `{n} placeholderów` | "Nowy placeholder" / `+ Nowy placeholder` |
| `suppression/page.tsx` | Wykluczenia | Adresy, do których nigdy nie wysyłamy. | `{n} wykluczeń` | "Dodaj wykluczenie" / `+ Dodaj wykluczenie` |

Files: create `kampania-create-button.tsx` (in `app/(app)/kampanie/`), `linia-create-button.tsx`, `placeholder-create-button.tsx`, `suppression-create-button.tsx`; modify the 4 forms + 4 pages. The campaign create button needs `offeringLines` props (page already fetches them for the old inline form — keep that fetch).

- [ ] Gates + commit:
```bash
git add "app/(app)/kampanie" "app/(app)/linie" "app/(app)/placeholdery" "app/(app)/suppression"
git commit -m "feat(creation-ux): create modals + PageHeaders for kampanie/linie/placeholdery/suppression"
```

---

### Task 4: Headers for szablony / badania / pipeline + hover polish + remaining CTAs

- [ ] **`szablony/page.tsx`**: `PageHeader` title "Szablony", description "Treści maili z placeholderami i podglądem.", meta `{n} szablonów`; NO modal — the editor stays on the page below the list (action slot empty or a ghost anchor `<a href="#edytor">Nowy szablon</a>` ONLY if the editor section has/gets an `id="edytor"` — add the id). Inline editor stays.
- [ ] **`badania/page.tsx`**: `PageHeader` title "Badania AI", description "Typy badań, ocen i treści generowanych przez AI.", meta `{n} typów · {batches} ostatnich badań zbiorczych`; action `<Button>` as a `Link`-styled anchor to `/badania/nowy` — reuse the existing "Nowy typ" link styling (`<Link className="...primary-button classes...">`? NO — use the existing pattern on the page; if it renders a plain Link, keep a plain `Link` styled as today inside the action slot).
- [ ] **`pipeline/page.tsx`**: `PageHeader` title "Pipeline" (KEPT untranslated), description "Etapy dealowe przeciągane na tablicy.", meta `{n} leadów na tablicy`; no action; the existing filter form moves under the header.
- [ ] **Hover polish:** on the Card-row lists (kampanie/szablony/placeholdery/linie/suppression/badania) add `transition-colors hover:border-border-strong` to the row `Card` className (single class addition per file; rows already have Card).
- [ ] Gates + commit:
```bash
git add "app/(app)/szablony" "app/(app)/badania" "app/(app)/pipeline" "app/(app)/kampanie" "app/(app)/linie" "app/(app)/placeholdery" "app/(app)/suppression"
git commit -m "feat(creation-ux): PageHeaders for szablony/badania/pipeline + row hover polish"
```

---

### Task 5: Final — gates, contract audit, docs (controller)

- [ ] Full `tsc` / `vitest` / `eslint "app/(app)/**" "components/ui/**" features`; `next build` only if dev OFF.
- [ ] Form-contract audit: `git diff <base> -- "app/(app)" features/leads/actions.ts | grep -E "^[+-].*name="` — the only NET-NEW names are the wizard's `honorific`/`phone`/`region`; nothing renamed/dropped.
- [ ] ROADMAP entry + `graphify update .` + docs commit.

---

## Self-review notes

- Spec coverage: primitives = T1; wizard + additive createLead + leady header = T2; four simple modals = T3; remaining headers + hover + CTAs = T4; testing/audit = T5. Animation spec encoded in T1/T2 constants; reduced-motion paths everywhere.
- **Known hard spot (called out IN T2):** the naive `AnimatePresence key={step}` pattern would remount the form and lose uncontrolled values — T2 explicitly mandates the imperative `animate()` slide on mounted divs instead. The reviewer must verify both steps stay mounted and values survive a 1→2→1 roundtrip (read the code path).
- Type consistency: `LeadCreateButton` consumes `createLead` unchanged signature `(prev, formData)`; forms gain only an optional `onSuccess`; `Modal` props used identically across T2/T3.
