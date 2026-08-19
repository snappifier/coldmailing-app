# Campaign Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 4-step create-campaign modal wizard (basics → messages → leads → launch) that creates templates+campaign+steps+assignments atomically and optionally activates — replacing the small create-campaign modal.

**Architecture:** One pure parser (`features/campaigns/wizard.ts`, TDD) feeds one atomic server action (`features/campaigns/wizard-actions.ts`) that reuses the existing `activateCampaign`. The UI is one client component copying the PROVEN lead-wizard idiom (all steps mounted + `hidden`, imperative `animate()` slide, `useActionState` wrapper). Wizard templates are hidden from the library via a `folder` sentinel.

**Tech Stack:** Next 16 server actions, Prisma 7 (`@/generated/prisma/client`), Zod 4 (`z.email()` idioms), Motion (`motion/react`), Vitest 4.

**Conventions (MANDATORY — these override any habit):**
- Tabs, no semicolons, `className` first, `import {x}` no inner spaces, NO emoji, Polish UI strings, NO file-path comments.
- **Commits: `scope: lowercase one-line description` — NO `feat:`/`fix:`/`test:` prefixes, NO `Co-Authored-By` trailer, author stays the user's git config.** Follow-up fixes to a just-made commit are `--amend`ed, not stacked.
- Never `git push`. Dev server is the USER's; do not start/stop it.
- Spec: `docs/superpowers/specs/2026-08-20-campaign-wizard-design.md` (user-approved — binding).

**Existing facts the plan relies on (verified 2026-08-20):**
- `components/ui/modal.tsx` `Modal` already accepts a `width` prop (default 420) — pass `width={640}`; NO modal changes needed.
- `app/(app)/leady/lead-create-button.tsx` is the wizard idiom to copy (mounted+hidden steps, `prevStepRef` slide effect, progress bar `SPRING_SETTLE`, footer buttons, `reportValidity` gate).
- `features/campaigns/sending-actions.ts` exports `activateCampaign(campaignId)` — does `requireRole("ADMIN")`, validation (`validateActivation`), scheduling and `campaign/lead.start` events itself. REUSE it; do not reimplement activation.
- `features/campaigns/schema.ts` has `campaignSchema` (name 1..120, offeringLineId ""→null).
- /leady filter where-clause idiom: `offeringLineId`, `score: {gte}`, `OR` of `organizationName/email/contactPersonName contains insensitive`.
- Template built-in tokens (`features/templates/render.ts` `BUILTIN_KEYS`): `nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy`.
- Library queries to filter: `app/(app)/szablony/page.tsx:11` and the step-template dropdown `app/(app)/kampanie/[id]/page.tsx:47`.
- Current create-modal files to REPLACE: `app/(app)/kampanie/kampania-create-button.tsx` + `app/(app)/kampanie/campaign-form.tsx`; used in `app/(app)/kampanie/page.tsx` (header action + EmptyState action).

---

### Task 1: Pure wizard parser (TDD)

**Files:**
- Create: `features/campaigns/wizard.ts`
- Test: `features/campaigns/wizard.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {describe, it, expect} from "vitest"
import {parseWizardMessages, buildWizardTemplateName, WIZARD_FOLDER} from "@/features/campaigns/wizard"

describe("parseWizardMessages", () => {
	it("parses the first message with ALWAYS/delay 0 and follow-ups with SEND_IF_NO_REPLY", () => {
		const res = parseWizardMessages({subject_0: " Temat ", body_0: "Treść", subject_1: "Fu", body_1: "Fu treść", delay_1: "4"})
		expect(res).toEqual({
			ok: true,
			messages: [
				{subject: "Temat", body: "Treść", delayDays: 0, condition: "ALWAYS"},
				{subject: "Fu", body: "Fu treść", delayDays: 4, condition: "SEND_IF_NO_REPLY"},
			],
		})
	})
	it("requires subject and body on the first message", () => {
		expect(parseWizardMessages({subject_0: "", body_0: "x"})).toEqual({ok: false, error: "Podaj temat wiadomości"})
		expect(parseWizardMessages({subject_0: "x", body_0: " "})).toEqual({ok: false, error: "Podaj treść wiadomości"})
	})
	it("skips fully empty follow-up slots but rejects half-filled ones", () => {
		const res = parseWizardMessages({subject_0: "a", body_0: "b", subject_2: "tylko temat", body_2: "", delay_2: "3"})
		expect(res.ok).toBe(false)
	})
	it("bounds follow-up delay to 1-30 integer days", () => {
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "0"}).ok).toBe(false)
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "31"}).ok).toBe(false)
		expect(parseWizardMessages({subject_0: "a", body_0: "b", subject_1: "c", body_1: "d", delay_1: "2.5"}).ok).toBe(false)
	})
	it("builds campaign-scoped template names and exposes the folder sentinel", () => {
		expect(buildWizardTemplateName("Q3 Małopolska", 0)).toBe("Q3 Małopolska — krok 1")
		expect(WIZARD_FOLDER).toBe("__kreator__")
	})
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run features/campaigns/wizard.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export const WIZARD_FOLDER = "__kreator__"

export interface WizardMessage {
	subject: string
	body: string
	delayDays: number
	condition: "ALWAYS" | "SEND_IF_NO_REPLY"
}

export type WizardMessagesResult = {ok: true; messages: WizardMessage[]} | {ok: false; error: string}

// Flat FormData fields subject_0..3 / body_0..3 / delay_1..3 -> validated message list.
// Slot 0 is the opener (ALWAYS, delay 0); empty follow-up slots are skipped (the UI may remove a
// middle follow-up), half-filled ones are an error.
export function parseWizardMessages(fields: Record<string, unknown>): WizardMessagesResult {
	const messages: WizardMessage[] = []
	for (let i = 0; i <= 3; i++) {
		const subject = typeof fields[`subject_${i}`] === "string" ? (fields[`subject_${i}`] as string).trim() : ""
		const body = typeof fields[`body_${i}`] === "string" ? (fields[`body_${i}`] as string).trim() : ""
		if (i === 0) {
			if (!subject) return {ok: false, error: "Podaj temat wiadomości"}
			if (!body) return {ok: false, error: "Podaj treść wiadomości"}
			messages.push({subject, body, delayDays: 0, condition: "ALWAYS"})
			continue
		}
		if (!subject && !body) continue
		if (!subject || !body) return {ok: false, error: `Uzupełnij temat i treść follow-upu ${i}`}
		const delay = Number(fields[`delay_${i}`])
		if (!Number.isInteger(delay) || delay < 1 || delay > 30) return {ok: false, error: `Follow-up ${i}: opóźnienie musi być liczbą 1–30 dni`}
		messages.push({subject, body, delayDays: delay, condition: "SEND_IF_NO_REPLY"})
	}
	return {ok: true, messages}
}

export function buildWizardTemplateName(campaignName: string, index: number): string {
	return `${campaignName} — krok ${index + 1}`
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run features/campaigns/wizard.test.ts` → PASS. Then `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add features/campaigns/wizard.ts features/campaigns/wizard.test.ts
git commit -m "kreator: pure wizard message parser with folder sentinel"
```

---

### Task 2: Wizard server actions

**Files:**
- Create: `features/campaigns/wizard-actions.ts`

- [ ] **Step 1: Write the actions file**

```ts
"use server"

import {revalidatePath} from "next/cache"
import {z} from "zod"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {activateCampaign} from "@/features/campaigns/sending-actions"
import {parseWizardMessages, buildWizardTemplateName, WIZARD_FOLDER} from "@/features/campaigns/wizard"

export interface WizardCriteria {
	line: string | null
	minScore: number | null
	q: string | null
}

export type WizardResult =
	| {ok: true; campaignId: string; activated: boolean; activationError?: string}
	| {ok: false; error: string}

const basicsSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę kampanii").max(120),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
	filter_line: z.string().trim().optional().transform((v) => (v ? v : null)),
	filter_minScore: z.string().trim().optional().transform((v) => (v && Number.isFinite(Number(v)) ? Number(v) : null)),
	filter_q: z.string().trim().optional().transform((v) => (v ? v : null)),
	mailboxId: z.string().trim().optional().transform((v) => (v ? v : null)),
	mode: z.enum(["draft", "activate"]).default("draft"),
})

// Same filter idiom as /leady, plus the wizard invariants: lead has an email and is not suppressed.
async function wizardLeadWhere(orgId: string, c: WizardCriteria): Promise<Prisma.LeadWhereInput> {
	const suppressed = await prisma.suppression.findMany({where: {organizationId: orgId}, select: {email: true}})
	const where: Prisma.LeadWhereInput = {organizationId: orgId, email: {not: null}}
	if (c.line) where.offeringLineId = c.line
	if (c.minScore !== null) where.score = {gte: c.minScore}
	if (c.q) {
		where.OR = [
			{organizationName: {contains: c.q, mode: "insensitive"}},
			{email: {contains: c.q, mode: "insensitive"}},
			{contactPersonName: {contains: c.q, mode: "insensitive"}},
		]
	}
	if (suppressed.length > 0) where.NOT = {email: {in: suppressed.map((s) => s.email)}}
	return where
}

// Live count for wizard step 3.
export async function countWizardLeads(c: WizardCriteria): Promise<{count: number; sample: string[]}> {
	const {orgId} = await requireOrg()
	const where = await wizardLeadWhere(orgId, c)
	const [count, sample] = await Promise.all([
		prisma.lead.count({where}),
		prisma.lead.findMany({where, take: 4, orderBy: {createdAt: "desc"}, select: {organizationName: true}}),
	])
	return {count, sample: sample.map((s) => s.organizationName)}
}

export async function createCampaignFromWizard(_prev: WizardResult | null, formData: FormData): Promise<WizardResult> {
	const {orgId, userId} = await requireOrg()
	const fields = Object.fromEntries(formData)
	const basics = basicsSchema.safeParse(fields)
	if (!basics.success) return {ok: false, error: basics.error.issues[0]?.message ?? "Błędne dane"}
	const parsed = parseWizardMessages(fields)
	if (!parsed.ok) return parsed

	// Mailbox must belong to the org; a foreign id silently degrades to none.
	const mailbox = basics.data.mailboxId
		? await prisma.emailAccount.findFirst({where: {id: basics.data.mailboxId, organizationId: orgId}, select: {id: true}})
		: null

	const where = await wizardLeadWhere(orgId, {line: basics.data.filter_line, minScore: basics.data.filter_minScore, q: basics.data.filter_q})

	let campaignId: string
	try {
		campaignId = await prisma.$transaction(async (tx) => {
			const templateIds: string[] = []
			for (const [i, m] of parsed.messages.entries()) {
				const t = await tx.template.create({
					data: {
						organizationId: orgId,
						createdById: userId,
						name: buildWizardTemplateName(basics.data.name, i),
						subject: m.subject,
						body: m.body,
						isFollowup: i > 0,
						offeringLineId: basics.data.offeringLineId,
						folder: WIZARD_FOLDER,
					},
					select: {id: true},
				})
				templateIds.push(t.id)
			}
			const campaign = await tx.campaign.create({
				data: {
					organizationId: orgId,
					createdById: userId,
					name: basics.data.name,
					offeringLineId: basics.data.offeringLineId,
					sendingEmailAccountId: mailbox?.id ?? null,
				},
				select: {id: true},
			})
			await tx.sequenceStep.createMany({
				data: parsed.messages.map((m, i) => ({campaignId: campaign.id, order: i, templateId: templateIds[i], delayDays: m.delayDays, condition: m.condition})),
			})
			const leads = await tx.lead.findMany({where, select: {id: true}})
			if (leads.length > 0) {
				await tx.campaignLead.createMany({data: leads.map((l) => ({campaignId: campaign.id, leadId: l.id})), skipDuplicates: true})
			}
			return campaign.id
		})
	} catch {
		return {ok: false, error: "Kampania o tej nazwie już istnieje"}
	}

	revalidatePath("/kampanie")
	if (basics.data.mode === "activate") {
		// activateCampaign enforces ADMIN, validates mailbox/steps/leads and emits the start events.
		const act = await activateCampaign(campaignId)
		if (!act.ok) return {ok: true, campaignId, activated: false, activationError: act.error}
		return {ok: true, campaignId, activated: true}
	}
	return {ok: true, campaignId, activated: false}
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → 0. `npx eslint features/campaigns/wizard-actions.ts` → clean.

- [ ] **Step 3: Commit**

```bash
git add features/campaigns/wizard-actions.ts
git commit -m "kreator: atomic create-from-wizard action with live lead count"
```

---

### Task 3: Hide wizard templates from the library and the step dropdown

**Files:**
- Modify: `app/(app)/szablony/page.tsx` (the `prisma.template.findMany` where)
- Modify: `app/(app)/kampanie/[id]/page.tsx:47` (the dropdown `prisma.template.findMany` where)

- [ ] **Step 1: Edit both queries**

In BOTH files import the sentinel and extend the where clause. **Prisma null trap:** `{folder: {not: X}}` does NOT match rows with `folder = null`, so use an explicit OR:

```ts
import {WIZARD_FOLDER} from "@/features/campaigns/wizard"
// in the findMany where:
where: {organizationId: orgId, OR: [{folder: null}, {folder: {not: WIZARD_FOLDER}}]}
```

(If the existing where already has an `OR` — it does not today — nest with AND. Keep every other select/include/orderBy byte-identical.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → 0. Guard grep — both call sites filter:
`grep -rn "WIZARD_FOLDER" app/(app)/szablony "app/(app)/kampanie/[id]/page.tsx"` → 2 matches.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/szablony/page.tsx" "app/(app)/kampanie/[id]/page.tsx"
git commit -m "szablony: hide wizard-created templates from the library and step dropdown"
```

---

### Task 4: Wizard UI

**Files:**
- Create: `app/(app)/kampanie/campaign-wizard-button.tsx`
- Modify: `app/(app)/kampanie/page.tsx` (swap `KampaniaCreateButton` → `CampaignWizardButton`, fetch mailboxes/placeholders/role)
- Delete: `app/(app)/kampanie/kampania-create-button.tsx`, `app/(app)/kampanie/campaign-form.tsx`

- [ ] **Step 1: Check for other usages of the old modal**

Run: `grep -rn "KampaniaCreateButton\|campaign-form" app features` — expected ONLY `app/(app)/kampanie/page.tsx`. If more show up, swap those too in Step 3.

- [ ] **Step 2: Create the wizard component**

```tsx
"use client"
import {useActionState, useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {animate, motion, useReducedMotion} from "motion/react"
import {EASE_OUT_QUART, SPRING_SETTLE} from "@/lib/motion"
import {createCampaignFromWizard, countWizardLeads, type WizardResult} from "@/features/campaigns/wizard-actions"
import {Modal} from "@/components/ui/modal"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {NumberInput} from "@/components/ui/number-input"
import {Select} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {Field} from "@/components/ui/field"
import {useToast} from "@/components/ui/use-toast"
import {useConfirm} from "@/components/ui/use-confirm"

const STEPS = ["Podstawy", "Wiadomości", "Leady", "Start"] as const
const PALETTE = ["{{zwrot}}", "{{nazwaPlacowki}}", "{{osoba}}", "{{miasto}}", "{{www}}", "{{hookAI}}", "{{podpisNadawcy}}"]

interface Props {
	offeringLines: {id: string; name: string}[]
	mailboxes: {id: string; email: string}[]
	placeholderKeys: string[]
	canActivate: boolean
	variant?: "primary" | "secondary"
}

export function CampaignWizardButton({offeringLines, mailboxes, placeholderKeys, canActivate, variant = "primary"}: Props) {
	const [open, setOpen] = useState(false)
	const [step, setStep] = useState(0)
	const [followUps, setFollowUps] = useState<number[]>([])
	const [criteria, setCriteria] = useState({line: "", minScore: "", q: ""})
	const [leadCount, setLeadCount] = useState<{count: number; sample: string[]} | null>(null)
	const formRef = useRef<HTMLFormElement>(null)
	const stepRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)]
	const prevStepRef = useRef<number | null>(null)
	const lastFocusedField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
	const router = useRouter()
	const toast = useToast()
	const ask = useConfirm()
	const reduce = useReducedMotion()

	const [state, formAction, pending] = useActionState<WizardResult | null, FormData>(
		async (prev, formData) => {
			const res = await createCampaignFromWizard(prev, formData)
			if (res.ok) {
				toast(res.activated ? "Kampania aktywna — wysyłka ruszyła" : res.activationError ? `Zapisano szkic. Aktywacja: ${res.activationError}` : "Zapisano szkic kampanii")
				setOpen(false)
				router.push(`/kampanie/${res.campaignId}`)
			}
			return res
		},
		null,
	)

	// Imperative slide on step change - all steps stay MOUNTED (hidden), so uncontrolled values
	// survive; the effect performs NO setState (react-hooks/set-state-in-effect safe).
	useEffect(() => {
		if (prevStepRef.current === null) {
			prevStepRef.current = step
			return
		}
		if (prevStepRef.current === step) return
		const goingForward = step > prevStepRef.current
		prevStepRef.current = step
		const el = stepRefs[step]?.current
		if (!el || reduce) return
		animate(el, {opacity: [0, 1], x: [goingForward ? 12 : -12, 0]}, {duration: 0.2, ease: EASE_OUT_QUART})
	}, [step, reduce, stepRefs])

	// Debounced live lead count for step 3.
	useEffect(() => {
		if (!open || step !== 2) return
		const t = setTimeout(async () => {
			const res = await countWizardLeads({line: criteria.line || null, minScore: criteria.minScore ? Number(criteria.minScore) : null, q: criteria.q || null})
			setLeadCount(res)
		}, 300)
		return () => clearTimeout(t)
	}, [open, step, criteria])

	function insertToken(token: string) {
		const el = lastFocusedField.current
		if (!el) return
		el.setRangeText(token, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end")
		el.focus()
	}

	const next = () => {
		const invalid = stepRefs[step]?.current?.querySelector<HTMLInputElement>(":invalid")
		if (invalid) {
			invalid.reportValidity()
			return
		}
		setStep((s) => Math.min(3, s + 1))
	}

	async function close() {
		const dirty = formRef.current && new FormData(formRef.current).get("name")
		if (dirty && !(await ask({title: "Odrzucić szkic kampanii?", body: "Wpisane treści nie zostaną zapisane.", confirmLabel: "Odrzuć", danger: true}))) return
		setOpen(false)
		setStep(0)
		setFollowUps([])
		setLeadCount(null)
		formRef.current?.reset()
	}

	const trackFocus = {onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {lastFocusedField.current = e.currentTarget}}

	const message = (i: number, removable: boolean) => (
		<div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2/50 p-3" key={i}>
			<div className="flex items-center justify-between">
				<span className="text-[10px] font-semibold uppercase tracking-[.06em] text-fg-faint">{i === 0 ? "Wiadomość startowa" : `Follow-up ${i}`}</span>
				{removable ? (
					<button className="text-[11px] text-fg-faint hover:text-danger" type="button" onClick={() => setFollowUps((f) => f.filter((n) => n !== i))}>usuń</button>
				) : null}
			</div>
			{i > 0 ? (
				<Field label="Wyślij po (dni bez odpowiedzi)">
					<NumberInput className="w-24" name={`delay_${i}`} min={1} max={30} defaultValue={4} required />
				</Field>
			) : null}
			<Field label="Temat">
				<Input name={`subject_${i}`} required={i === 0} {...trackFocus} />
			</Field>
			<Field label="Treść">
				<Textarea name={`body_${i}`} rows={5} required={i === 0} {...trackFocus} />
			</Field>
		</div>
	)

	return (
		<>
			<Button variant={variant} type="button" onClick={() => setOpen(true)}>+ Nowa kampania</Button>
			<Modal open={open} onClose={close} title="Nowa kampania" width={640}
				footer={
					<>
						<span />
						<span className="flex gap-2">
							{step > 0 ? <Button type="button" onClick={() => setStep((s) => s - 1)}>Wstecz</Button> : <Button type="button" onClick={close}>Anuluj</Button>}
							{step < 3 ? (
								<Button variant="primary" type="button" onClick={next}>Dalej</Button>
							) : (
								<>
									<Button type="submit" form="campaign-wizard-form" name="mode" value="draft" disabled={pending}>Zapisz jako szkic</Button>
									{canActivate ? (
										<Button variant="primary" type="submit" form="campaign-wizard-form" name="mode" value="activate" disabled={pending || !leadCount || leadCount.count === 0}>Aktywuj teraz</Button>
									) : null}
								</>
							)}
						</span>
					</>
				}
			>
				<div className="mb-3">
					<p className="text-[11px] text-fg-faint">Krok {step + 1} z 4 · {STEPS[step]}</p>
					<div className="mt-1.5 h-[2px] overflow-hidden rounded-full bg-surface-3">
						<motion.div className="h-full rounded-full bg-fg" initial={false} animate={{width: `${((step + 1) / 4) * 100}%`}} transition={reduce ? {duration: 0} : SPRING_SETTLE} />
					</div>
				</div>
				<form id="campaign-wizard-form" ref={formRef} action={formAction}>
					<div className="flex flex-col gap-3" ref={stepRefs[0]} hidden={step !== 0}>
						<Field label="Nazwa kampanii"><Input name="name" placeholder="np. Strony WWW — Małopolska Q3" required /></Field>
						<Field label="Linia usługi">
							<Select name="offeringLineId" defaultValue="">
								<option value="">— brak —</option>
								{offeringLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
							</Select>
						</Field>
					</div>
					<div className="flex flex-col gap-3" ref={stepRefs[1]} hidden={step !== 1}>
						<div className="flex flex-wrap gap-1.5">
							{[...PALETTE, ...placeholderKeys.map((k) => `{{${k}}}`)].map((t) => (
								<button className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted hover:border-border-strong hover:text-fg" type="button" key={t} onClick={() => insertToken(t)}>{t}</button>
							))}
						</div>
						{message(0, false)}
						{followUps.map((i) => message(i, true))}
						{followUps.length < 3 ? (
							<button className="rounded-lg border border-dashed border-border-strong px-3 py-2 text-[12px] text-fg-muted hover:border-fg-faint hover:text-fg" type="button" onClick={() => setFollowUps((f) => [...f, (f[f.length - 1] ?? 0) + 1])}>+ dodaj follow-up</button>
						) : null}
					</div>
					<div className="flex flex-col gap-3" ref={stepRefs[2]} hidden={step !== 2}>
						<Field label="Linia usługi">
							<Select name="filter_line" value={criteria.line} onChange={(e) => setCriteria((c) => ({...c, line: e.target.value}))}>
								<option value="">— wszystkie —</option>
								{offeringLines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
							</Select>
						</Field>
						<div className="grid grid-cols-2 gap-3">
							<Field label="Min. score"><NumberInput name="filter_minScore" min={0} max={100} value={criteria.minScore} onChange={(e) => setCriteria((c) => ({...c, minScore: e.target.value}))} /></Field>
							<Field label="Szukaj"><Input name="filter_q" value={criteria.q} onChange={(e) => setCriteria((c) => ({...c, q: e.target.value}))} /></Field>
						</div>
						<div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
							<p className="text-[13px] font-semibold text-fg">{leadCount ? `Obejmie ${leadCount.count} leadów` : "Liczenie…"}</p>
							{leadCount && leadCount.sample.length > 0 ? <p className="mt-0.5 truncate text-[11px] text-fg-faint">{leadCount.sample.join(" · ")}{leadCount.count > leadCount.sample.length ? ` +${leadCount.count - leadCount.sample.length}` : ""}</p> : null}
							<p className="mt-1 text-[10.5px] text-fg-faint">Wykluczenia i duplikaty pomijane automatycznie.</p>
						</div>
					</div>
					<div className="flex flex-col gap-3" ref={stepRefs[3]} hidden={step !== 3}>
						<div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2.5 text-[12.5px] text-fg-muted">
							<p>Wiadomości: <span className="font-semibold tabular-nums text-fg">{1 + followUps.length}</span></p>
							<p>Leady: <span className="font-semibold tabular-nums text-fg">{leadCount?.count ?? 0}</span></p>
						</div>
						{canActivate ? (
							<Field label="Skrzynka wysyłkowa">
								<Select name="mailboxId" defaultValue={mailboxes.length === 1 ? mailboxes[0].id : ""}>
									<option value="">— wybierz —</option>
									{mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email}</option>)}
								</Select>
							</Field>
						) : (
							<p className="text-[12px] text-fg-faint">Skrzynkę i aktywację ustawia administrator — kampania zapisze się jako szkic.</p>
						)}
					</div>
					{state && !state.ok ? <p className="mt-3 text-sm text-danger">{state.error}</p> : null}
				</form>
			</Modal>
		</>
	)
}
```

**Note (submitter buttons):** the two submit buttons carry `name="mode" value="draft|activate"` — the browser includes ONLY the clicked submitter's pair in FormData; no hidden input needed.

- [ ] **Step 3: Wire the page**

In `app/(app)/kampanie/page.tsx`: replace the `KampaniaCreateButton` import with `CampaignWizardButton`; extend `requireOrg()` destructuring to `{orgId, role}`; add to the `Promise.all`:

```ts
prisma.emailAccount.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}, select: {id: true, email: true}}),
prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}, select: {key: true}}),
```

and render both action sites (header + EmptyState) as:

```tsx
<CampaignWizardButton offeringLines={offeringLines} mailboxes={mailboxes} placeholderKeys={placeholders.map((p) => p.key)} canActivate={role !== "MEMBER"} />
```

(EmptyState keeps `variant="secondary"`.) Then delete the two old files:

```bash
git rm "app/(app)/kampanie/kampania-create-button.tsx" "app/(app)/kampanie/campaign-form.tsx"
```

- [ ] **Step 4: Gates**

Run: `npx tsc --noEmit` → 0; `npx eslint "app/(app)/kampanie/" features/campaigns/` → clean; `npx vitest run` → all pass.
Form-contract check: `grep -o 'name="[a-z_0-9]*"' "app/(app)/kampanie/campaign-wizard-button.tsx" | sort -u` → exactly `name, offeringLineId, subject_*, body_*, delay_*, filter_line, filter_minScore, filter_q, mailboxId, mode` (matches the spec's frozen contract).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "kreator: 4-step campaign wizard modal replaces the create dialog"
```

---

### Task 5: Final gates + handoff

- [ ] **Step 1: Full suite** — `npx tsc --noEmit`, `npx vitest run`, `npx eslint app features components` (pre-existing `any` in 2 old inngest test files is a documented exception).
- [ ] **Step 2: `npx next build`** — ONLY if the user's dev server is OFF (probe `curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:3000` → non-200/307). If dev is live, record "build deferred (dev running)" in the ROADMAP line instead.
- [ ] **Step 3: `graphify update .`** and amend the artifacts into the Task 4 commit.
- [ ] **Step 4: Update `docs/superpowers/ROADMAP.md`** — mark the campaign-wizard spec as IMPLEMENTED in the "▶ NEXT" block (analytics spec remains pending) and note any deferred build. Amend into the Task 4 commit.
- [ ] **Step 5: USER smoke (manual, not yours):** create a campaign through the wizard on :3000 — draft path and, with a mailbox, the activate path; verify /szablony does NOT show the wizard templates and the campaign tabs DO show the steps.
