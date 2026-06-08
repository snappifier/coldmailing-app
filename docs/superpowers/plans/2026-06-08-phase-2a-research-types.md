# Phase 2a — Research-type config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an org-scoped `ResearchType` CRUD section at `/badania` (name + prompt + typed `outputFields` mapped to Lead columns + modelId + webSearchEnabled), data-entry only, mirroring the Placeholder stack.

**Architecture:** Pure mapping (`targets.ts`) + pure Zod (`schema.ts`) -> `use server` actions + queries -> server pages (list/new/edit) + a client card-editor form. `outputFields` is a flat `Json` array on the model; each field maps to an allow-listed Lead column (type derived/locked) or CUSTOM (user-picked type). No API, no Inngest.

**Tech Stack:** Next 16 (App Router, server actions), React 19 (`useActionState`/`useRouter`), Prisma 7 (`@/generated/prisma/client`), Zod 4, Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (line 2 after a directive), `className` first, no emoji.

Spec: `docs/superpowers/specs/2026-06-08-phase-2a-research-types-design.md`.

---

## File structure

- Create `features/research-types/targets.ts` — allow-list + derived types (pure).
- Create `features/research-types/targets.test.ts` — unit tests.
- Create `features/research-types/schema.ts` — Zod validation (pure; imports zod + targets).
- Create `features/research-types/schema.test.ts` — unit tests.
- Create `features/research-types/actions.ts` — `use server` create/update/delete.
- Create `features/research-types/queries.ts` — org-scoped reads.
- Modify `prisma/schema.prisma` — add `ResearchType` model + back-relations; migration `phase2a_research_types`.
- Create `app/(app)/badania/page.tsx` — list + delete.
- Create `app/(app)/badania/nowy/page.tsx` — create.
- Create `app/(app)/badania/[id]/page.tsx` — edit.
- Create `app/(app)/badania/research-type-form.tsx` — client editor.
- Modify `app/(app)/layout.tsx` — nav link.

---

### Task 1: Mapping module (targets.ts)

**Files:**
- Create: `features/research-types/targets.ts`
- Test: `features/research-types/targets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research-types/targets.test.ts
import {describe, it, expect} from "vitest"
import {derivedTypeForTarget, CUSTOM_TYPES, TARGET_OPTIONS} from "@/features/research-types/targets"

describe("targets", () => {
	it("derives the locked type from a known Lead target", () => {
		expect(derivedTypeForTarget("honorific")).toBe("GENDER")
		expect(derivedTypeForTarget("siteQuality")).toBe("NUMBER")
		expect(derivedTypeForTarget("contactPersonName")).toBe("TEXT")
		expect(derivedTypeForTarget("email")).toBe("EMAIL")
	})

	it("has no derived type for CUSTOM", () => {
		expect(derivedTypeForTarget("CUSTOM")).toBeNull()
	})

	it("exposes CUSTOM and all targets as options, and never offers GENDER as a CUSTOM type", () => {
		expect(TARGET_OPTIONS).toContain("CUSTOM")
		expect(TARGET_OPTIONS).toContain("honorific")
		expect((CUSTOM_TYPES as readonly string[]).includes("GENDER")).toBe(false)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research-types/targets.test.ts`
Expected: FAIL (cannot find module `targets`).

- [ ] **Step 3: Write minimal implementation**

```ts
// features/research-types/targets.ts

// Lead columns a research output field may write to; the value type is derived from the column.
export const LEAD_TARGETS = {
	contactPersonName: "TEXT",
	contactRole: "TEXT",
	honorific: "GENDER",
	aiHook: "TEXT",
	aiNotes: "TEXT",
	siteQuality: "NUMBER",
	priority: "NUMBER",
	city: "TEXT",
	region: "TEXT",
	schoolType: "TEXT",
	email: "EMAIL",
} as const

export type LeadTarget = keyof typeof LEAD_TARGETS
export type Target = LeadTarget | "CUSTOM"
export type FieldType = "TEXT" | "NUMBER" | "BOOLEAN" | "EMAIL" | "ENUM" | "GENDER"

// Types a CUSTOM (customFields[key]) output may use. GENDER is reserved for honorific only.
export const CUSTOM_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "EMAIL", "ENUM"] as const

// Builtin placeholder keys (features/templates/render.ts) a CUSTOM key must not shadow.
export const RESERVED_KEYS = new Set(["nazwaPlacowki", "osoba", "miasto", "www", "hookAI", "zwrot", "podpisNadawcy"])

export const TARGET_OPTIONS: Target[] = [...(Object.keys(LEAD_TARGETS) as LeadTarget[]), "CUSTOM"]

export function derivedTypeForTarget(target: Target): FieldType | null {
	if (target === "CUSTOM") return null
	return LEAD_TARGETS[target]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research-types/targets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research-types/targets.ts features/research-types/targets.test.ts
git commit -m "feat(phase2a): research-type Lead-target allow-list + derived types"
```

---

### Task 2: Validation (schema.ts)

**Files:**
- Create: `features/research-types/schema.ts`
- Test: `features/research-types/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research-types/schema.test.ts
import {describe, it, expect} from "vitest"
import {researchTypeSchema} from "@/features/research-types/schema"

const valid = {
	name: "Licea",
	prompt: "Znajdź dyrektora {{nazwaPlacowki}}",
	outputFields: [
		{key: "dyrektorImie", label: "Imię dyrektora", target: "contactPersonName", type: "TEXT", required: true},
		{key: "dyrektorPlec", label: "Płeć", target: "honorific", type: "GENDER", required: false},
		{key: "email", label: "Email", target: "email", type: "EMAIL", required: true},
		{key: "jakoscWww", label: "Jakość", target: "siteQuality", type: "NUMBER", required: false},
		{key: "sekretariatTel", label: "Tel", target: "CUSTOM", type: "TEXT", required: false},
	],
}

describe("researchTypeSchema", () => {
	it("accepts the example Licea type and applies defaults", () => {
		const r = researchTypeSchema.parse(valid)
		expect(r.modelId).toBeNull()
		expect(r.webSearchEnabled).toBe(false)
		expect(r.outputFields[0].description).toBeNull()
		expect(r.outputFields[1].required).toBe(false)
	})

	it("rejects zero output fields", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: []}).success).toBe(false)
	})

	it("rejects a bad key", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "zła nazwa", label: "x", target: "CUSTOM", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a reserved CUSTOM key", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "miasto", label: "x", target: "CUSTOM", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a forbidden target", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "ds", label: "x", target: "dealStage", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects a type mismatched with a known target", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "q", label: "x", target: "siteQuality", type: "TEXT"}]}).success).toBe(false)
	})

	it("rejects GENDER on a CUSTOM field", () => {
		expect(researchTypeSchema.safeParse({...valid, outputFields: [{key: "g", label: "x", target: "CUSTOM", type: "GENDER"}]}).success).toBe(false)
	})

	it("rejects duplicate keys", () => {
		const fields = [
			{key: "dup", label: "a", target: "aiHook", type: "TEXT"},
			{key: "dup", label: "b", target: "aiNotes", type: "TEXT"},
		]
		expect(researchTypeSchema.safeParse({...valid, outputFields: fields}).success).toBe(false)
	})

	it("rejects the same non-CUSTOM target used twice", () => {
		const fields = [
			{key: "a", label: "a", target: "aiHook", type: "TEXT"},
			{key: "b", label: "b", target: "aiHook", type: "TEXT"},
		]
		expect(researchTypeSchema.safeParse({...valid, outputFields: fields}).success).toBe(false)
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research-types/schema.test.ts`
Expected: FAIL (cannot find module `schema`).

- [ ] **Step 3: Write minimal implementation**

```ts
// features/research-types/schema.ts
import {z} from "zod"
import {CUSTOM_TYPES, RESERVED_KEYS, TARGET_OPTIONS, derivedTypeForTarget, type Target} from "@/features/research-types/targets"

const FIELD_TYPES = ["TEXT", "NUMBER", "BOOLEAN", "EMAIL", "ENUM", "GENDER"] as const

const outputFieldSchema = z
	.object({
		key: z
			.string()
			.trim()
			.min(1, "Podaj klucz pola")
			.max(40)
			.regex(/^[A-Za-z][A-Za-z0-9]*$/, "Klucz: litery i cyfry, bez spacji, zaczyna się literą"),
		label: z.string().trim().min(1, "Podaj etykietę pola").max(80),
		target: z.enum(TARGET_OPTIONS as [string, ...string[]]),
		type: z.enum(FIELD_TYPES),
		required: z.boolean().default(false),
		description: z
			.string()
			.trim()
			.max(300)
			.optional()
			.transform((v) => (v ? v : null)),
	})
	.refine((f) => f.target !== "CUSTOM" || !RESERVED_KEYS.has(f.key), {
		message: "Ten klucz jest zarezerwowany (wbudowany placeholder)",
		path: ["key"],
	})
	.refine(
		(f) => {
			if (f.target === "CUSTOM") return (CUSTOM_TYPES as readonly string[]).includes(f.type)
			return f.type === derivedTypeForTarget(f.target as Target)
		},
		{message: "Typ pola nie zgadza się z wybranym celem", path: ["type"]},
	)

export const researchTypeSchema = z
	.object({
		name: z.string().trim().min(1, "Podaj nazwę").max(120),
		prompt: z.string().trim().min(1, "Podaj prompt").max(8000),
		modelId: z
			.string()
			.trim()
			.max(80)
			.optional()
			.transform((v) => (v ? v : null)),
		webSearchEnabled: z.boolean().default(false),
		outputFields: z.array(outputFieldSchema).min(1, "Dodaj co najmniej jedno pole wyjściowe"),
	})
	.refine((d) => new Set(d.outputFields.map((f) => f.key)).size === d.outputFields.length, {
		message: "Klucze pól muszą być unikalne",
		path: ["outputFields"],
	})
	.refine(
		(d) => {
			const targets = d.outputFields.filter((f) => f.target !== "CUSTOM").map((f) => f.target)
			return new Set(targets).size === targets.length
		},
		{message: "Każde pole Lead można zmapować tylko raz", path: ["outputFields"]},
	)

export type OutputField = z.infer<typeof outputFieldSchema>
export type ResearchTypeInput = z.infer<typeof researchTypeSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research-types/schema.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research-types/schema.ts features/research-types/schema.test.ts
git commit -m "feat(phase2a): research-type Zod validation (outputFields contract)"
```

---

### Task 3: Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (Organization relations ~line 124, User relations ~line 145, new model after Placeholder ~line 301)

- [ ] **Step 1: Add the model + back-relations**

In `model Organization { ... }` add to the relation block:

```prisma
	researchTypes ResearchType[]
```

In `model User { ... }` add to the relation block:

```prisma
	researchTypes ResearchType[] @relation("ResearchTypeCreatedBy")
```

After `model Placeholder { ... }` add:

```prisma
model ResearchType {
	id               String   @id @default(cuid())
	organizationId   String
	name             String
	prompt           String
	outputFields     Json
	modelId          String?
	webSearchEnabled Boolean  @default(false)
	createdById      String?
	createdAt        DateTime @default(now())
	updatedAt        DateTime @updatedAt

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	createdBy    User?        @relation("ResearchTypeCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@unique([organizationId, name])
}
```

- [ ] **Step 2: Create + apply the migration (regenerates the client)**

If the dev server is running and Windows locks `generated/prisma`, stop it first.

Run: `npx prisma migrate dev --name phase2a_research_types`
Expected: migration `..._phase2a_research_types` created + applied; client regenerated; "in sync".

- [ ] **Step 3: Verify types still compile**

Run: `npx tsc --noEmit`
Expected: 0 errors (new model present on the client).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase2a): ResearchType model + migration phase2a_research_types"
```

---

### Task 4: Actions + queries

**Files:**
- Create: `features/research-types/actions.ts`
- Create: `features/research-types/queries.ts`

- [ ] **Step 1: Write the queries**

```ts
// features/research-types/queries.ts
import {prisma} from "@/lib/prisma"

export function listResearchTypes(orgId: string) {
	return prisma.researchType.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}})
}

export function getResearchType(orgId: string, id: string) {
	return prisma.researchType.findFirst({where: {id, organizationId: orgId}})
}
```

- [ ] **Step 2: Write the actions**

```ts
"use server"
// features/research-types/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {researchTypeSchema} from "@/features/research-types/schema"

export type ResearchTypeResult = {ok: true} | {ok: false; error: string}

function parseForm(formData: FormData) {
	let outputFields: unknown = []
	try {
		outputFields = JSON.parse(String(formData.get("outputFields") ?? "[]"))
	} catch {
		outputFields = null
	}
	return researchTypeSchema.safeParse({
		name: formData.get("name") ?? "",
		prompt: formData.get("prompt") ?? "",
		modelId: formData.get("modelId") ?? undefined,
		webSearchEnabled: formData.get("webSearchEnabled") === "true",
		outputFields,
	})
}

export async function createResearchType(_prev: ResearchTypeResult | null, formData: FormData): Promise<ResearchTypeResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = parseForm(formData)
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.researchType.create({
			data: {
				organizationId: orgId,
				createdById: userId,
				name: parsed.data.name,
				prompt: parsed.data.prompt,
				modelId: parsed.data.modelId,
				webSearchEnabled: parsed.data.webSearchEnabled,
				outputFields: parsed.data.outputFields,
			},
		})
	} catch {
		return {ok: false, error: "Typ researchu o tej nazwie już istnieje"}
	}
	revalidatePath("/badania")
	return {ok: true}
}

export async function updateResearchType(id: string, _prev: ResearchTypeResult | null, formData: FormData): Promise<ResearchTypeResult> {
	const {orgId} = await requireOrg()
	const parsed = parseForm(formData)
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.researchType.updateMany({
			where: {id, organizationId: orgId},
			data: {
				name: parsed.data.name,
				prompt: parsed.data.prompt,
				modelId: parsed.data.modelId,
				webSearchEnabled: parsed.data.webSearchEnabled,
				outputFields: parsed.data.outputFields,
			},
		})
	} catch {
		return {ok: false, error: "Typ researchu o tej nazwie już istnieje"}
	}
	revalidatePath("/badania")
	return {ok: true}
}

export async function deleteResearchType(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.researchType.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/badania")
}
```

Note: if `tsc` flags `outputFields` (Prisma `Json` input), cast to `Prisma.InputJsonValue` (import `{Prisma}` from `@/generated/prisma/client`).

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add features/research-types/actions.ts features/research-types/queries.ts
git commit -m "feat(phase2a): research-type actions (create/update/delete) + queries"
```

---

### Task 5: Pages + nav link

**Files:**
- Create: `app/(app)/badania/page.tsx`
- Create: `app/(app)/badania/nowy/page.tsx`
- Create: `app/(app)/badania/[id]/page.tsx`
- Modify: `app/(app)/layout.tsx` (nav, after the Placeholdery link)

- [ ] **Step 1: List page**

```tsx
// app/(app)/badania/page.tsx
import Link from "next/link"
import {requireOrg} from "@/lib/org"
import {listResearchTypes} from "@/features/research-types/queries"
import {deleteResearchType} from "@/features/research-types/actions"

export default async function ResearchTypesPage() {
	const {orgId} = await requireOrg()
	const types = await listResearchTypes(orgId)

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">Badania</h1>
				<Link className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white" href="/badania/nowy">
					Nowy typ
				</Link>
			</div>
			<p className="text-sm text-zinc-600">
				Typy researchu definiują prompt i pola wyjściowe mapowane na pola leada. Silnik (Faza 2b) uruchomi je per lead.
			</p>
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{types.map((t) => {
					const count = Array.isArray(t.outputFields) ? t.outputFields.length : 0
					return (
						<li className="flex items-center justify-between py-2 text-sm" key={t.id}>
							<span>
								<Link className="font-medium underline" href={`/badania/${t.id}`}>
									{t.name}
								</Link>{" "}
								<span className="text-zinc-400">
									({count} pól{t.webSearchEnabled ? ", web" : ""}
									{t.modelId ? `, ${t.modelId}` : ""})
								</span>
							</span>
							<form action={deleteResearchType.bind(null, t.id)}>
								<button className="text-red-600" type="submit">
									Usuń
								</button>
							</form>
						</li>
					)
				})}
				{types.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak typów researchu.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 2: New page**

```tsx
// app/(app)/badania/nowy/page.tsx
import {createResearchType} from "@/features/research-types/actions"
import {ResearchTypeForm} from "../research-type-form"

export default function NewResearchTypePage() {
	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Nowy typ researchu</h1>
			<ResearchTypeForm action={createResearchType} />
		</section>
	)
}
```

- [ ] **Step 3: Edit page**

```tsx
// app/(app)/badania/[id]/page.tsx
import {notFound} from "next/navigation"
import {requireOrg} from "@/lib/org"
import {getResearchType} from "@/features/research-types/queries"
import {updateResearchType} from "@/features/research-types/actions"
import {ResearchTypeForm} from "../research-type-form"
import type {OutputField} from "@/features/research-types/schema"

export default async function EditResearchTypePage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const type = await getResearchType(orgId, id)
	if (!type) notFound()

	const initial = {
		name: type.name,
		prompt: type.prompt,
		modelId: type.modelId ?? "",
		webSearchEnabled: type.webSearchEnabled,
		outputFields: (type.outputFields as OutputField[]) ?? [],
	}

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Edytuj typ researchu</h1>
			<ResearchTypeForm action={updateResearchType.bind(null, id)} initial={initial} />
		</section>
	)
}
```

- [ ] **Step 4: Nav link** — in `app/(app)/layout.tsx`, after the Placeholdery `<Link>`:

```tsx
						<Link href="/badania">Badania</Link>
```

- [ ] **Step 5: Commit** (after Task 6 compiles; the form is needed for these pages to typecheck).

---

### Task 6: Client editor form

**Files:**
- Create: `app/(app)/badania/research-type-form.tsx`

- [ ] **Step 1: Write the form**

```tsx
"use client"
// app/(app)/badania/research-type-form.tsx

import {useActionState, useEffect, useState} from "react"
import {useRouter} from "next/navigation"
import type {ResearchTypeResult} from "@/features/research-types/actions"
import {CUSTOM_TYPES, TARGET_OPTIONS, derivedTypeForTarget, type FieldType, type Target} from "@/features/research-types/targets"
import type {OutputField} from "@/features/research-types/schema"

const MODEL_OPTIONS = ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-8"]

type Action = (prev: ResearchTypeResult | null, formData: FormData) => Promise<ResearchTypeResult>

interface Initial {
	name: string
	prompt: string
	modelId: string
	webSearchEnabled: boolean
	outputFields: OutputField[]
}

const EMPTY_FIELD: OutputField = {key: "", label: "", target: "CUSTOM", type: "TEXT", required: false, description: null}

export function ResearchTypeForm({action, initial}: {action: Action; initial?: Initial}) {
	const router = useRouter()
	const [state, formAction, pending] = useActionState<ResearchTypeResult | null, FormData>(action, null)
	const [fields, setFields] = useState<OutputField[]>(initial?.outputFields?.length ? initial.outputFields : [{...EMPTY_FIELD}])

	useEffect(() => {
		if (state?.ok) router.push("/badania")
	}, [state, router])

	function update(i: number, patch: Partial<OutputField>) {
		setFields((prev) => prev.map((f, idx) => (idx === i ? {...f, ...patch} : f)))
	}
	function setTarget(i: number, target: Target) {
		const derived = derivedTypeForTarget(target)
		update(i, {target, type: derived ?? "TEXT"})
	}
	function addField() {
		setFields((prev) => [...prev, {...EMPTY_FIELD}])
	}
	function removeField(i: number) {
		setFields((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))
	}

	return (
		<form className="flex max-w-3xl flex-col gap-4" action={formAction}>
			<input name="outputFields" type="hidden" value={JSON.stringify(fields)} />

			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium">Nazwa</span>
				<input className="rounded border border-zinc-300 px-2 py-1" name="name" defaultValue={initial?.name ?? ""} required />
			</label>

			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium">Prompt researchu</span>
				<textarea className="min-h-32 rounded border border-zinc-300 px-2 py-1 font-mono text-xs" name="prompt" defaultValue={initial?.prompt ?? ""} required />
				<span className="text-xs text-zinc-500">Tokeny jak {"{{nazwaPlacowki}}"}, {"{{miasto}}"}, {"{{www}}"} renderują się per lead w Fazie 2b.</span>
			</label>

			<div className="flex flex-wrap items-end gap-4">
				<label className="flex flex-col gap-1 text-sm">
					<span className="font-medium">Model</span>
					<select className="rounded border border-zinc-300 px-2 py-1" name="modelId" defaultValue={initial?.modelId ?? ""}>
						<option value="">(domyślny)</option>
						{MODEL_OPTIONS.map((m) => (
							<option key={m} value={m}>
								{m}
							</option>
						))}
					</select>
				</label>
				<label className="flex items-center gap-2 text-sm">
					<input name="webSearchEnabled" type="checkbox" value="true" defaultChecked={initial?.webSearchEnabled ?? false} />
					<span>Web search włączony</span>
				</label>
			</div>

			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium">Pola wyjściowe</span>
				{fields.map((f, i) => {
					const locked = f.target !== "CUSTOM"
					return (
						<div className="flex flex-col gap-2 rounded border border-zinc-300 p-3" key={i}>
							<div className="flex flex-wrap items-end gap-2 text-sm">
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Etykieta</span>
									<input className="rounded border border-zinc-300 px-2 py-1" value={f.label} placeholder="Imię dyrektora" onChange={(e) => update(i, {label: e.target.value})} />
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Klucz</span>
									<input className="rounded border border-zinc-300 px-2 py-1" value={f.key} placeholder="dyrektorImie" onChange={(e) => update(i, {key: e.target.value})} />
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Cel</span>
									<select className="rounded border border-zinc-300 px-2 py-1" value={f.target} onChange={(e) => setTarget(i, e.target.value as Target)}>
										{TARGET_OPTIONS.map((t) => (
											<option key={t} value={t}>
												{t}
											</option>
										))}
									</select>
								</label>
								<label className="flex flex-col gap-1">
									<span className="text-xs text-zinc-500">Typ</span>
									{locked ? (
										<span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-zinc-500">{f.type}</span>
									) : (
										<select className="rounded border border-zinc-300 px-2 py-1" value={f.type} onChange={(e) => update(i, {type: e.target.value as FieldType})}>
											{CUSTOM_TYPES.map((t) => (
												<option key={t} value={t}>
													{t}
												</option>
											))}
										</select>
									)}
								</label>
								<label className="flex items-center gap-1">
									<input type="checkbox" checked={f.required} onChange={(e) => update(i, {required: e.target.checked})} />
									<span className="text-xs text-zinc-500">wymagane</span>
								</label>
								<button className="ml-auto text-red-600" type="button" onClick={() => removeField(i)}>
									Usuń
								</button>
							</div>
							<label className="flex flex-col gap-1 text-sm">
								<span className="text-xs text-zinc-500">Opis dla AI (opcjonalnie)</span>
								<input className="rounded border border-zinc-300 px-2 py-1" value={f.description ?? ""} placeholder="np. rozpoznaj płeć po imieniu" onChange={(e) => update(i, {description: e.target.value || null})} />
							</label>
						</div>
					)
				})}
				<button className="self-start rounded border border-dashed border-zinc-400 px-3 py-1.5 text-sm" type="button" onClick={addField}>
					+ Dodaj pole
				</button>
			</div>

			<div className="flex items-center gap-3">
				<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
					Zapisz
				</button>
				{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
			</div>
		</form>
	)
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit** (pages + form + nav together)

```bash
git add app/\(app\)/badania app/\(app\)/layout.tsx
git commit -m "feat(phase2a): /badania pages (list/new/edit) + card editor + nav link"
```

---

### Task 7: Verification + adversarial review

- [ ] **Step 1: Full gates**

Run: `npx tsc --noEmit` -> 0
Run: `npx vitest run` -> green (prior 99 + ~12 new)
Run (dev server OFF): `npx next build` -> green; route list includes `/badania`, `/badania/nowy`, `/badania/[id]`.

- [ ] **Step 2: Adversarial review** — dispatch reviewers across dimensions (org-scoping on every read/write, spec conformance, convention conformance incl. tabs/no-semicolons/className-first/no-emoji, correctness of the outputFields contract + form serialization). Fix confirmed findings, re-run gates.

- [ ] **Step 3: graphify + ROADMAP**

```bash
graphify update .
```

Update `docs/superpowers/ROADMAP.md`: mark 2a DONE, set next = 2b. Re-run `graphify . --obsidian` (doc change).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(phase2a): graphify update + roadmap (2a done, 2b next)"
```

---

## Self-review

- **Spec coverage:** model (Task 3), targets allow-list (Task 1), Zod contract incl. all refines (Task 2), actions+queries (Task 4), pages+nav (Task 5), form variant B (Task 6), tests + gates (Tasks 1/2/7). All spec sections covered.
- **Placeholder scan:** no TBD/TODO; every code step has full code.
- **Type consistency:** `OutputField`/`Target`/`FieldType` defined in Tasks 1-2 and used consistently in Tasks 4-6; `ResearchTypeResult` defined in Task 4, consumed in Task 6; action signatures `(prev, formData)` and bound `(id, prev, formData)` match `useActionState` usage.
