# Phase 3: Templates + Placeholders + Campaigns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared team template library, a user-extensible placeholder system (built-in + custom + gendered Polish forms, resolved per lead), campaigns built from template sequences with per-step delays, and lead assignment — plus a minimal lead edit form so placeholder values can be entered. No email sending (Phase 4-5).

**Architecture:** New Prisma models (Template, Placeholder, Campaign, SequenceStep, CampaignLead) scoped by `organizationId`. A pure, unit-tested `renderTemplate` resolves `{{tokens}}` (built-in -> lead fields, `{{zwrot}}` -> Pan/Pani, custom -> `lead.customFields`, gendered `{{a|b}}` -> by `honorific`). Server Actions (mirroring Phase 0+1) drive CRUD; minimal raw-Tailwind client components provide the editor, placeholder palette, live preview, and forms.

**Tech Stack:** Next 16 App Router, React 19 (`useActionState`), Prisma 7 (generated client at `@/generated/prisma/client`), Zod 4 (`z.email()` etc.), Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (or line 2 after a `"use server"`/`"use client"` directive), `className` first, `import {x}` no inner spaces, no emoji.

---

## Files

- Modify `prisma/schema.prisma` — 5 enums + 5 models + reverse relations on Organization/User/OfferingLine/Lead.
- Create `features/templates/render.ts` + `render.test.ts` — pure renderer (TDD).
- Create `features/templates/schema.ts`, `features/templates/actions.ts`.
- Create `features/placeholders/schema.ts`, `features/placeholders/actions.ts`.
- Create `features/campaigns/schema.ts`, `features/campaigns/actions.ts`.
- Modify `features/leads/actions.ts` — add `updateLead`.
- Create UI under `app/(app)/szablony/*`, `app/(app)/placeholdery/*`, `app/(app)/kampanie/*`, `app/(app)/leady/[id]/*`.
- Modify `app/(app)/layout.tsx` — add nav links.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the five enums**

Append to `prisma/schema.prisma` (after the existing enums):

```prisma
enum TemplateVisibility {
	TEAM
	PRIVATE
}

enum PlaceholderType {
	TEXT
	CHOICE
}

enum CampaignStatus {
	DRAFT
	ACTIVE
	PAUSED
	DONE
}

enum SequenceCondition {
	ALWAYS
	SEND_IF_NO_REPLY
}

enum CampaignLeadStatus {
	PENDING
	ACTIVE
	REPLIED
	BOUNCED
	UNSUBSCRIBED
	DONE
}
```

- [ ] **Step 2: Add reverse relations to existing models**

In `model Organization`, add these relation fields:

```prisma
	templates    Template[]
	placeholders Placeholder[]
	campaigns    Campaign[]
```

In `model User`, add:

```prisma
	templates    Template[]    @relation("TemplateCreatedBy")
	placeholders Placeholder[] @relation("PlaceholderCreatedBy")
	campaigns    Campaign[]    @relation("CampaignCreatedBy")
```

In `model OfferingLine`, add:

```prisma
	templates Template[]
	campaigns Campaign[]
```

In `model Lead`, add:

```prisma
	campaignLeads CampaignLead[]
```

- [ ] **Step 3: Add the five new models**

Append to `prisma/schema.prisma`:

```prisma
model Template {
	id             String             @id @default(cuid())
	organizationId String
	name           String
	subject        String
	body           String
	isFollowup     Boolean            @default(false)
	offeringLineId String?
	visibility     TemplateVisibility @default(TEAM)
	folder         String?
	createdById    String?
	createdAt      DateTime           @default(now())
	updatedAt      DateTime           @updatedAt

	organization  Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	offeringLine  OfferingLine?  @relation(fields: [offeringLineId], references: [id], onDelete: SetNull)
	createdBy     User?          @relation("TemplateCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
	sequenceSteps SequenceStep[]

	@@index([organizationId])
}

model Placeholder {
	id             String          @id @default(cuid())
	organizationId String
	key            String
	label          String
	type           PlaceholderType @default(TEXT)
	options        Json?
	fallback       String?
	source         String?
	createdById    String?
	createdAt      DateTime        @default(now())
	updatedAt      DateTime        @updatedAt

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	createdBy    User?        @relation("PlaceholderCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@unique([organizationId, key])
}

model Campaign {
	id             String         @id @default(cuid())
	organizationId String
	offeringLineId String?
	name           String
	status         CampaignStatus @default(DRAFT)
	createdById    String?
	createdAt      DateTime       @default(now())
	updatedAt      DateTime       @updatedAt

	organization  Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	offeringLine  OfferingLine?  @relation(fields: [offeringLineId], references: [id], onDelete: SetNull)
	createdBy     User?          @relation("CampaignCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
	steps         SequenceStep[]
	campaignLeads CampaignLead[]

	@@unique([organizationId, name])
}

model SequenceStep {
	id         String            @id @default(cuid())
	campaignId String
	order      Int
	templateId String
	delayDays  Int               @default(0)
	condition  SequenceCondition @default(SEND_IF_NO_REPLY)

	campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
	template Template @relation(fields: [templateId], references: [id], onDelete: Restrict)

	@@unique([campaignId, order])
}

model CampaignLead {
	id          String             @id @default(cuid())
	campaignId  String
	leadId      String
	status      CampaignLeadStatus @default(PENDING)
	currentStep Int                @default(0)
	nextSendAt  DateTime?
	createdAt   DateTime           @default(now())

	campaign Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
	lead     Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)

	@@unique([campaignId, leadId])
}
```

- [ ] **Step 4: Migrate + generate**

Run: `npx prisma migrate dev --name phase3_templates_campaigns`
Expected: a new migration is created and applied to Neon; the client regenerates. (`prisma migrate dev` runs `generate` afterward.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (new models resolve through `@/generated/prisma/client`).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: schema for templates, placeholders, campaigns, sequence steps, campaign leads"
```

---

## Task 2: TemplateRenderer (pure core, TDD)

**Files:**
- Create: `features/templates/render.ts`
- Create: `features/templates/render.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// features/templates/render.test.ts
import {describe, it, expect} from "vitest"
import {renderTemplate, type RenderContext} from "@/features/templates/render"

function ctx(over: Partial<RenderContext> = {}): RenderContext {
	return {
		lead: {
			organizationName: "I LO Zamość",
			contactPersonName: "Jan Kowalski",
			city: "Zamość",
			website: "https://1lo.com.pl",
			aiHook: "świetne wyniki maturalne",
			honorific: "PAN",
			customFields: {branza: "edukacja"},
		},
		senderName: "Krystian",
		placeholders: [{key: "branza", source: null, fallback: null}],
		...over,
	}
}

describe("renderTemplate", () => {
	it("resolves built-in tokens", () => {
		const r = renderTemplate("{{osoba}} z {{nazwaPlacowki}} ({{miasto}})", ctx())
		expect(r.rendered).toBe("Jan Kowalski z I LO Zamość (Zamość)")
		expect(r.missing).toEqual([])
	})

	it("resolves {{zwrot}} by honorific and flags null", () => {
		expect(renderTemplate("{{zwrot}}", ctx({lead: {...ctx().lead, honorific: "PANI"}})).rendered).toBe("Pani")
		const none = renderTemplate("{{zwrot}}", ctx({lead: {...ctx().lead, honorific: null}}))
		expect(none.rendered).toBe("[brak: zwrot]")
		expect(none.missing).toEqual(["zwrot"])
	})

	it("resolves gendered forms by honorific", () => {
		expect(renderTemplate("{{Szanowny|Szanowna}} Panie", ctx()).rendered).toBe("Szanowny Panie")
		expect(renderTemplate("{{Szanowny|Szanowna}}", ctx({lead: {...ctx().lead, honorific: "PANI"}})).rendered).toBe("Szanowna")
		const none = renderTemplate("{{Szanowny|Szanowna}}", ctx({lead: {...ctx().lead, honorific: null}}))
		expect(none.rendered).toBe("Szanowny")
		expect(none.missing).toEqual(["Szanowny|Szanowna"])
	})

	it("resolves custom placeholder from customFields", () => {
		expect(renderTemplate("Branża: {{branza}}", ctx()).rendered).toBe("Branża: edukacja")
	})

	it("uses fallback then flags missing custom placeholder", () => {
		const withFallback = ctx({lead: {...ctx().lead, customFields: {}}, placeholders: [{key: "branza", source: null, fallback: "oświata"}]})
		expect(renderTemplate("{{branza}}", withFallback).rendered).toBe("oświata")
		const noFallback = ctx({lead: {...ctx().lead, customFields: {}}})
		const r = renderTemplate("{{branza}}", noFallback)
		expect(r.rendered).toBe("[brak: branza]")
		expect(r.missing).toEqual(["branza"])
	})

	it("flags unknown tokens and tolerates whitespace and repeats", () => {
		const r = renderTemplate("{{ osoba }} {{cos}} {{cos}}", ctx())
		expect(r.rendered).toBe("Jan Kowalski [brak: cos] [brak: cos]")
		expect(r.missing).toEqual(["cos", "cos"])
	})
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run features/templates/render.test.ts`
Expected: FAIL — module `@/features/templates/render` not found.

- [ ] **Step 3: Implement the renderer**

```ts
// features/templates/render.ts
export interface RenderLead {
	organizationName: string
	contactPersonName: string | null
	city: string | null
	website: string | null
	aiHook: string | null
	honorific: "PAN" | "PANI" | null
	customFields: Record<string, unknown> | null
}

export interface RenderPlaceholder {
	key: string
	source: string | null
	fallback: string | null
}

export interface RenderContext {
	lead: RenderLead
	senderName: string
	placeholders: RenderPlaceholder[]
}

export interface RenderResult {
	rendered: string
	missing: string[]
}

const TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g
const BUILTIN_KEYS = new Set(["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"])

function resolveBuiltin(key: string, ctx: RenderContext): string | null {
	const {lead, senderName} = ctx
	if (key === "nazwaPlacowki") return lead.organizationName || null
	if (key === "osoba") return lead.contactPersonName
	if (key === "miasto") return lead.city
	if (key === "www") return lead.website
	if (key === "hookAI") return lead.aiHook
	if (key === "podpisNadawcy") return senderName || null
	if (key === "zwrot") return lead.honorific === "PAN" ? "Pan" : lead.honorific === "PANI" ? "Pani" : null
	return null
}

export function renderTemplate(text: string, ctx: RenderContext): RenderResult {
	const missing: string[] = []
	const rendered = text.replace(TOKEN_RE, (_full, rawInner: string) => {
		const inner = rawInner.trim()

		if (inner.includes("|")) {
			const parts = inner.split("|").map((s) => s.trim())
			const masc = parts[0] ?? ""
			const fem = parts[1] ?? ""
			if (ctx.lead.honorific === "PAN") return masc
			if (ctx.lead.honorific === "PANI") return fem
			missing.push(inner)
			return masc
		}

		if (BUILTIN_KEYS.has(inner)) {
			const value = resolveBuiltin(inner, ctx)
			if (value) return value
			missing.push(inner)
			return `[brak: ${inner}]`
		}

		const ph = ctx.placeholders.find((p) => p.key === inner)
		if (ph) {
			const raw = ctx.lead.customFields?.[ph.source ?? ph.key]
			const value = raw === null || raw === undefined || raw === "" ? null : String(raw)
			if (value) return value
			if (ph.fallback) return ph.fallback
			missing.push(inner)
			return `[brak: ${inner}]`
		}

		missing.push(inner)
		return `[brak: ${inner}]`
	})
	return {rendered, missing}
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run features/templates/render.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add features/templates/render.ts features/templates/render.test.ts
git commit -m "feat: pure template renderer with built-in, custom and gendered tokens"
```

---

## Task 3: Placeholders (schema, actions, UI)

**Files:**
- Create: `features/placeholders/schema.ts`
- Create: `features/placeholders/schema.test.ts`
- Create: `features/placeholders/actions.ts`
- Create: `app/(app)/placeholdery/page.tsx`
- Create: `app/(app)/placeholdery/placeholder-form.tsx`

- [ ] **Step 1: Write the failing schema test**

```ts
// features/placeholders/schema.test.ts
import {describe, it, expect} from "vitest"
import {placeholderSchema} from "@/features/placeholders/schema"

describe("placeholderSchema", () => {
	it("accepts a valid TEXT placeholder and defaults source/options to null", () => {
		const p = placeholderSchema.parse({key: " branza ", label: "Branża", type: "TEXT", fallback: ""})
		expect(p.key).toBe("branza")
		expect(p.options).toBeNull()
		expect(p.fallback).toBeNull()
	})

	it("rejects keys with non-word characters", () => {
		expect(placeholderSchema.safeParse({key: "zła nazwa", label: "x", type: "TEXT"}).success).toBe(false)
	})

	it("parses CHOICE options from comma string", () => {
		const p = placeholderSchema.parse({key: "ton", label: "Ton", type: "CHOICE", options: "formalny, luźny"})
		expect(p.options).toEqual(["formalny", "luźny"])
	})
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run features/placeholders/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schema**

```ts
// features/placeholders/schema.ts
import {z} from "zod"

export const placeholderSchema = z.object({
	key: z
		.string()
		.trim()
		.min(1, "Podaj klucz")
		.max(40)
		.regex(/^[A-Za-z][A-Za-z0-9]*$/, "Klucz: litery i cyfry, bez spacji, zaczyna się literą"),
	label: z.string().trim().min(1, "Podaj etykietę").max(80),
	type: z.enum(["TEXT", "CHOICE"]),
	options: z
		.string()
		.trim()
		.optional()
		.transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null)),
	fallback: z.string().trim().max(200).optional().transform((v) => (v ? v : null)),
	source: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
})

export type PlaceholderInput = z.infer<typeof placeholderSchema>
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run features/placeholders/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the actions**

```ts
// features/placeholders/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {placeholderSchema} from "@/features/placeholders/schema"

export type PlaceholderResult = {ok: true} | {ok: false; error: string}

export async function createPlaceholder(_prev: PlaceholderResult | null, formData: FormData): Promise<PlaceholderResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = placeholderSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.placeholder.create({
			data: {
				organizationId: orgId,
				createdById: userId,
				key: parsed.data.key,
				label: parsed.data.label,
				type: parsed.data.type,
				options: parsed.data.options ?? undefined,
				fallback: parsed.data.fallback,
				source: parsed.data.source,
			},
		})
	} catch {
		return {ok: false, error: "Placeholder o tym kluczu już istnieje"}
	}
	revalidatePath("/placeholdery")
	return {ok: true}
}

export async function deletePlaceholder(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.placeholder.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/placeholdery")
}
```

- [ ] **Step 6: Implement the form (client)**

```tsx
// app/(app)/placeholdery/placeholder-form.tsx
"use client"

import {useActionState} from "react"
import {createPlaceholder, type PlaceholderResult} from "@/features/placeholders/actions"

export function PlaceholderForm() {
	const [state, action, pending] = useActionState<PlaceholderResult | null, FormData>(createPlaceholder, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-zinc-200 pb-4" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="key" placeholder="klucz (np. branza)" required />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="label" placeholder="Etykieta" required />
			<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="type" defaultValue="TEXT">
				<option value="TEXT">TEXT</option>
				<option value="CHOICE">CHOICE</option>
			</select>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="options" placeholder="opcje CHOICE: a, b, c" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="fallback" placeholder="fallback" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="source" placeholder="source (opcjonalnie)" />
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

- [ ] **Step 7: Implement the page**

```tsx
// app/(app)/placeholdery/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deletePlaceholder} from "@/features/placeholders/actions"
import {PlaceholderForm} from "./placeholder-form"

export default async function PlaceholdersPage() {
	const {orgId} = await requireOrg()
	const placeholders = await prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Placeholdery</h1>
			<p className="text-sm text-zinc-600">
				Wbudowane (zawsze dostępne): nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy. Poniżej dodajesz własne.
			</p>
			<PlaceholderForm />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{placeholders.map((p) => (
					<li className="flex items-center justify-between py-2 text-sm" key={p.id}>
						<span>
							<code>{`{{${p.key}}}`}</code> — {p.label} <span className="text-zinc-400">({p.type})</span>
						</span>
						<form action={deletePlaceholder.bind(null, p.id)}>
							<button className="text-red-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{placeholders.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak własnych placeholderów.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 8: Verify + commit**

Run `npx vitest run` (expect green) and `npx tsc --noEmit` (expect 0). With dev running + logged in, add a placeholder at `/placeholdery`, see it listed, delete it. Then:

```bash
git add features/placeholders "app/(app)/placeholdery"
git commit -m "feat: custom placeholders crud with validation and tests"
```

---

## Task 4: Templates (actions + editor with palette + live preview)

**Files:**
- Create: `features/templates/schema.ts`
- Create: `features/templates/actions.ts`
- Create: `app/(app)/szablony/page.tsx`
- Create: `app/(app)/szablony/template-editor.tsx`

- [ ] **Step 1: Implement the schema**

```ts
// features/templates/schema.ts
import {z} from "zod"

export const templateSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(120),
	subject: z.string().trim().min(1, "Podaj temat").max(300),
	body: z.string().trim().min(1, "Treść nie może być pusta"),
	isFollowup: z.preprocess((v) => v === "on" || v === true, z.boolean()),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
	visibility: z.enum(["TEAM", "PRIVATE"]).default("TEAM"),
	folder: z.string().trim().max(80).optional().transform((v) => (v ? v : null)),
})

export type TemplateInput = z.infer<typeof templateSchema>
```

- [ ] **Step 2: Implement the actions**

```ts
// features/templates/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {templateSchema} from "@/features/templates/schema"

export type TemplateResult = {ok: true; id: string} | {ok: false; error: string}

export async function createTemplate(_prev: TemplateResult | null, formData: FormData): Promise<TemplateResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = templateSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		const created = await prisma.template.create({
			data: {organizationId: orgId, createdById: userId, ...parsed.data},
			select: {id: true},
		})
		revalidatePath("/szablony")
		return {ok: true, id: created.id}
	} catch {
		return {ok: false, error: "Szablon o tej nazwie już istnieje"}
	}
}

export async function deleteTemplate(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.template.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/szablony")
}
```

- [ ] **Step 3: Implement the editor (client) with palette + live preview**

```tsx
// app/(app)/szablony/template-editor.tsx
"use client"

import {useActionState, useRef, useState} from "react"
import {createTemplate, type TemplateResult} from "@/features/templates/actions"
import {renderTemplate, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"

const BUILTIN = ["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"]

interface Props {
	offeringLines: {id: string; name: string}[]
	customPlaceholders: RenderPlaceholder[]
	customKeys: string[]
	sampleLead: RenderLead | null
	senderName: string
}

export function TemplateEditor({offeringLines, customPlaceholders, customKeys, sampleLead, senderName}: Props) {
	const [state, action, pending] = useActionState<TemplateResult | null, FormData>(createTemplate, null)
	const [subject, setSubject] = useState("")
	const [body, setBody] = useState("")
	const subjectRef = useRef<HTMLTextAreaElement>(null)
	const bodyRef = useRef<HTMLTextAreaElement>(null)
	const activeRef = useRef<"subject" | "body">("body")

	function insert(token: string) {
		const isSubject = activeRef.current === "subject"
		const el = isSubject ? subjectRef.current : bodyRef.current
		const current = isSubject ? subject : body
		const setVal = isSubject ? setSubject : setBody
		const start = el?.selectionStart ?? current.length
		const end = el?.selectionEnd ?? current.length
		const next = current.slice(0, start) + token + current.slice(end)
		setVal(next)
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
				subject: renderTemplate(subject, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
				body: renderTemplate(body, {lead: sampleLead, senderName, placeholders: customPlaceholders}),
			}
		: null
	const missing = preview ? Array.from(new Set([...preview.subject.missing, ...preview.body.missing])) : []

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<form className="flex flex-col gap-3" action={action}>
				<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="name" placeholder="Nazwa szablonu" required />
				<div className="flex flex-wrap gap-1">
					{[...BUILTIN, ...customKeys].map((k) => (
						<button className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50" key={k} type="button" onClick={() => insert(`{{${k}}}`)}>
							{`{{${k}}}`}
						</button>
					))}
					<button className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50" type="button" onClick={() => insert("{{Szanowny|Szanowna}}")}>
						{"{{Szanowny|Szanowna}}"}
					</button>
				</div>
				<textarea
					className="rounded border border-zinc-300 p-2 text-sm"
					name="subject"
					placeholder="Temat"
					value={subject}
					ref={subjectRef}
					onFocus={() => (activeRef.current = "subject")}
					onChange={(e) => setSubject(e.target.value)}
					required
				/>
				<textarea
					className="h-48 rounded border border-zinc-300 p-2 text-sm"
					name="body"
					placeholder="Treść wiadomości"
					value={body}
					ref={bodyRef}
					onFocus={() => (activeRef.current = "body")}
					onChange={(e) => setBody(e.target.value)}
					required
				/>
				<label className="flex items-center gap-2 text-sm">
					<input name="isFollowup" type="checkbox" /> To follow-up
				</label>
				<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
					<option value="">— linia usługi —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<button className="w-40 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
					Zapisz szablon
				</button>
				{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
				{state && state.ok ? <span className="text-sm text-green-700">Zapisano.</span> : null}
			</form>

			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-zinc-700">Podgląd {sampleLead ? `(${sampleLead.organizationName})` : "(brak leadów)"}</h2>
				<div className="rounded border border-zinc-200 p-3 text-sm">
					<p className="font-medium">{preview?.subject.rendered || "—"}</p>
					<hr className="my-2 border-zinc-100" />
					<p className="whitespace-pre-wrap">{preview?.body.rendered || "—"}</p>
				</div>
				{missing.length > 0 ? (
					<p className="text-xs text-amber-700">Nierozwiązane / braki: {missing.join(", ")}</p>
				) : (
					<p className="text-xs text-green-700">Wszystkie tokeny rozwiązane dla tego leada.</p>
				)}
			</div>
		</div>
	)
}
```

- [ ] **Step 4: Implement the page (server supplies lines, placeholders, sample lead, sender)**

```tsx
// app/(app)/szablony/page.tsx
import {auth} from "@/lib/auth"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteTemplate} from "@/features/templates/actions"
import {TemplateEditor} from "./template-editor"
import type {RenderLead} from "@/features/templates/render"

export default async function TemplatesPage() {
	const {orgId} = await requireOrg()
	const session = await auth()

	const [templates, offeringLines, placeholders, lead] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}, include: {offeringLine: {select: {name: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.placeholder.findMany({where: {organizationId: orgId}, orderBy: {key: "asc"}}),
		prisma.lead.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}, take: 1}),
	])

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
		<section className="flex flex-col gap-6">
			<h1 className="text-lg font-semibold">Szablony</h1>
			<TemplateEditor
				offeringLines={offeringLines}
				customPlaceholders={placeholders.map((p) => ({key: p.key, source: p.source, fallback: p.fallback}))}
				customKeys={placeholders.map((p) => p.key)}
				sampleLead={sampleLead}
				senderName={session?.user?.name ?? "Zespół"}
			/>

			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Biblioteka ({templates.length})</h2>
				<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
					{templates.map((t) => (
						<li className="flex items-center justify-between py-2 text-sm" key={t.id}>
							<span>
								{t.name} <span className="text-zinc-400">· {t.subject}</span>
								{t.isFollowup ? <span className="ml-1 text-zinc-400">(follow-up)</span> : null}
								{t.offeringLine ? <span className="ml-1 text-zinc-400">· {t.offeringLine.name}</span> : null}
							</span>
							<form action={deleteTemplate.bind(null, t.id)}>
								<button className="text-red-600" type="submit">
									Usuń
								</button>
							</form>
						</li>
					))}
					{templates.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak szablonów.</li> : null}
				</ul>
			</div>
		</section>
	)
}
```

- [ ] **Step 5: Verify + commit**

Run `npx tsc --noEmit` (expect 0) and `npx vitest run` (expect green). With dev + logged in: at `/szablony`, click placeholder buttons (insert into the focused field), watch the live preview resolve against the sample lead, type `{{Szanowny|Szanowna}}` and confirm it resolves to the lead's honorific, save a template, see it in the library, delete it. Then:

```bash
git add features/templates/schema.ts features/templates/actions.ts "app/(app)/szablony"
git commit -m "feat: template library with placeholder palette and live preview"
```

---

## Task 5: Lead edit (honorific + customFields)

**Files:**
- Modify: `features/leads/actions.ts`
- Create: `app/(app)/leady/[id]/page.tsx`
- Create: `app/(app)/leady/[id]/lead-edit-form.tsx`

- [ ] **Step 1: Add `updateLead` to the leads actions**

Add to `features/leads/actions.ts` (after `deleteLead`):

```ts
export async function updateLead(_prev: LeadActionResult | null, formData: FormData): Promise<LeadActionResult> {
	const {orgId} = await requireOrg()
	const id = String(formData.get("id") ?? "")
	if (!id) return {ok: false, error: "Brak id"}

	const honorificRaw = String(formData.get("honorific") ?? "")
	const honorific = honorificRaw === "PAN" || honorificRaw === "PANI" ? honorificRaw : null

	// customFields arrive as repeated cf_key[] / cf_value[] pairs
	const keys = formData.getAll("cf_key").map(String)
	const values = formData.getAll("cf_value").map(String)
	const customFields: Record<string, string> = {}
	keys.forEach((k, i) => {
		const trimmed = k.trim()
		if (trimmed) customFields[trimmed] = values[i] ?? ""
	})

	const parsed = leadFormSchema.safeParse({
		organizationName: formData.get("organizationName"),
		email: formData.get("email"),
		website: formData.get("website"),
		contactPersonName: formData.get("contactPersonName"),
		contactRole: formData.get("contactRole"),
		city: formData.get("city"),
	})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	const data = parsed.data
	const result = await prisma.lead.updateMany({
		where: {id, organizationId: orgId},
		data: {
			organizationName: data.organizationName,
			email: data.email,
			website: data.website,
			contactPersonName: data.contactPersonName,
			contactRole: data.contactRole,
			city: data.city,
			honorific,
			customFields,
		},
	})
	if (result.count === 0) return {ok: false, error: "Nie znaleziono leada"}

	revalidatePath("/leady")
	revalidatePath(`/leady/${id}`)
	return {ok: true}
}
```

Note: `leadFormSchema` already exists in this file and includes `contactRole`? It does not — add `contactRole` to `leadFormSchema` so edit covers it. Update the schema object to include:

```ts
	contactRole: z.string().trim().optional().transform((v) => (v ? v : null)),
```

(Place it next to `contactPersonName`. `offeringLineId` stays in the schema; `updateLead` destructures it out via `_omit` since the edit form does not change the line.)

- [ ] **Step 2: Implement the edit form (client)**

```tsx
// app/(app)/leady/[id]/lead-edit-form.tsx
"use client"

import {useActionState, useState} from "react"
import {updateLead, type LeadActionResult} from "@/features/leads/actions"

interface Props {
	lead: {
		id: string
		organizationName: string
		email: string | null
		website: string | null
		contactPersonName: string | null
		contactRole: string | null
		city: string | null
		honorific: "PAN" | "PANI" | null
	}
	customFields: {key: string; value: string}[]
}

export function LeadEditForm({lead, customFields}: Props) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(updateLead, null)
	const [rows, setRows] = useState<{key: string; value: string}[]>(customFields.length ? customFields : [{key: "", value: ""}])

	return (
		<form className="flex max-w-xl flex-col gap-3" action={action}>
			<input type="hidden" name="id" value={lead.id} />
			<label className="flex flex-col text-sm">
				Nazwa placówki
				<input className="rounded border border-zinc-300 px-2 py-1" name="organizationName" defaultValue={lead.organizationName} required />
			</label>
			<label className="flex flex-col text-sm">
				Email
				<input className="rounded border border-zinc-300 px-2 py-1" name="email" defaultValue={lead.email ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				WWW
				<input className="rounded border border-zinc-300 px-2 py-1" name="website" defaultValue={lead.website ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Osoba
				<input className="rounded border border-zinc-300 px-2 py-1" name="contactPersonName" defaultValue={lead.contactPersonName ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Rola
				<input className="rounded border border-zinc-300 px-2 py-1" name="contactRole" defaultValue={lead.contactRole ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Miasto
				<input className="rounded border border-zinc-300 px-2 py-1" name="city" defaultValue={lead.city ?? ""} />
			</label>
			<label className="flex flex-col text-sm">
				Zwrot (honorific)
				<select className="rounded border border-zinc-300 px-2 py-1" name="honorific" defaultValue={lead.honorific ?? ""}>
					<option value="">—</option>
					<option value="PAN">Pan</option>
					<option value="PANI">Pani</option>
				</select>
			</label>

			<fieldset className="flex flex-col gap-2 rounded border border-zinc-200 p-2">
				<legend className="text-xs text-zinc-500">Pola własne (customFields)</legend>
				{rows.map((row, i) => (
					<div className="flex gap-2" key={i}>
						<input
							className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm"
							name="cf_key"
							placeholder="klucz"
							value={row.key}
							onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, key: e.target.value} : r)))}
						/>
						<input
							className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
							name="cf_value"
							placeholder="wartość"
							value={row.value}
							onChange={(e) => setRows(rows.map((r, j) => (j === i ? {...r, value: e.target.value} : r)))}
						/>
					</div>
				))}
				<button className="self-start text-xs text-blue-600" type="button" onClick={() => setRows([...rows, {key: "", value: ""}])}>
					+ dodaj pole
				</button>
			</fieldset>

			<button className="w-32 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Zapisz
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
			{state && state.ok ? <span className="text-sm text-green-700">Zapisano.</span> : null}
		</form>
	)
}
```

- [ ] **Step 3: Implement the edit page (server)**

```tsx
// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {LeadEditForm} from "./lead-edit-form"

export default async function LeadEditPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const lead = await prisma.lead.findFirst({where: {id, organizationId: orgId}})
	if (!lead) notFound()

	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	const customFields = Object.entries(cf).map(([key, value]) => ({key, value: String(value ?? "")}))

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-blue-600" href="/leady">
				← Leady
			</Link>
			<h1 className="text-lg font-semibold">Edycja: {lead.organizationName}</h1>
			<LeadEditForm
				lead={{
					id: lead.id,
					organizationName: lead.organizationName,
					email: lead.email,
					website: lead.website,
					contactPersonName: lead.contactPersonName,
					contactRole: lead.contactRole,
					city: lead.city,
					honorific: lead.honorific,
				}}
				customFields={customFields}
			/>
		</section>
	)
}
```

- [ ] **Step 4: Link the table rows to the edit page**

In `app/(app)/leady/page.tsx`, make the placówka cell a link. Change the cell:

```tsx
							<td className="py-1 pr-2">{lead.organizationName}</td>
```
to:
```tsx
							<td className="py-1 pr-2">
								<a className="text-blue-600 hover:underline" href={`/leady/${lead.id}`}>
									{lead.organizationName}
								</a>
							</td>
```

- [ ] **Step 5: Verify + commit**

Run `npx tsc --noEmit` (expect 0) and `npx vitest run` (expect green). With dev + logged in: open a lead from `/leady`, set honorific to Pani, add a custom field (e.g. `branza` = `liceum`), save; reopen and confirm it persisted; check the template preview at `/szablony` now resolves `{{zwrot}}` and `{{branza}}`. Then:

```bash
git add features/leads/actions.ts "app/(app)/leady/[id]" "app/(app)/leady/page.tsx"
git commit -m "feat: lead edit form with honorific and customFields"
```

---

## Task 6: Campaigns + sequences + lead assignment

**Files:**
- Create: `features/campaigns/schema.ts`
- Create: `features/campaigns/actions.ts`
- Create: `app/(app)/kampanie/page.tsx`
- Create: `app/(app)/kampanie/campaign-form.tsx`
- Create: `app/(app)/kampanie/[id]/page.tsx`
- Create: `app/(app)/kampanie/[id]/sequence-and-leads.tsx`

- [ ] **Step 1: Implement the schema**

```ts
// features/campaigns/schema.ts
import {z} from "zod"

export const campaignSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(120),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
})

export const sequenceStepSchema = z.object({
	campaignId: z.string().trim().min(1),
	templateId: z.string().trim().min(1, "Wybierz szablon"),
	delayDays: z.coerce.number().int().min(0).max(365),
	condition: z.enum(["ALWAYS", "SEND_IF_NO_REPLY"]),
})

export type CampaignInput = z.infer<typeof campaignSchema>
export type SequenceStepInput = z.infer<typeof sequenceStepSchema>
```

- [ ] **Step 2: Implement the actions**

```ts
// features/campaigns/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {campaignSchema, sequenceStepSchema} from "@/features/campaigns/schema"

export type CampaignResult = {ok: true; id: string} | {ok: false; error: string}
export type StepResult = {ok: true} | {ok: false; error: string}

export async function createCampaign(_prev: CampaignResult | null, formData: FormData): Promise<CampaignResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = campaignSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	try {
		const created = await prisma.campaign.create({
			data: {organizationId: orgId, createdById: userId, name: parsed.data.name, offeringLineId: parsed.data.offeringLineId},
			select: {id: true},
		})
		revalidatePath("/kampanie")
		return {ok: true, id: created.id}
	} catch {
		return {ok: false, error: "Kampania o tej nazwie już istnieje"}
	}
}

export async function deleteCampaign(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.campaign.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/kampanie")
}

// Ensures the campaign belongs to the caller's org. Returns the id or throws.
async function assertCampaignInOrg(campaignId: string, orgId: string) {
	const c = await prisma.campaign.findFirst({where: {id: campaignId, organizationId: orgId}, select: {id: true}})
	if (!c) throw new Error("Campaign not found")
	return c.id
}

export async function addSequenceStep(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const parsed = sequenceStepSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	await assertCampaignInOrg(parsed.data.campaignId, orgId)

	const last = await prisma.sequenceStep.findFirst({
		where: {campaignId: parsed.data.campaignId},
		orderBy: {order: "desc"},
		select: {order: true},
	})
	await prisma.sequenceStep.create({
		data: {
			campaignId: parsed.data.campaignId,
			order: (last?.order ?? -1) + 1,
			templateId: parsed.data.templateId,
			delayDays: parsed.data.delayDays,
			condition: parsed.data.condition,
		},
	})
	revalidatePath(`/kampanie/${parsed.data.campaignId}`)
	return {ok: true}
}

export async function deleteSequenceStep(id: string, campaignId: string): Promise<void> {
	const {orgId} = await requireOrg()
	await assertCampaignInOrg(campaignId, orgId)
	await prisma.sequenceStep.deleteMany({where: {id, campaignId}})
	revalidatePath(`/kampanie/${campaignId}`)
}

// Assign all leads of an offering line (or all org leads if none) to the campaign.
export async function assignLeads(_prev: StepResult | null, formData: FormData): Promise<StepResult> {
	const {orgId} = await requireOrg()
	const campaignId = String(formData.get("campaignId") ?? "")
	const offeringLineId = String(formData.get("offeringLineId") ?? "") || null
	await assertCampaignInOrg(campaignId, orgId)

	const leads = await prisma.lead.findMany({
		where: {organizationId: orgId, ...(offeringLineId ? {offeringLineId} : {})},
		select: {id: true},
	})
	if (leads.length === 0) return {ok: false, error: "Brak leadów do przypisania"}

	await prisma.campaignLead.createMany({
		data: leads.map((l) => ({campaignId, leadId: l.id})),
		skipDuplicates: true,
	})
	revalidatePath(`/kampanie/${campaignId}`)
	return {ok: true}
}
```

- [ ] **Step 3: Implement the campaign list page + form**

```tsx
// app/(app)/kampanie/campaign-form.tsx
"use client"

import {useActionState} from "react"
import {createCampaign, type CampaignResult} from "@/features/campaigns/actions"

export function CampaignForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<CampaignResult | null, FormData>(createCampaign, null)
	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-zinc-200 pb-4" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="name" placeholder="Nazwa kampanii" required />
			<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</select>
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Utwórz
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

```tsx
// app/(app)/kampanie/page.tsx
import Link from "next/link"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteCampaign} from "@/features/campaigns/actions"
import {CampaignForm} from "./campaign-form"

export default async function CampaignsPage() {
	const {orgId} = await requireOrg()
	const [campaigns, offeringLines] = await Promise.all([
		prisma.campaign.findMany({
			where: {organizationId: orgId},
			orderBy: {createdAt: "desc"},
			include: {_count: {select: {steps: true, campaignLeads: true}}},
		}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Kampanie</h1>
			<CampaignForm offeringLines={offeringLines} />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{campaigns.map((c) => (
					<li className="flex items-center justify-between py-2 text-sm" key={c.id}>
						<span>
							<Link className="text-blue-600 hover:underline" href={`/kampanie/${c.id}`}>
								{c.name}
							</Link>{" "}
							<span className="text-zinc-400">
								· {c.status} · {c._count.steps} kroków · {c._count.campaignLeads} leadów
							</span>
						</span>
						<form action={deleteCampaign.bind(null, c.id)}>
							<button className="text-red-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{campaigns.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak kampanii.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 4: Implement the campaign detail (sequence builder + lead assignment)**

```tsx
// app/(app)/kampanie/[id]/sequence-and-leads.tsx
"use client"

import {useActionState} from "react"
import {addSequenceStep, assignLeads, deleteSequenceStep, type StepResult} from "@/features/campaigns/actions"

interface Props {
	campaignId: string
	templates: {id: string; name: string}[]
	offeringLines: {id: string; name: string}[]
	steps: {id: string; order: number; delayDays: number; condition: string; templateName: string}[]
}

export function SequenceAndLeads({campaignId, templates, offeringLines, steps}: Props) {
	const [stepState, stepAction, stepPending] = useActionState<StepResult | null, FormData>(addSequenceStep, null)
	const [assignState, assignAction, assignPending] = useActionState<StepResult | null, FormData>(assignLeads, null)

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Sekwencja</h2>
				<ol className="mb-3 flex flex-col gap-1 text-sm">
					{steps.map((s) => (
						<li className="flex items-center justify-between border-b border-zinc-100 py-1" key={s.id}>
							<span>
								#{s.order + 1} · {s.templateName} · po {s.delayDays} dniach · {s.condition}
							</span>
							<form action={deleteSequenceStep.bind(null, s.id, campaignId)}>
								<button className="text-red-600" type="submit">
									Usuń
								</button>
							</form>
						</li>
					))}
					{steps.length === 0 ? <li className="py-1 text-zinc-500">Brak kroków.</li> : null}
				</ol>
				<form className="flex flex-wrap items-end gap-2" action={stepAction}>
					<input type="hidden" name="campaignId" value={campaignId} />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="templateId" defaultValue="">
						<option value="">— szablon —</option>
						{templates.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
					<input className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm" name="delayDays" type="number" min={0} defaultValue={0} placeholder="dni" />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="condition" defaultValue="SEND_IF_NO_REPLY">
						<option value="ALWAYS">ALWAYS</option>
						<option value="SEND_IF_NO_REPLY">SEND_IF_NO_REPLY</option>
					</select>
					<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={stepPending}>
						Dodaj krok
					</button>
					{stepState && !stepState.ok ? <span className="text-sm text-red-600">{stepState.error}</span> : null}
				</form>
			</div>

			<div>
				<h2 className="mb-2 text-sm font-semibold text-zinc-700">Przypisz leady</h2>
				<form className="flex flex-wrap items-end gap-2" action={assignAction}>
					<input type="hidden" name="campaignId" value={campaignId} />
					<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
						<option value="">— wszystkie leady —</option>
						{offeringLines.map((l) => (
							<option key={l.id} value={l.id}>
								{l.name}
							</option>
						))}
					</select>
					<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={assignPending}>
						Przypisz
					</button>
					{assignState ? (
						assignState.ok ? <span className="text-sm text-green-700">Przypisano.</span> : <span className="text-sm text-red-600">{assignState.error}</span>
					) : null}
				</form>
			</div>
		</div>
	)
}
```

```tsx
// app/(app)/kampanie/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {SequenceAndLeads} from "./sequence-and-leads"

export default async function CampaignDetailPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params

	const campaign = await prisma.campaign.findFirst({
		where: {id, organizationId: orgId},
		include: {
			steps: {orderBy: {order: "asc"}, include: {template: {select: {name: true}}}},
			_count: {select: {campaignLeads: true}},
		},
	})
	if (!campaign) notFound()

	const [templates, offeringLines] = await Promise.all([
		prisma.template.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<Link className="text-sm text-blue-600" href="/kampanie">
				← Kampanie
			</Link>
			<h1 className="text-lg font-semibold">
				{campaign.name} <span className="text-sm font-normal text-zinc-400">· {campaign.status} · {campaign._count.campaignLeads} leadów</span>
			</h1>
			<SequenceAndLeads
				campaignId={campaign.id}
				templates={templates}
				offeringLines={offeringLines}
				steps={campaign.steps.map((s) => ({
					id: s.id,
					order: s.order,
					delayDays: s.delayDays,
					condition: s.condition,
					templateName: s.template.name,
				}))}
			/>
		</section>
	)
}
```

- [ ] **Step 5: Add nav links**

In `app/(app)/layout.tsx`, extend the nav so it reads:

```tsx
				<nav className="flex gap-4 text-sm">
					<Link href="/leady">Leady</Link>
					<Link href="/linie">Linie usług</Link>
					<Link href="/szablony">Szablony</Link>
					<Link href="/placeholdery">Placeholdery</Link>
					<Link href="/kampanie">Kampanie</Link>
					<Link href="/suppression">Suppression</Link>
				</nav>
```

- [ ] **Step 6: Verify + commit**

Run `npx tsc --noEmit` (expect 0), `npx vitest run` (expect green), and `npm run build` (expect a clean production build). With dev + logged in: create a campaign, open it, add 2 sequence steps (pick templates, set delays/conditions), assign leads by line and by "wszystkie", confirm step + lead counts on `/kampanie`. Then:

```bash
git add features/campaigns "app/(app)/kampanie" "app/(app)/layout.tsx"
git commit -m "feat: campaigns, sequence builder and lead assignment"
```

---

## Definition of done (Phase 3)

- New models migrated; `tsc`, `vitest`, and a production `next build` are green.
- Custom placeholders: create/list/delete.
- `renderTemplate` resolves built-in, `{{zwrot}}`, custom (from `customFields` + fallback), and gendered `{{a|b}}` tokens, collecting unresolved ones — unit-tested.
- Templates: create/list/delete with a palette that inserts tokens at the cursor and a live preview against a sample lead with a missing-token report.
- Lead edit: standard fields + `honorific` + `customFields`, reachable from the leads table; values feed the template preview.
- Campaigns: create/list/delete; per-campaign sequence builder (ordered steps = template + delayDays + condition) and lead assignment (by offering line or all), with counts. No sending.
- Nav exposes Szablony / Placeholdery / Kampanie.

## Not in scope (Phase 4-5)

Mailbox connection, Gmail API sending, the Inngest sending engine and real schedule execution, reply detection / stop-on-reply, bounce + unsubscribe handling, tracking, import-column -> `customFields` mapping, and AI research populating placeholders.
