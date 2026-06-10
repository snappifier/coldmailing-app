# Templates editor + campaign page polish (round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/szablony` as a master-detail editor with template EDITING (`updateTemplate`), rebuild `/kampanie/[id]` with tabs plus sequence-step EDIT and REORDER (`updateSequenceStep`, `moveSequenceStep` gated to non-ACTIVE), and land five review micro-fixes.

**Architecture:** Three new org-scoped server actions mirror the existing create/delete idiom (Zod safeParse on `Object.fromEntries(formData)`, `requireOrg`, scoped writes, `revalidatePath`). Reorder goes through a pure `planSwap` helper (TDD) and a 3-step `$transaction` because `SequenceStep` has `@@unique([campaignId, order])`. UI rebuilds are client shells composed by thin server pages: `templates-shell.tsx` (rail | form | sticky preview) and `campaign-tabs.tsx` + per-tab components. Spec: `docs/superpowers/specs/2026-06-10-templates-campaign-polish-design.md`.

**Tech Stack:** Next 16 App Router, React 19 (`useActionState`, `useTransition`), Tailwind v4 tokens, Zod 4, Prisma 7, Vitest 4, Motion (`AnimatePresence`) — all already installed. No migration, no new deps.

**Conventions (binding):** tabs, no semicolons, path comment line 1 (line 2 after a directive), `className` first attribute, `import {x}` no inner spaces, NO emoji (the ▲▼● glyphs used below are geometric shapes, not emoji — keep them exactly). The user pushes; you commit per task. NEVER `git push`. Dev server may be running — do NOT run `next build` except in Task 7 (coordinate there).

## File map

- Task 1 (micro-fixes): `app/(app)/pipeline/board.tsx`, `components/ui/table.tsx`, `app/globals.css`, `app/(app)/skrzynki/mailbox-settings-form.tsx`
- Task 2: Create `features/campaigns/reorder.ts` + `features/campaigns/reorder.test.ts`
- Task 3: Modify `features/campaigns/schema.ts`, `features/campaigns/actions.ts`, `lib/inngest/sending.ts` (ONE comment line)
- Task 4: Modify `features/templates/schema.ts`, `features/templates/actions.ts`
- Task 5: Create `app/(app)/szablony/templates-shell.tsx`; rewrite `app/(app)/szablony/page.tsx`; DELETE `app/(app)/szablony/template-editor.tsx`
- Task 6: Create `app/(app)/kampanie/[id]/campaign-tabs.tsx`, `campaign-header-actions.tsx`, `sequence-steps.tsx`, `assign-leads-form.tsx`; rewrite `app/(app)/kampanie/[id]/page.tsx` and `sending-controls.tsx`; DELETE `app/(app)/kampanie/[id]/sequence-and-leads.tsx`
- Task 7: gates + `docs/superpowers/ROADMAP.md`

Dependency: Task 5 needs Task 4; Task 6 needs Tasks 2+3. Tasks 1/2 are independent. Run in numeric order.

---

### Task 1: Review micro-fixes (4 files)

**Files:**
- Modify: `app/(app)/pipeline/board.tsx:52`, `components/ui/table.tsx:4`, `app/globals.css:8`, `app/(app)/skrzynki/mailbox-settings-form.tsx:59`

- [ ] **Step 1: pipeline drag-over strengthener**

In `app/(app)/pipeline/board.tsx`, in the column className template string, change ONLY the over-branch:
Old fragment: `${over ? "bg-surface-3" : "bg-surface-2"}`
New fragment: `${over ? "bg-surface-3 ring-1 ring-border-strong" : "bg-surface-2"}`

- [ ] **Step 2: Table row hover (all consumers)**

`components/ui/table.tsx` — the `Table` component line becomes:

```tsx
	return <table className={cn("w-full border-collapse text-[13px] [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-surface-2/50", className)}>{children}</table>
```

(Descendant arbitrary variants because rows are raw `<tr>` in consumers; affects /leady, batch-view, team table, import mapping — hover on a config table is harmless.)

- [ ] **Step 3: light focus border bump**

`app/globals.css` `:root` border line:
Old: `	--border: rgba(9,9,11,.09); --border-strong: rgba(9,9,11,.16); --border-focus: rgba(9,9,11,.45);`
New: `	--border: rgba(9,9,11,.09); --border-strong: rgba(9,9,11,.16); --border-focus: rgba(9,9,11,.55);`
(Dark theme line stays `.55` as is.)

- [ ] **Step 4: day-chip keyboard focus**

`app/(app)/skrzynki/mailbox-settings-form.tsx` chip span — add the two `peer-focus-visible:` utilities at the END of the className:
Old: `<span className="grid h-8 w-9 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-fg-faint peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent">{label}</span>`
New: `<span className="grid h-8 w-9 place-items-center rounded-md border border-border bg-surface-2 text-xs font-semibold text-fg-faint peer-checked:border-accent peer-checked:bg-accent-quiet peer-checked:text-accent peer-focus-visible:[outline:2px_solid_var(--ring)] peer-focus-visible:outline-offset-2">{label}</span>`

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add "app/(app)/pipeline/board.tsx" components/ui/table.tsx app/globals.css "app/(app)/skrzynki/mailbox-settings-form.tsx"
git commit -m "fix(design): review micro-fixes - drag-over ring, table row hover, light focus bump, day-chip keyboard focus

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure `planSwap` helper (TDD)

**Files:**
- Create: `features/campaigns/reorder.ts`
- Test: `features/campaigns/reorder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/campaigns/reorder.test.ts
import {describe, expect, it} from "vitest"
import {planSwap} from "@/features/campaigns/reorder"

const steps = [
	{id: "a", order: 0},
	{id: "b", order: 1},
	{id: "c", order: 2},
]

describe("planSwap", () => {
	it("swaps a middle step up", () => {
		expect(planSwap(steps, "b", "up")).toEqual({a: {id: "b", order: 0}, b: {id: "a", order: 1}})
	})
	it("swaps a middle step down", () => {
		expect(planSwap(steps, "b", "down")).toEqual({a: {id: "b", order: 2}, b: {id: "c", order: 1}})
	})
	it("returns null moving the first step up", () => {
		expect(planSwap(steps, "a", "up")).toBeNull()
	})
	it("returns null moving the last step down", () => {
		expect(planSwap(steps, "c", "down")).toBeNull()
	})
	it("returns null for an unknown id", () => {
		expect(planSwap(steps, "x", "up")).toBeNull()
	})
	it("works on unsorted input and gappy orders", () => {
		const gappy = [
			{id: "q", order: 7},
			{id: "p", order: 2},
		]
		expect(planSwap(gappy, "q", "up")).toEqual({a: {id: "q", order: 2}, b: {id: "p", order: 7}})
	})
})
```

- [ ] **Step 2: Run it — must fail**

Run: `npx vitest run features/campaigns/reorder.test.ts`
Expected: FAIL (cannot resolve `@/features/campaigns/reorder`).

- [ ] **Step 3: Implement**

```ts
// features/campaigns/reorder.ts
export interface OrderedStep {
	id: string
	order: number
}
export interface SwapPlan {
	a: OrderedStep
	b: OrderedStep
}

// Plans an up/down swap for stepId. Input may be unsorted and orders may have gaps
// (delete leaves gaps; the engine cursor is gap-safe). Returns the two rows with
// EXCHANGED order values, or null when the move hits a boundary or the id is unknown.
export function planSwap(steps: OrderedStep[], stepId: string, dir: "up" | "down"): SwapPlan | null {
	const sorted = [...steps].sort((x, y) => x.order - y.order)
	const i = sorted.findIndex((s) => s.id === stepId)
	if (i === -1) return null
	const j = dir === "up" ? i - 1 : i + 1
	if (j < 0 || j >= sorted.length) return null
	const cur = sorted[i]
	const other = sorted[j]
	return {a: {id: cur.id, order: other.order}, b: {id: other.id, order: cur.order}}
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npx vitest run features/campaigns/reorder.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add features/campaigns/reorder.ts features/campaigns/reorder.test.ts
git commit -m "feat(campaigns): pure planSwap reorder helper with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Sequence actions — `updateSequenceStep` + `moveSequenceStep`

**Files:**
- Modify: `features/campaigns/schema.ts` (append), `features/campaigns/actions.ts` (append), `lib/inngest/sending.ts:39` (comment ONLY)

- [ ] **Step 1: schema**

Append to `features/campaigns/schema.ts` (after `sequenceStepSchema`):

```ts
export const updateSequenceStepSchema = sequenceStepSchema.extend({
	stepId: z.string().trim().min(1),
})
```

- [ ] **Step 2: actions**

Append to `features/campaigns/actions.ts`. Extend the schema import on line 7 to `import {campaignSchema, sequenceStepSchema, updateSequenceStepSchema} from "@/features/campaigns/schema"` and add `import {planSwap} from "@/features/campaigns/reorder"` below it. Then:

```ts
export async function updateSequenceStep(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const parsed = updateSequenceStepSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	await assertCampaignInOrg(parsed.data.campaignId, orgId)

	await prisma.sequenceStep.updateMany({
		where: {id: parsed.data.stepId, campaignId: parsed.data.campaignId},
		data: {
			templateId: parsed.data.templateId,
			delayDays: parsed.data.delayDays,
			condition: parsed.data.condition,
			useLeadDraft: parsed.data.useLeadDraft,
		},
	})
	revalidatePath(`/kampanie/${parsed.data.campaignId}`)
	return {ok: true}
}

// Reorder is gated to non-ACTIVE campaigns: the sending engine's cursor is gap-safe
// (steps.find(s => s.order >= currentStep)), so moving a step across a lead's cursor
// on an ACTIVE campaign could re-send or skip it. Field edits carry no such risk.
export async function moveSequenceStep(stepId: string, dir: "up" | "down", campaignId: string): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const campaign = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {status: true}})
	if (!campaign) return {ok: false, error: "Nie znaleziono kampanii"}
	if (campaign.status === "ACTIVE") return {ok: false, error: "Wstrzymaj kampanię, aby zmienić kolejność"}

	const steps = await prisma.sequenceStep.findMany({where: {campaignId}, select: {id: true, order: true}})
	const plan = planSwap(steps, stepId, dir)
	if (!plan) return {ok: false, error: "Nie można przesunąć kroku"}

	// @@unique([campaignId, order]) forbids a direct two-row swap - park one row on -1 first.
	await prisma.$transaction([
		prisma.sequenceStep.update({where: {id: plan.a.id}, data: {order: -1}}),
		prisma.sequenceStep.update({where: {id: plan.b.id}, data: {order: plan.b.order}}),
		prisma.sequenceStep.update({where: {id: plan.a.id}, data: {order: plan.a.order}}),
	])
	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}
```

- [ ] **Step 3: stale engine comment**

`lib/inngest/sending.ts` line 39:
Old: `	// Steps + placeholders loaded once; mid-flight sequence edits are not picked up (accepted, see spec).`
New: `	// Top-level reads re-execute on every Inngest replay, so step edits ARE picked up at each wake-up; the cursor find below is gap-safe. Reordering is gated to non-ACTIVE campaigns at the action layer (round-2 polish spec).`
NOTHING else in this file changes — `git diff lib/inngest/sending.ts` must show exactly that one line.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit` (exit 0) and `npx vitest run features/campaigns` (reorder 6 + activation suite pass; `lib/inngest/sending.test.ts` untouched by this diff but run `npx vitest run lib/inngest/sending.test.ts` too — must stay green since only a comment changed).

```bash
git add features/campaigns/schema.ts features/campaigns/actions.ts lib/inngest/sending.ts
git commit -m "feat(campaigns): updateSequenceStep and moveSequenceStep actions - reorder gated to non-ACTIVE

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `updateTemplate` action

**Files:**
- Modify: `features/templates/schema.ts` (append), `features/templates/actions.ts` (append)

- [ ] **Step 1: schema**

Append to `features/templates/schema.ts`:

```ts
export const templateUpdateSchema = templateSchema.extend({
	templateId: z.string().trim().min(1),
})
```

- [ ] **Step 2: action**

In `features/templates/actions.ts`, change the schema import line to `import {templateSchema, templateUpdateSchema} from "@/features/templates/schema"` (`templateSchema` stays — `createTemplate` uses it). Append:

```ts
export async function updateTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
	const {orgId} = await requireOrg()
	const parsed = templateUpdateSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		// Explicit field list: visibility/folder are not in the form and must keep their stored values.
		const res = await prisma.template.updateMany({
			where: {id: parsed.data.templateId, organizationId: orgId},
			data: {
				name: parsed.data.name,
				subject: parsed.data.subject,
				body: parsed.data.body,
				isFollowup: parsed.data.isFollowup,
				offeringLineId: parsed.data.offeringLineId,
			},
		})
		if (res.count === 0) return {ok: false, error: "Nie znaleziono szablonu"}
		revalidatePath("/szablony")
		return {ok: true, id: parsed.data.templateId}
	} catch {
		return {ok: false, error: "Nie udało się zapisać zmian"}
	}
}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — exit 0.

```bash
git add features/templates/schema.ts features/templates/actions.ts
git commit -m "feat(templates): updateTemplate action - org-scoped edit of existing templates

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Templates master-detail shell

**Files:**
- Create: `app/(app)/szablony/templates-shell.tsx`
- Rewrite: `app/(app)/szablony/page.tsx`
- Delete: `app/(app)/szablony/template-editor.tsx`

- [ ] **Step 1: create `templates-shell.tsx`** (complete file):

```tsx
"use client"
// app/(app)/szablony/templates-shell.tsx

import {useActionState, useRef, useState} from "react"
import {createTemplate, updateTemplate, deleteTemplate, type TemplateResult} from "@/features/templates/actions"
import {renderTemplate, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"
import {cn} from "@/lib/cn"
import {PageHeader} from "@/components/ui/page-header"
import {Card, CardBody} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Select} from "@/components/ui/select"
import {Switch} from "@/components/ui/switch"
import {Button} from "@/components/ui/button"
import {Note} from "@/components/ui/note"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {useConfirm} from "@/components/ui/use-confirm"
import {useToast} from "@/components/ui/use-toast"

const BUILTIN = ["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"]

export interface TemplateRow {
	id: string
	name: string
	subject: string
	body: string
	isFollowup: boolean
	offeringLineId: string | null
	offeringLineName: string | null
	inUse: boolean
}

interface Draft {
	name: string
	subject: string
	body: string
	isFollowup: boolean
	offeringLineId: string
}

interface Props {
	templates: TemplateRow[]
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
	signatureSet: boolean
	previewMailboxName: string | null
}

const EMPTY: Draft = {name: "", subject: "", body: "", isFollowup: false, offeringLineId: ""}

function toDraft(t: TemplateRow): Draft {
	return {name: t.name, subject: t.subject, body: t.body, isFollowup: t.isFollowup, offeringLineId: t.offeringLineId ?? ""}
}

function FieldLabel({children}: {children: React.ReactNode}) {
	return <span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{children}</span>
}

export function TemplatesShell({templates, offeringLines, customPlaceholders, customKeys, sampleLead, senderName, signatureSet, previewMailboxName}: Props) {
	const ask = useConfirm()
	const toast = useToast()
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [draft, setDraft] = useState<Draft>(EMPTY)
	const [snapshot, setSnapshot] = useState<Draft>(EMPTY)
	const subjectRef = useRef<HTMLTextAreaElement>(null)
	const bodyRef = useRef<HTMLTextAreaElement>(null)
	const activeRef = useRef<"subject" | "body">("body")

	// A deleted template leaves selectedId dangling after revalidation - fall back to new mode at render time.
	const selected = selectedId ? (templates.find((t) => t.id === selectedId) ?? null) : null
	const effectiveId = selected ? selectedId : null
	const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot)

	const [createState, createAction, createPending] = useActionState<TemplateResult | null, FormData>(
		async (prev, formData) => {
			const res = await createTemplate(prev, formData)
			if (res?.ok) {
				toast("Zapisano szablon")
				setSelectedId(res.id)
				setSnapshot({...draft})
			}
			return res
		},
		null,
	)
	const [updateState, updateAction, updatePending] = useActionState<TemplateResult | null, FormData>(
		async (prev, formData) => {
			const res = await updateTemplate(prev, formData)
			if (res?.ok) {
				toast("Zapisano zmiany")
				setSnapshot({...draft})
			}
			return res
		},
		null,
	)

	async function switchTo(id: string | null) {
		if (id === effectiveId) return
		if (dirty && !(await ask({title: "Porzucić niezapisane zmiany?", confirmLabel: "Porzuć", cancelLabel: "Wróć", danger: false}))) return
		const next = id ? (templates.find((t) => t.id === id) ?? null) : null
		const d = next ? toDraft(next) : EMPTY
		setSelectedId(next ? id : null)
		setDraft(d)
		setSnapshot(d)
	}

	function insert(token: string) {
		const isSubject = activeRef.current === "subject"
		const el = isSubject ? subjectRef.current : bodyRef.current
		const current = isSubject ? draft.subject : draft.body
		const start = el?.selectionStart ?? current.length
		const end = el?.selectionEnd ?? current.length
		const next = current.slice(0, start) + token + current.slice(end)
		setDraft(isSubject ? {...draft, subject: next} : {...draft, body: next})
		setTimeout(() => {
			if (el) {
				el.focus()
				const pos = start + token.length
				el.setSelectionRange(pos, pos)
			}
		}, 0)
	}

	const preview = sampleLead
		? {
				subject: renderTemplate(draft.subject, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
				body: renderTemplate(draft.body, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
			}
		: null
	const missing = preview ? Array.from(new Set([...preview.subject.missing, ...preview.body.missing])) : []

	const pending = createPending || updatePending
	const state = effectiveId ? updateState : createState

	return (
		<section className="flex flex-col gap-6">
			<PageHeader
				title="Szablony"
				description="Treści maili z placeholderami i podglądem."
				meta={`${templates.length} szablonów`}
				action={<Button variant="secondary" type="button" onClick={() => switchTo(null)}>+ Nowy szablon</Button>}
			/>
			<div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1.1fr)_minmax(0,1fr)]">
				<nav className="flex gap-1 max-lg:flex-row max-lg:flex-wrap lg:flex-col">
					{templates.map((t) => {
						const active = t.id === effectiveId
						const meta = [t.offeringLineName, t.inUse ? "w sekwencji" : null].filter(Boolean).join(" · ")
						return (
							<button
								className={cn(
									"relative rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors",
									active ? "bg-surface-2 text-fg before:absolute before:-left-px before:top-1/2 before:h-[15px] before:w-[2.5px] before:-translate-y-1/2 before:rounded before:bg-accent" : "text-fg-muted hover:bg-surface-1 hover:text-fg",
								)}
								key={t.id}
								type="button"
								aria-current={active ? "true" : undefined}
								onClick={() => switchTo(t.id)}
							>
								<span className="flex items-center justify-between gap-2">
									<span className="truncate">{t.name}</span>
									{active && dirty ? <span className="size-[5px] flex-none rounded-full bg-warning" aria-label="Niezapisane zmiany" /> : null}
								</span>
								{meta ? <span className="block truncate text-[10px] text-fg-faint">{meta}</span> : null}
							</button>
						)
					})}
					{templates.length === 0 ? <p className="px-2.5 py-1.5 text-[12.5px] text-fg-muted">Brak szablonów — utwórz pierwszy obok.</p> : null}
				</nav>

				<form className="flex flex-col gap-4" action={effectiveId ? updateAction : createAction}>
					{effectiveId ? <input name="templateId" type="hidden" value={effectiveId} /> : null}
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Nazwa</FieldLabel>
						<Input name="name" value={draft.name} placeholder="Nazwa szablonu" required onChange={(e) => setDraft({...draft, name: e.target.value})} />
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Placeholdery — klik wstawia w aktywne pole</FieldLabel>
						<div className="flex flex-wrap gap-1">
							{[...BUILTIN, ...customKeys].map((k) => (
								<Button className="font-mono" key={k} variant="ghost" size="sm" type="button" onClick={() => insert(`{{${k}}}`)}>
									{`{{${k}}}`}
								</Button>
							))}
							<Button className="font-mono" variant="ghost" size="sm" type="button" onClick={() => insert("{{Szanowny|Szanowna}}")}>
								{"{{Szanowny|Szanowna}}"}
							</Button>
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Temat</FieldLabel>
						<Textarea
							className="min-h-0 h-16"
							name="subject"
							placeholder="Temat"
							value={draft.subject}
							ref={subjectRef}
							required
							onFocus={() => (activeRef.current = "subject")}
							onChange={(e) => setDraft({...draft, subject: e.target.value})}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<FieldLabel>Treść</FieldLabel>
						<Textarea
							className="h-48"
							name="body"
							placeholder="Treść wiadomości"
							value={draft.body}
							ref={bodyRef}
							required
							onFocus={() => (activeRef.current = "body")}
							onChange={(e) => setDraft({...draft, body: e.target.value})}
						/>
					</div>
					<div className="flex flex-wrap items-center gap-5">
						<span className="flex items-center gap-2 text-sm text-fg">
							<Switch checked={draft.isFollowup} aria-label="Wiadomość follow-up" onChange={(v) => setDraft({...draft, isFollowup: v})} />
							Wiadomość follow-up
						</span>
						<input name="isFollowup" type="hidden" value={draft.isFollowup ? "on" : ""} />
						<Select className="w-56" name="offeringLineId" value={draft.offeringLineId} onChange={(e) => setDraft({...draft, offeringLineId: e.target.value})}>
							<option value="">— linia usługi —</option>
							{offeringLines.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</Select>
					</div>
					<div className="flex items-center justify-between gap-3 border-t border-border pt-4">
						<Button className="w-44 justify-center" variant="primary" type="submit" disabled={pending}>
							{effectiveId ? "Zapisz zmiany" : "Zapisz szablon"}
						</Button>
						{effectiveId ? (
							selected?.inUse ? (
								<span className="text-xs text-fg-faint">w sekwencji — nie można usunąć</span>
							) : (
								<ConfirmButton action={deleteTemplate.bind(null, effectiveId)} confirm={{title: "Usunąć szablon?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto szablon">
									Usuń
								</ConfirmButton>
							)
						) : null}
					</div>
					{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
				</form>

				<div className="self-start lg:col-start-2 xl:col-start-auto xl:sticky xl:top-6">
					<Card>
						<CardBody className="flex flex-col gap-3">
							<FieldLabel>Podgląd {sampleLead ? `· ${sampleLead.organizationName}` : "· brak leadów"}</FieldLabel>
							{!signatureSet ? (
								<Note variant="warning">
									Podpis nadawcy nieustawiony w Ustawieniach — podgląd i wysyłka użyją nazwy skrzynki ({previewMailboxName ?? "—"}). Ustaw podpis, aby był spójny.
								</Note>
							) : null}
							<p className="text-sm font-medium">{preview?.subject.rendered || "—"}</p>
							<hr className="border-border" />
							<p className="whitespace-pre-wrap text-sm">{preview?.body.rendered || "—"}</p>
							{missing.length > 0 ? (
								<p className="text-xs text-warning">Nierozwiązane / braki: {missing.join(", ")}</p>
							) : (
								<p className="text-xs text-success">Wszystkie tokeny rozwiązane dla tego leada.</p>
							)}
						</CardBody>
					</Card>
				</div>
			</div>
		</section>
	)
}
```

- [ ] **Step 2: rewrite `app/(app)/szablony/page.tsx`** (complete file — same queries, thin render):

```tsx
// app/(app)/szablony/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {resolveSenderName} from "@/features/templates/sender"
import {TemplatesShell} from "./templates-shell"
import type {RenderLead} from "@/features/templates/render"

export default async function TemplatesPage() {
	const {orgId} = await requireOrg()

	const [templates, offeringLines, placeholders, lead, org, mailbox] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}, include: {offeringLine: {select: {name: true}}, _count: {select: {sequenceSteps: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}}),
		prisma.lead.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}, take: 1}),
		prisma.organization.findUnique({where: {id: orgId}, select: {senderSignature: true}}),
		prisma.emailAccount.findFirst({where: {organizationId: orgId, status: "CONNECTED"}, orderBy: {createdAt: "asc"}, select: {displayName: true}}),
	])

	const senderSignature = org?.senderSignature ?? ""
	const previewMailboxName = mailbox?.displayName ?? null
	const senderName = resolveSenderName({signature: senderSignature, fallback: previewMailboxName})

	const sampleLead: RenderLead | null = lead[0]
		? {
				organizationName: lead[0].organizationName,
				contactPersonName: lead[0].contactPersonName,
				city: lead[0].city,
				website: lead[0].website,
				aiHook: lead[0].aiHook,
				honorific: lead[0].honorific,
				customFields: (lead[0].customFields as Record<string, unknown> | null) ?? null,
			}
		: null

	return (
		<TemplatesShell
			templates={templates.map((t) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				body: t.body,
				isFollowup: t.isFollowup,
				offeringLineId: t.offeringLineId,
				offeringLineName: t.offeringLine?.name ?? null,
				inUse: t._count.sequenceSteps > 0,
			}))}
			offeringLines={offeringLines}
			customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
			customKeys={placeholders.map((p) => p.key)}
			sampleLead={sampleLead}
			senderName={senderName}
			signatureSet={senderSignature.trim() !== ""}
			previewMailboxName={previewMailboxName}
		/>
	)
}
```

- [ ] **Step 3: delete the old editor**

```bash
git rm "app/(app)/szablony/template-editor.tsx"
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` (exit 0) and `npx eslint "app/(app)/szablony"` (clean). Grep check: `rg -n "template-editor" app` → zero matches.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/szablony"
git commit -m "feat(templates): master-detail editor shell - rail, edit existing, dirty guard, sticky preview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Campaign page — header actions, metrics strip, tabs, step edit/reorder

**Files:**
- Create: `app/(app)/kampanie/[id]/campaign-tabs.tsx`, `app/(app)/kampanie/[id]/campaign-header-actions.tsx`, `app/(app)/kampanie/[id]/sequence-steps.tsx`, `app/(app)/kampanie/[id]/assign-leads-form.tsx`
- Rewrite: `app/(app)/kampanie/[id]/page.tsx`, `app/(app)/kampanie/[id]/sending-controls.tsx`
- Delete: `app/(app)/kampanie/[id]/sequence-and-leads.tsx`

- [ ] **Step 1: create `campaign-tabs.tsx`**:

```tsx
"use client"
// app/(app)/kampanie/[id]/campaign-tabs.tsx

import {useState} from "react"
import {AnimatePresence, motion, useReducedMotion} from "motion/react"
import {cn} from "@/lib/cn"

const TABS = [
	{id: "sekwencja", label: "Sekwencja"},
	{id: "leady", label: "Leady i wysyłka"},
	{id: "przychodzace", label: "Przychodzące"},
] as const
type TabId = (typeof TABS)[number]["id"]

export function CampaignTabs({sekwencja, leady, przychodzace, inboundCount}: {sekwencja: React.ReactNode; leady: React.ReactNode; przychodzace: React.ReactNode; inboundCount: number}) {
	const [active, setActive] = useState<TabId>("sekwencja")
	const reduce = useReducedMotion()
	const content: Record<TabId, React.ReactNode> = {sekwencja, leady, przychodzace}

	return (
		<div>
			<div className="flex gap-1 border-b border-border" role="tablist">
				{TABS.map((t) => (
					<button
						className={cn(
							"-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
							t.id === active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg",
						)}
						key={t.id}
						type="button"
						role="tab"
						aria-selected={t.id === active}
						onClick={() => setActive(t.id)}
					>
						{t.label}
						{t.id === "przychodzace" && inboundCount > 0 ? <span className="ml-1.5 text-[11px] text-fg-faint">{inboundCount}</span> : null}
					</button>
				))}
			</div>
			<div className="pt-4">
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={reduce ? false : {opacity: 0, y: 8}}
						animate={{opacity: 1, y: 0}}
						exit={reduce ? {opacity: 0} : {opacity: 0, y: -4}}
						transition={{duration: 0.24, ease: [0.165, 0.84, 0.44, 1]}}
					>
						{content[active]}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}
```

- [ ] **Step 2: create `campaign-header-actions.tsx`**:

```tsx
"use client"
// app/(app)/kampanie/[id]/campaign-header-actions.tsx

import {useActionState} from "react"
import {activateCampaign, pauseCampaign} from "@/features/campaigns/sending-actions"
import type {ActivateResult} from "@/features/campaigns/activation"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Button} from "@/components/ui/button"

interface Props {
	campaignId: string
	status: string
	canManageSending: boolean
	hasMailbox: boolean
}

export function CampaignHeaderActions({campaignId, status, canManageSending, hasMailbox}: Props) {
	const [state, action, pending] = useActionState<ActivateResult | null, FormData>(() => activateCampaign(campaignId), null)

	return (
		<div className="flex flex-none items-center gap-3">
			{state && !state.ok ? <span className="text-[12.5px] text-danger">{state.error}</span> : null}
			{status === "ACTIVE" ? (
				<ConfirmButton
					action={pauseCampaign.bind(null, campaignId)}
					confirm={{title: "Wstrzymać kampanię?", body: "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później.", confirmLabel: "Wstrzymaj", danger: false}}
					variant="secondary"
					size="md"
					toast="Wstrzymano kampanię"
				>
					Pauza
				</ConfirmButton>
			) : canManageSending ? (
				<form className="flex items-center gap-2.5" action={action}>
					{!hasMailbox ? <span className="text-[11.5px] text-fg-faint">ustaw skrzynkę, aby aktywować</span> : null}
					<Button variant="primary" type="submit" disabled={pending || !hasMailbox}>Aktywuj wysyłkę</Button>
				</form>
			) : null}
		</div>
	)
}
```

(Behavior note: Pauza was previously offered in every status; it only has an effect on an ACTIVE campaign, so showing it only for ACTIVE is a UI tightening, not an action change. Activate keeps its ADMIN gate via `canManageSending`.)

- [ ] **Step 3: create `sequence-steps.tsx`**:

```tsx
"use client"
// app/(app)/kampanie/[id]/sequence-steps.tsx

import {useActionState, useState, useTransition} from "react"
import {addSequenceStep, updateSequenceStep, moveSequenceStep, deleteSequenceStep, type StepResult} from "@/features/campaigns/actions"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {Card} from "@/components/ui/card"
import {Select} from "@/components/ui/select"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {Badge} from "@/components/ui/badge"
import {useToast} from "@/components/ui/use-toast"
import {CONDITION_LABEL} from "@/features/enums/labels"
import type {SequenceCondition} from "@/generated/prisma/client"

export interface StepRow {
	id: string
	order: number
	delayDays: number
	condition: string
	templateId: string
	templateName: string
	useLeadDraft: boolean
}

interface Props {
	campaignId: string
	templates: {id: string; name: string}[]
	steps: StepRow[]
	campaignActive: boolean
}

function StepFields({templates, defaults}: {templates: {id: string; name: string}[]; defaults?: StepRow}) {
	return (
		<>
			<Select className="w-56" name="templateId" defaultValue={defaults?.templateId ?? ""}>
				<option value="">— szablon —</option>
				{templates.map((t) => (
					<option key={t.id} value={t.id}>
						{t.name}
					</option>
				))}
			</Select>
			<Input className="w-24" name="delayDays" type="number" min={0} defaultValue={defaults?.delayDays ?? 0} aria-label="Dni opóźnienia" />
			<Select className="w-52" name="condition" defaultValue={defaults?.condition ?? "SEND_IF_NO_REPLY"}>
				<option value="ALWAYS">{CONDITION_LABEL["ALWAYS"]}</option>
				<option value="SEND_IF_NO_REPLY">{CONDITION_LABEL["SEND_IF_NO_REPLY"]}</option>
			</Select>
			<label className="flex items-center gap-1.5 text-sm text-fg">
				<input type="checkbox" name="useLeadDraft" defaultChecked={defaults?.useLeadDraft ?? false} />
				Wyślij draft AI
			</label>
		</>
	)
}

export function SequenceSteps({campaignId, templates, steps, campaignActive}: Props) {
	const toast = useToast()
	const [editingId, setEditingId] = useState<string | null>(null)
	const [moveError, setMoveError] = useState<string | null>(null)
	const [moving, startMove] = useTransition()
	const [addState, addAction, addPending] = useActionState<StepResult | null, FormData>(addSequenceStep, null)
	const [updState, updAction, updPending] = useActionState<StepResult | null, FormData>(
		async (prev, formData) => {
			const res = await updateSequenceStep(prev, formData)
			if (res?.ok) {
				toast("Zapisano krok")
				setEditingId(null)
			}
			return res
		},
		null,
	)

	function move(stepId: string, dir: "up" | "down") {
		startMove(async () => {
			const res = await moveSequenceStep(stepId, dir, campaignId)
			setMoveError(res.ok ? null : res.error)
		})
	}

	const reorderHint = campaignActive ? "Wstrzymaj kampanię, aby zmienić kolejność" : undefined

	return (
		<div className="flex flex-col gap-2">
			{steps.map((s, i) => (
				<Card className="px-3.5 py-2.5" key={s.id}>
					{editingId === s.id ? (
						<form className="flex flex-wrap items-center gap-2" action={updAction}>
							<input type="hidden" name="campaignId" value={campaignId} />
							<input type="hidden" name="stepId" value={s.id} />
							<span className="grid size-[22px] flex-none place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg-muted">{s.order + 1}</span>
							<StepFields templates={templates} defaults={s} />
							<span className="ml-auto flex flex-none gap-2">
								<Button variant="ghost" type="button" onClick={() => setEditingId(null)}>Anuluj</Button>
								<Button variant="primary" type="submit" disabled={updPending}>Zapisz</Button>
							</span>
							{updState && !updState.ok ? <span className="w-full text-sm text-danger">{updState.error}</span> : null}
						</form>
					) : (
						<div className="flex items-center gap-3">
							<span className="grid size-[22px] flex-none place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-fg-muted">{s.order + 1}</span>
							<span className="min-w-0">
								<span className="text-sm font-medium text-fg">{s.useLeadDraft ? "draft AI" : s.templateName}</span>
								{s.useLeadDraft ? <Badge className="ml-1.5" variant="neutral">draft</Badge> : null}
								<span className="block text-[12px] text-fg-faint">
									{s.delayDays === 0 ? "od razu" : `po ${s.delayDays} dniach`} · {CONDITION_LABEL[s.condition as SequenceCondition]}
								</span>
							</span>
							<span className="ml-auto flex flex-none items-center gap-1">
								<Button variant="ghost" size="sm" type="button" disabled={campaignActive || moving || i === 0} title={reorderHint ?? "Przesuń wyżej"} aria-label="Przesuń wyżej" onClick={() => move(s.id, "up")}>▲</Button>
								<Button variant="ghost" size="sm" type="button" disabled={campaignActive || moving || i === steps.length - 1} title={reorderHint ?? "Przesuń niżej"} aria-label="Przesuń niżej" onClick={() => move(s.id, "down")}>▼</Button>
								<Button variant="ghost" size="sm" type="button" onClick={() => setEditingId(s.id)}>Edytuj</Button>
								<ConfirmButton action={deleteSequenceStep.bind(null, s.id, campaignId)} confirm={{title: "Usunąć krok sekwencji?", body: "Tej operacji nie można cofnąć.", confirmLabel: "Usuń", danger: true}} toast="Usunięto krok">Usuń</ConfirmButton>
							</span>
						</div>
					)}
				</Card>
			))}
			{steps.length === 0 ? <p className="text-sm text-fg-muted">Brak kroków.</p> : null}
			{moveError ? <p className="text-sm text-danger">{moveError}</p> : null}
			{campaignActive && steps.length > 1 ? <p className="text-[11.5px] text-fg-faint">Wstrzymaj kampanię, aby zmienić kolejność kroków.</p> : null}
			<form className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-4" action={addAction}>
				<input type="hidden" name="campaignId" value={campaignId} />
				<StepFields templates={templates} />
				<Button variant="primary" type="submit" disabled={addPending}>Dodaj krok</Button>
				{addState && !addState.ok ? <span className="text-sm text-danger">{addState.error}</span> : null}
			</form>
		</div>
	)
}
```

- [ ] **Step 4: create `assign-leads-form.tsx`**:

```tsx
"use client"
// app/(app)/kampanie/[id]/assign-leads-form.tsx

import {useActionState} from "react"
import {assignLeads, type StepResult} from "@/features/campaigns/actions"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function AssignLeadsForm({campaignId, offeringLines}: {campaignId: string; offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<StepResult | null, FormData>(assignLeads, null)

	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Przypisz leady</div>
			<form className="flex flex-wrap items-center gap-2" action={action}>
				<input type="hidden" name="campaignId" value={campaignId} />
				<Select className="w-64" name="offeringLineId" defaultValue="">
					<option value="">— wszystkie leady —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</Select>
				<Button variant="primary" type="submit" disabled={pending}>Przypisz</Button>
				{state ? (state.ok ? <span className="text-sm text-success">Przypisano.</span> : <span className="text-sm text-danger">{state.error}</span>) : null}
			</form>
		</div>
	)
}
```

- [ ] **Step 5: rewrite `sending-controls.tsx`** (mailbox only — activate/pause moved to the header; complete file):

```tsx
"use client"
// app/(app)/kampanie/[id]/sending-controls.tsx

import {setSendingMailbox} from "@/features/campaigns/sending-actions"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

interface Props {
	campaignId: string
	mailboxes: {id: string; email: string}[]
	currentMailboxId: string | null
	canManageSending: boolean
}

export function SendingControls({campaignId, mailboxes, currentMailboxId, canManageSending}: Props) {
	if (!canManageSending) return null

	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">Skrzynka wysyłkowa</div>
			<form className="flex flex-wrap items-center gap-2" action={(formData) => setSendingMailbox(campaignId, String(formData.get("emailAccountId") ?? ""))}>
				<Select className="w-64" name="emailAccountId" defaultValue={currentMailboxId ?? ""}>
					<option value="">— skrzynka wysyłkowa —</option>
					{mailboxes.map((m) => (
						<option key={m.id} value={m.id}>
							{m.email}
						</option>
					))}
				</Select>
				<Button type="submit">Zapisz skrzynkę</Button>
			</form>
			{mailboxes.length === 0 ? (
				<p className="text-sm text-fg-muted">
					Brak skrzynek.{" "}
					<a className="text-fg underline underline-offset-2" href="/skrzynki">
						Połącz skrzynkę
					</a>
					.
				</p>
			) : null}
		</div>
	)
}
```

- [ ] **Step 6: rewrite `app/(app)/kampanie/[id]/page.tsx`** (complete file — queries unchanged except `steps` mapping gains `templateId`):

```tsx
// app/(app)/kampanie/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {hasRole} from "@/features/team/roles"
import {listEmailAccounts} from "@/features/email-accounts/queries"
import {getCampaignMetrics} from "@/features/metrics/queries"
import {formatPct, formatInt} from "@/features/metrics/compute"
import {Badge} from "@/components/ui/badge"
import {Card} from "@/components/ui/card"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT} from "@/features/enums/labels"
import {CampaignTabs} from "./campaign-tabs"
import {CampaignHeaderActions} from "./campaign-header-actions"
import {SequenceSteps} from "./sequence-steps"
import {AssignLeadsForm} from "./assign-leads-form"
import {SendingControls} from "./sending-controls"
import {LeadInbox} from "./lead-inbox"
import {MetricStat} from "../../dashboard-parts"

export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) {
	const {orgId, role} = await requireOrg()
	const {id} = await params

	const campaign = await prisma.campaign.findFirst({
		where: {id, organizationId: orgId},
		include: {
			steps: {orderBy: {order: "asc"}, include: {template: {select: {name: true}}}},
			_count: {select: {campaignLeads: true}},
		},
	})
	if (!campaign) notFound()

	const metrics = await getCampaignMetrics(id, orgId)

	const leads = await prisma.campaignLead.findMany({
		where: {campaignId: id, messages: {some: {direction: "INBOUND"}}},
		select: {
			id: true,
			status: true,
			lead: {select: {organizationName: true}},
			messages: {where: {direction: "INBOUND"}, orderBy: {createdAt: "desc"}, take: 1, select: {inboundKind: true, body: true}},
		},
		orderBy: {createdAt: "asc"},
	})

	const [templates, offeringLines, mailboxes] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		listEmailAccounts(orgId),
	])

	const canManageSending = hasRole(role, "ADMIN")

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-fg-muted hover:text-fg hover:underline underline-offset-2" href="/kampanie">
				← Kampanie
			</Link>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-lg font-semibold">
					{campaign.name}{" "}
					<Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>{" "}
					<span className="text-sm font-normal text-fg-faint">· {campaign._count.campaignLeads} leadów</span>
				</h1>
				<CampaignHeaderActions campaignId={campaign.id} status={campaign.status} canManageSending={canManageSending} hasMailbox={Boolean(campaign.sendingEmailAccountId)} />
			</div>
			{metrics ? (
				<Card className="flex flex-wrap divide-x divide-border">
					<div className="px-4 py-3"><MetricStat label="Wysłane maile" value={formatInt(metrics.mailsSent)} /></div>
					<div className="px-4 py-3"><MetricStat label="Skontaktowani" value={formatInt(metrics.rates.contacted)} /></div>
					<div className="px-4 py-3"><MetricStat label="Odpowiedzi" value={`${formatInt(metrics.breakdown.replied)} · ${formatPct(metrics.rates.replyRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Odbicia" value={`${formatInt(metrics.breakdown.bounced)} · ${formatPct(metrics.rates.bounceRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Rezygnacje" value={`${formatInt(metrics.breakdown.unsubscribed)} · ${formatPct(metrics.rates.unsubRate)}`} /></div>
					<div className="px-4 py-3"><MetricStat label="Błędy" value={formatInt(metrics.breakdown.failed)} /></div>
				</Card>
			) : null}
			<CampaignTabs
				inboundCount={leads.length}
				sekwencja={
					<SequenceSteps
						campaignId={campaign.id}
						templates={templates}
						campaignActive={campaign.status === "ACTIVE"}
						steps={campaign.steps.map((s) => ({
							id: s.id,
							order: s.order,
							delayDays: s.delayDays,
							condition: s.condition,
							templateId: s.templateId,
							templateName: s.template.name,
							useLeadDraft: s.useLeadDraft,
						}))}
					/>
				}
				leady={
					<div className="flex flex-col gap-6">
						<SendingControls campaignId={campaign.id} mailboxes={mailboxes.map((m) => ({id: m.id, email: m.email}))} currentMailboxId={campaign.sendingEmailAccountId} canManageSending={canManageSending} />
						<AssignLeadsForm campaignId={campaign.id} offeringLines={offeringLines} />
					</div>
				}
				przychodzace={
					<LeadInbox
						rows={leads.map((l) => ({
							id: l.id,
							org: l.lead.organizationName,
							status: l.status,
							inboundKind: l.messages[0]?.inboundKind ?? null,
							snippet: l.messages[0]?.body ?? null,
						}))}
					/>
				}
			/>
		</section>
	)
}
```

- [ ] **Step 7: delete the old combined component**

```bash
git rm "app/(app)/kampanie/[id]/sequence-and-leads.tsx"
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` (exit 0), `npx eslint "app/(app)/kampanie"` (clean). Grep: `rg -n "sequence-and-leads" app` → zero matches.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/kampanie/[id]"
git commit -m "feat(campaigns): campaign page tabs - header actions, metrics strip, step edit and reorder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Gates, guards, graphify, ROADMAP

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: full gates**

Run in order, expect:
- `npx tsc --noEmit` → exit 0
- `npx vitest run` → **264 passed** (258 + 6 reorder)
- `npx eslint app components features` → clean
- `npx next build` → success (the dev server must be OFF — if `.next` is locked, STOP and report; do not kill processes)

- [ ] **Step 2: guard greps**

- `rg -n "accent" app components --glob "!*.css"` → previous allowlist (sidebar dot+bar, settings-shell rail, switch, mailbox chips, login dot) PLUS exactly two new sites: `app/(app)/kampanie/[id]/campaign-tabs.tsx` (`border-accent` active tab) and `app/(app)/szablony/templates-shell.tsx` (`before:bg-accent` rail kreska). Anything else = failure.
- `rg -n "bg-glow|0_0_0_3px|shadow-\[" app components` → zero matches.
- `rg -n "template-editor|sequence-and-leads" app` → zero matches.

- [ ] **Step 3: graphify**

Run: `graphify update .` (AST-only). Non-blocking if the CLI is missing — report and move on.

- [ ] **Step 4: ROADMAP**

In `docs/superpowers/ROADMAP.md`, REPLACE the leading portion of the first body paragraph — from `**▶ NEXT TASK: USER-RUN checks — the code is DONE through \`design-refinement\` (2026-06-10).**` up to (not including) `**Post-phase polish \`design-refinement\` is DONE` — with EXACTLY:

**▶ NEXT TASK: USER-RUN checks — the code is DONE through `templates-campaign-polish` (round 2, 2026-06-10).** Remaining, in order: (1) the user's live eyeball on :3000 in BOTH themes — round-2 smoke: edit a template that is in a sequence (the impossible-before case), switch rail items with unsaved changes (dirty dialog), „+ Nowy szablon" from the header, campaign tabs (counter on Przychodzące), inline step edit on an ACTIVE campaign, reorder arrows disabled on ACTIVE and working after Pauza, table row hover on /leady, day-chip Tab focus on /skrzynki — plus the design-refinement list (login, dashboard mono charts, wizard bars, Confirm entrance, Toast); (2) the team-role-ui second-account smoke; (3) the funded `ANTHROPIC_API_KEY` live AI runs + Inngest Cloud cron verification; (4) the production deploy (runbook offered, parked). Open chips: OAuth-state/key-split hardening, `updateLead` phone/region gap, 5c deferred items (List-Unsubscribe, bounce auto-suppress). **Post-phase polish `templates-campaign-polish` (round 2) is DONE + verified 2026-06-10 (tsc 0, vitest 264, eslint clean, `next build` GREEN): /szablony is a master-detail editor with EDIT, /kampanie/[id] has tabs with sequence step edit + reorder, five review micro-fixes landed.** Spec `docs/superpowers/specs/2026-06-10-templates-campaign-polish-design.md`, plan `docs/superpowers/plans/2026-06-10-templates-campaign-polish.md`, mocks `.superpowers/brainstorm/746-1781102668/content/` (user picks: templates C master-detail [responsive fallback], campaign B tabs, sequence scope = layout + edit + reorder). NEW server actions (first behavior additions in the polish rounds): `updateTemplate` (org-scoped updateMany, explicit field list preserving visibility/folder), `updateSequenceStep`, `moveSequenceStep` (REORDER GATED to non-ACTIVE campaigns — engine-grounded: the sending handler re-reads steps fresh per Inngest replay and the cursor find is gap-safe, so field edits are safe in flight but cross-cursor reorder could re-send/skip; 3-update $transaction swap via temp order -1 because of `@@unique([campaignId, order])`; pure `planSwap` helper TDD +6). The stale `sending.ts:39` comment corrected (comment-only diff). /szablony: `templates-shell.tsx` (rail with active kreska + dirty dot + meta, uppercase-label form, Switch+hidden-mirror `value="on"`, sticky preview Card, delete moved into the editor [hidden when in-use], dirty-switch guard via useConfirm, toasts; PageHeader action = real Button); `template-editor.tsx` deleted. /kampanie/[id]: header actions by status (ACTIVE→Pauza, else Aktywuj [ADMIN, disabled w/o mailbox]), metrics strip Card divide-x, `campaign-tabs.tsx` (client, settings-shell idiom; accent underline = allowlisted as the user's „kreska aktywnej zakładki"), tab 1 step Cards (▲▼ via useTransition + inline edit form + add form), tab 2 slim `sending-controls.tsx` (mailbox only, ADMIN) + `assign-leads-form.tsx`, tab 3 LeadInbox (+count badge on the tab); `sequence-and-leads.tsx` deleted. Micro-fixes: pipeline drag-over `ring-1 ring-border-strong`, Table `[&_tbody_tr:hover]:bg-surface-2/50`, light `--border-focus` .45→.55, day-chip `peer-focus-visible` ring. Accent allowlist now: sidebar dot+bar, settings rail, switch, day chips, login dot, campaign tab underline, templates rail kreska, `:focus-visible`. NOT live-eyeballed by me (user reviews on :3000). 

(Keep everything after `**Post-phase polish \`design-refinement\` is DONE` intact.)

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/ROADMAP.md
git commit -m "docs: round-2 polish DONE - templates editor with edit, campaign tabs with step edit/reorder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
