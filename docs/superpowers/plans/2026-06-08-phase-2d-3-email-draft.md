# Phase 2d-3 — Per-lead AI Email Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate, store, and edit a full personalized email draft (subject + body) per lead, configured as a `kind = DRAFT` research-type variant, reusing the existing `runResearch` engine; no change to sending (deferred to 2d-4).

**Architecture:** New `LeadDraft` model (one per lead, with its own status). `ResearchTypeKind += DRAFT`. A new isolated `runDraftFn` Inngest function calls the SAME `runResearch` with a fixed `{subject, body}` schema (plus a copywriting `system` override — the only engine change) and upserts `LeadDraft`. A lead-card panel triggers generation, polls, and edits. Nothing touches `runResearchFn`, the batch orchestrator, or the sending worker.

**Tech Stack:** Next 16 (server actions), Prisma 7 (`@/generated/prisma/client`), Inngest v4, Anthropic SDK, Zod 4, Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (line 2 after a directive), `className` first, `import {x}` no inner spaces, NO emoji, Polish UI strings, org-scoped via `requireOrg()`. NOTE: existing files have mixed CRLF/LF — prefer newline-free, accent-free Edit anchors; rewrite a whole file if special-char matching fails.

---

## File Structure

- Modify: `prisma/schema.prisma` — `DraftStatus` enum, `LeadDraft` model, `ResearchTypeKind += DRAFT`, back-relations.
- Create: `features/research/draft.ts` — pure `buildDraftSchema` + `coerceDraft`.
- Modify: `features/research/engine.ts` — optional `system` param on `runResearch`.
- Modify: `features/research-types/schema.ts` — `kind += DRAFT`, relax `outputFields` (not required for DRAFT).
- Create: `features/research/draft-actions.ts` — `startDraft` / `getDraft` / `saveDraft`.
- Create: `lib/inngest/draft.ts` — `runDraftFn`.
- Modify: `app/api/inngest/route.ts` — register `runDraftFn`.
- Create: `app/(app)/leady/[id]/draft-panel.tsx` — generate/poll/edit panel.
- Modify: `app/(app)/leady/[id]/page.tsx` — fetch draft + DRAFT types, render panel, split picker types.
- Modify: `app/(app)/leady/page.tsx` — exclude DRAFT from the batch launcher.
- Modify: `app/(app)/badania/research-type-form.tsx` — DRAFT option, hide output fields for DRAFT, union.
- Modify: `app/(app)/badania/page.tsx` — "Draft" badge.
- Tests: `features/research/draft.test.ts` (new); `features/research-types/schema.test.ts`.

---

## Task 1: Migration + kind unions

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/(app)/badania/research-type-form.tsx`, `app/(app)/leady/[id]/uruchom-research.tsx`, `app/(app)/leady/batch-research-launcher.tsx` (widen `kind` unions so tsc stays green after the enum grows)

- [ ] **Step 1: Add the `DraftStatus` enum + `LeadDraft` model + `DRAFT` kind**

In `prisma/schema.prisma`, add `CONTENT`-sibling value to the kind enum:

```prisma
enum ResearchTypeKind {
	RESEARCH
	SCORING
	CONTENT
	DRAFT
}
```

Add near the other enums:

```prisma
enum DraftStatus {
	QUEUED
	RUNNING
	DONE
	FAILED
}
```

Add the model (after `model ResearchBatch { ... }` or near the research models):

```prisma
model LeadDraft {
	id             String      @id @default(cuid())
	organizationId String
	leadId         String
	subject        String      @default("")
	body           String      @default("")
	status         DraftStatus @default(QUEUED)
	error          String?
	sourceTypeId   String?
	sourceTypeName String
	createdById    String?
	createdAt      DateTime    @default(now())
	updatedAt      DateTime    @updatedAt

	organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	lead         Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
	sourceType   ResearchType? @relation(fields: [sourceTypeId], references: [id], onDelete: SetNull)
	createdBy    User?         @relation("LeadDraftCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@unique([organizationId, leadId])
	@@index([organizationId, leadId])
}
```

- [ ] **Step 2: Add the back-relations**

In `model Organization`, after `researchBatches ResearchBatch[]`:

```prisma
	leadDrafts     LeadDraft[]
```

In `model User`, after `researchBatches ResearchBatch[] @relation("ResearchBatchCreatedBy")`:

```prisma
	leadDrafts LeadDraft[] @relation("LeadDraftCreatedBy")
```

In `model Lead`, after `researchRuns  ResearchRun[]`:

```prisma
	drafts        LeadDraft[]
```

In `model ResearchType`, after `batches      ResearchBatch[]`:

```prisma
	drafts       LeadDraft[]
```

- [ ] **Step 3: Create + apply the migration (protect Neon data — see prisma7 memory)**

Run: `npx prisma migrate dev --name phase2d3_drafts --create-only`
Then read `prisma/migrations/*phase2d3_drafts/migration.sql`
Expected: additive — `ALTER TYPE "ResearchTypeKind" ADD VALUE 'DRAFT'`, `CREATE TYPE "DraftStatus"`, `CREATE TABLE "LeadDraft"`, indexes, FKs. No DROP.

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: applied, client regenerated.

- [ ] **Step 4: Widen the `kind` unions (keep tsc green after the enum grew)**

In `app/(app)/badania/research-type-form.tsx`, `app/(app)/leady/[id]/uruchom-research.tsx`, and `app/(app)/leady/batch-research-launcher.tsx`, change each `kind: "RESEARCH" | "SCORING" | "CONTENT"` to:

```ts
	kind: "RESEARCH" | "SCORING" | "CONTENT" | "DRAFT"
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations "app/(app)/badania/research-type-form.tsx" "app/(app)/leady/[id]/uruchom-research.tsx" "app/(app)/leady/batch-research-launcher.tsx"
git commit -m "feat(phase2d-3): LeadDraft model + DraftStatus + DRAFT kind"
```

---

## Task 2: Pure `draft.ts`

**Files:**
- Create: `features/research/draft.ts`
- Test: `features/research/draft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/draft.test.ts
import {describe, it, expect} from "vitest"
import {buildDraftSchema, coerceDraft} from "@/features/research/draft"

describe("buildDraftSchema", () => {
	it("requires subject and body, no extra props", () => {
		const s = buildDraftSchema()
		expect(s.required).toEqual(["subject", "body"])
		expect(s.additionalProperties).toBe(false)
		expect(s.properties.subject.type).toBe("string")
		expect(s.properties.body.type).toBe("string")
	})
})

describe("coerceDraft", () => {
	it("trims and accepts a valid draft", () => {
		expect(coerceDraft({subject: " Cześć ", body: " Treść maila ", extra: 1})).toEqual({ok: true, subject: "Cześć", body: "Treść maila"})
	})

	it("rejects empty or whitespace subject/body", () => {
		expect(coerceDraft({subject: "", body: "x"})).toEqual({ok: false})
		expect(coerceDraft({subject: "x", body: "   "})).toEqual({ok: false})
		expect(coerceDraft({subject: 5, body: "x"})).toEqual({ok: false})
		expect(coerceDraft({})).toEqual({ok: false})
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/draft.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// features/research/draft.ts
export interface DraftSchema {
	type: "object"
	additionalProperties: false
	properties: {subject: {type: "string"}; body: {type: "string"}}
	required: ["subject", "body"]
}

export function buildDraftSchema(): DraftSchema {
	return {type: "object", additionalProperties: false, properties: {subject: {type: "string"}, body: {type: "string"}}, required: ["subject", "body"]}
}

export function coerceDraft(findings: Record<string, unknown>): {ok: true; subject: string; body: string} | {ok: false} {
	const subject = typeof findings.subject === "string" ? findings.subject.trim() : ""
	const body = typeof findings.body === "string" ? findings.body.trim() : ""
	if (!subject || !body) return {ok: false}
	return {ok: true, subject, body}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/draft.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research/draft.ts features/research/draft.test.ts
git commit -m "feat(phase2d-3): pure buildDraftSchema + coerceDraft"
```

---

## Task 3: Optional `system` override on `runResearch`

**Files:**
- Modify: `features/research/engine.ts`

- [ ] **Step 1: Add `system` to `RunArgs`**

In `features/research/engine.ts`, add to the `RunArgs` interface (after `webSearchEnabled: boolean`):

```ts
	system?: string
```

- [ ] **Step 2: Use the override (default = existing SYSTEM)**

Change the function signature destructuring:

```ts
export async function runResearch({renderedPrompt, inputSchema, modelId, webSearchEnabled, system}: RunArgs): Promise<EngineResult> {
```

In the `client.messages.create({...})` call, change `system: SYSTEM,` to:

```ts
				system: system ?? SYSTEM,
```

(Existing callers omit `system` -> unchanged behavior.)

- [ ] **Step 3: Typecheck + re-run engine-adjacent tests**

Run: `npx tsc --noEmit && npx vitest run features/research/apply.test.ts features/research/lead-context.test.ts`
Expected: tsc 0; tests pass.

- [ ] **Step 4: Commit**

```bash
git add features/research/engine.ts
git commit -m "feat(phase2d-3): optional system override on runResearch (default unchanged)"
```

---

## Task 4: `kind += DRAFT` + relax outputFields

**Files:**
- Modify: `features/research-types/schema.ts`
- Test: `features/research-types/schema.test.ts`

- [ ] **Step 1: Extend the kind enum**

In `features/research-types/schema.ts`, change the `kind` line:

```ts
		kind: z.enum(["RESEARCH", "SCORING", "CONTENT", "DRAFT"]).default("RESEARCH"),
```

- [ ] **Step 2: Make `outputFields` not required, gate the requirement on kind**

Change the `outputFields` line in the base object:

```ts
		outputFields: z.array(outputFieldSchema).default([]),
```

Add a refine (place it as the first `.refine` after the `z.object({...})`, before the unique-keys refine):

```ts
	.refine((d) => d.kind === "DRAFT" || d.outputFields.length >= 1, {
		message: "Dodaj co najmniej jedno pole wyjściowe",
		path: ["outputFields"],
	})
```

- [ ] **Step 3: Add schema tests**

In `features/research-types/schema.test.ts`, add:

```ts
	it("accepts a DRAFT type with no output fields", () => {
		expect(researchTypeSchema.safeParse({name: "Mail", prompt: "napisz maila", kind: "DRAFT", outputFields: []}).success).toBe(true)
	})

	it("rejects a non-DRAFT type with no output fields", () => {
		expect(researchTypeSchema.safeParse({name: "X", prompt: "p", kind: "RESEARCH", outputFields: []}).success).toBe(false)
	})
```

- [ ] **Step 4: Run the schema test + full suite (shared schema change)**

Run: `npx vitest run features/research-types/schema.test.ts && npx tsc --noEmit`
Expected: schema tests pass; tsc 0.

- [ ] **Step 5: Commit**

```bash
git add features/research-types/schema.ts features/research-types/schema.test.ts
git commit -m "feat(phase2d-3): DRAFT kind + outputFields optional for DRAFT"
```

---

## Task 5: Draft actions

**Files:**
- Create: `features/research/draft-actions.ts`

- [ ] **Step 1: Implement the actions**

```ts
"use server"
// features/research/draft-actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"

export type StartDraftResult = {ok: true; draftId: string} | {ok: false; error: string}
export type SaveDraftResult = {ok: true} | {ok: false; error: string}

export async function startDraft(leadId: string, draftTypeId: string): Promise<StartDraftResult> {
	const {orgId, userId} = await requireOrg()
	const [lead, type] = await Promise.all([
		prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}}),
		prisma.researchType.findFirst({where: {id: draftTypeId, organizationId: orgId}, select: {id: true, name: true, kind: true}}),
	])
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	if (!type || type.kind !== "DRAFT") return {ok: false, error: "Nieprawidłowy typ draftu"}

	const draft = await prisma.leadDraft.upsert({
		where: {organizationId_leadId: {organizationId: orgId, leadId}},
		create: {organizationId: orgId, leadId, status: "QUEUED", sourceTypeId: type.id, sourceTypeName: type.name, createdById: userId},
		update: {status: "QUEUED", error: null, sourceTypeId: type.id, sourceTypeName: type.name, createdById: userId},
	})
	await inngest.send({name: "research/draft.requested", data: {draftId: draft.id, organizationId: orgId}})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true, draftId: draft.id}
}

export async function getDraft(leadId: string) {
	const {orgId} = await requireOrg()
	return prisma.leadDraft.findFirst({where: {organizationId: orgId, leadId}})
}

export async function saveDraft(leadId: string, subject: string, body: string): Promise<SaveDraftResult> {
	const {orgId, userId} = await requireOrg()
	const lead = await prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	await prisma.leadDraft.upsert({
		where: {organizationId_leadId: {organizationId: orgId, leadId}},
		create: {organizationId: orgId, leadId, subject: subject.trim(), body: body.trim(), status: "DONE", sourceTypeName: "(ręczny)", createdById: userId},
		update: {subject: subject.trim(), body: body.trim(), status: "DONE", error: null},
	})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true}
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/research/draft-actions.ts
git commit -m "feat(phase2d-3): draft actions (start/get/save)"
```

---

## Task 6: `runDraftFn` orchestration

**Files:**
- Create: `lib/inngest/draft.ts`
- Modify: `app/api/inngest/route.ts`

- [ ] **Step 1: Implement `runDraftFn`**

```ts
// lib/inngest/draft.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"
import {buildLeadContextBlock} from "@/features/research/lead-context"
import {buildDraftSchema, coerceDraft} from "@/features/research/draft"
import {runResearch} from "@/features/research/engine"

const DRAFT_SYSTEM =
	"Jesteś copywriterem B2B. Na podstawie instrukcji i danych leada napisz zwięzłego, spersonalizowanego maila: temat i treść. Pisz po polsku, naturalnie i konkretnie; nie zmyślaj faktów. Zwróć wynik przez narzędzie (pola subject, body)."

export const runDraftFn = inngest.createFunction(
	{
		id: "run-draft",
		triggers: {event: "research/draft.requested"},
		concurrency: {limit: 3, key: "event.data.organizationId"},
		retries: 3,
		onFailure: async ({event, error}: {event: {data: {event: {data: {draftId?: string}}}}; error: unknown}) => {
			const draftId = event.data.event.data.draftId
			if (!draftId) return
			await prisma.leadDraft.updateMany({where: {id: draftId, status: {notIn: ["DONE", "FAILED"]}}, data: {status: "FAILED", error: String(error).slice(0, 500)}})
		},
	},
	async ({event, step}) => {
		const {draftId, organizationId} = event.data as {draftId: string; organizationId: string}
		const draft = await prisma.leadDraft.findFirst({where: {id: draftId, organizationId}, include: {lead: true, sourceType: true}})
		if (!draft) return {skipped: true}
		if (!draft.lead || !draft.sourceType || draft.sourceType.kind !== "DRAFT" || draft.lead.organizationId !== draft.organizationId) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: "Brak typu/leada lub niezgodność", }})
			return {skipped: true}
		}
		const lead = draft.lead
		const type = draft.sourceType
		await step.run("mark-running", () => prisma.leadDraft.update({where: {id: draftId}, data: {status: "RUNNING"}}))

		const placeholders = await prisma.placeholder.findMany({where: {organizationId: draft.organizationId}, select: {key: true, source: true, fallback: true}})

		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			const base = buildResearchPrompt(type.prompt, ctx)
			const block = buildLeadContextBlock(lead)
			const renderedPrompt = block ? `${base}\n\n${block}` : base
			return runResearch({renderedPrompt, inputSchema: buildDraftSchema(), modelId: type.modelId, webSearchEnabled: type.webSearchEnabled, system: DRAFT_SYSTEM})
		})

		if (!result.ok) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: result.error}})
			return {ok: false}
		}
		const out = coerceDraft(result.findings)
		if (!out.ok) {
			await prisma.leadDraft.update({where: {id: draftId}, data: {status: "FAILED", error: "Model nie zwrócił poprawnego draftu (subject/body)"}})
			return {ok: false}
		}
		await step.run("save", () => prisma.leadDraft.update({where: {id: draftId}, data: {subject: out.subject, body: out.body, status: "DONE", error: null}}))
		return {ok: true}
	},
)
```

- [ ] **Step 2: Register the function**

In `app/api/inngest/route.ts`, add the import + include it in the `functions` array:

```ts
import {runResearchBatchFn} from "@/lib/inngest/research-batch"
import {runDraftFn} from "@/lib/inngest/draft"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld, runLeadSequence, scanMailboxesForReplies, pollMailboxReplies, runResearchFn, runResearchBatchFn, runDraftFn]})
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add lib/inngest/draft.ts app/api/inngest/route.ts
git commit -m "feat(phase2d-3): runDraftFn (reuses runResearch with a draft schema) + register"
```

---

## Task 7: UI — draft panel + config + filtering

**Files:**
- Create: `app/(app)/leady/[id]/draft-panel.tsx`
- Modify: `app/(app)/leady/[id]/page.tsx`
- Modify: `app/(app)/leady/page.tsx`
- Modify: `app/(app)/badania/research-type-form.tsx`
- Modify: `app/(app)/badania/page.tsx`

- [ ] **Step 1: Create the draft panel**

```tsx
"use client"
// app/(app)/leady/[id]/draft-panel.tsx

import {useEffect, useRef, useState} from "react"
import {startDraft, getDraft, saveDraft} from "@/features/research/draft-actions"

interface TypeOption {
	id: string
	name: string
}
interface DraftView {
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
	subject: string
	body: string
	error: string | null
}

export function DraftPanel({leadId, types, initial}: {leadId: string; types: TypeOption[]; initial: DraftView | null}) {
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [draft, setDraft] = useState<DraftView | null>(initial)
	const [subject, setSubject] = useState(initial?.subject ?? "")
	const [body, setBody] = useState(initial?.body ?? "")
	const [busy, setBusy] = useState(false)
	const [msg, setMsg] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(
		() => () => {
			if (timer.current) clearInterval(timer.current)
		},
		[],
	)

	function poll() {
		if (timer.current) clearInterval(timer.current)
		timer.current = setInterval(async () => {
			const d = await getDraft(leadId)
			if (!d) return
			const view: DraftView = {status: d.status, subject: d.subject, body: d.body, error: d.error}
			setDraft(view)
			if (d.status === "DONE" || d.status === "FAILED") {
				if (timer.current) clearInterval(timer.current)
				setBusy(false)
				if (d.status === "DONE") {
					setSubject(d.subject)
					setBody(d.body)
				}
			}
		}, 2000)
	}

	async function onGenerate() {
		if (!typeId) return
		setMsg(null)
		setBusy(true)
		setDraft({status: "QUEUED", subject, body, error: null})
		const res = await startDraft(leadId, typeId)
		if (!res.ok) {
			setBusy(false)
			setMsg(res.error)
			return
		}
		poll()
	}

	async function onSave() {
		setMsg(null)
		setBusy(true)
		const res = await saveDraft(leadId, subject, body)
		setBusy(false)
		setMsg(res.ok ? "Zapisano." : res.error)
	}

	return (
		<div className="flex flex-col gap-3 rounded border border-zinc-200 p-3">
			<h2 className="text-sm font-semibold text-zinc-500">Draft maila (AI)</h2>
			{types.length === 0 ? (
				<p className="text-sm text-zinc-500">
					Brak typów draftu. Dodaj typ „Draft" w{" "}
					<a className="underline" href="/badania">
						Badania
					</a>
					.
				</p>
			) : (
				<>
					<div className="flex flex-wrap items-end gap-2 text-sm">
						<select className="rounded border border-zinc-300 px-2 py-1" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
							{types.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
						<button className="rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="button" disabled={busy} onClick={onGenerate}>
							Generuj draft
						</button>
					</div>
					{msg ? <p className="text-sm text-zinc-700">{msg}</p> : null}
					{draft && (draft.status === "QUEUED" || draft.status === "RUNNING") ? <p className="text-sm text-zinc-500">Generowanie draftu…</p> : null}
					{draft?.status === "FAILED" ? <p className="text-sm text-red-600">Błąd: {draft.error}</p> : null}
					{draft && draft.status === "DONE" ? (
						<div className="flex flex-col gap-2 text-sm">
							<label className="flex flex-col gap-1">
								<span className="text-xs text-zinc-500">Temat</span>
								<input className="rounded border border-zinc-300 px-2 py-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-xs text-zinc-500">Treść</span>
								<textarea className="min-h-40 rounded border border-zinc-300 px-2 py-1" value={body} onChange={(e) => setBody(e.target.value)} />
							</label>
							<button className="self-start rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50" type="button" disabled={busy} onClick={onSave}>
								Zapisz draft
							</button>
						</div>
					) : null}
				</>
			)}
		</div>
	)
}
```

- [ ] **Step 2: Wire the panel + split types in the lead page**

In `app/(app)/leady/[id]/page.tsx`:

Add imports (after the `UruchomResearch` import):

```tsx
import {DraftPanel} from "./draft-panel"
import {getDraft} from "@/features/research/draft-actions"
```

Fetch the draft alongside the existing data (the page already does sequential awaits; add one). After `const researchTypes = await listResearchTypes(orgId)` add:

```tsx
	const draft = await getDraft(id)
	const draftTypes = researchTypes.filter((t) => t.kind === "DRAFT")
	const pickTypes = researchTypes.filter((t) => t.kind !== "DRAFT")
```

Change the `UruchomResearch` types prop to use `pickTypes` (newline-free anchor on `researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))`):

old:
```tsx
				<UruchomResearch leadId={lead.id} types={researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} />
```
new:
```tsx
				<UruchomResearch leadId={lead.id} types={pickTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} />
				<DraftPanel leadId={lead.id} types={draftTypes.map((t) => ({id: t.id, name: t.name}))} initial={draft ? {status: draft.status, subject: draft.subject, body: draft.body, error: draft.error} : null} />
```

- [ ] **Step 3: Exclude DRAFT from the batch launcher**

In `app/(app)/leady/page.tsx`, change the launcher types prop (newline-free anchor on `researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))`):

old:
```tsx
			<BatchResearchLauncher types={researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} criteria={{offeringLineId: line, q}} />
```
new:
```tsx
			<BatchResearchLauncher types={researchTypes.filter((t) => t.kind !== "DRAFT").map((t) => ({id: t.id, name: t.name, kind: t.kind}))} criteria={{offeringLineId: line, q}} />
```

- [ ] **Step 4: Config form — DRAFT option, hide output fields, hidden-input empty for DRAFT**

In `app/(app)/badania/research-type-form.tsx`:

Add the DRAFT option to the kind `<select>` (newline-free anchor):

old:
```tsx
					<option value="CONTENT">Treść (content)</option>
```
new:
```tsx
					<option value="CONTENT">Treść (content)</option>
					<option value="DRAFT">Draft maila (DRAFT)</option>
```

Add a DRAFT branch to the per-kind hint. Replace the `: null}` that ends the kind-hint conditional (the one right after the CONTENT hint span) — locate the block:

```tsx
				) : kind === "CONTENT" ? (
					<span className="text-xs text-zinc-500">Typ treści musi mieć pole z celem aiHook lub pole własne (CUSTOM); opcjonalnie włącz web search, by odświeżyć research.</span>
				) : null}
```
with:

```tsx
				) : kind === "CONTENT" ? (
					<span className="text-xs text-zinc-500">Typ treści musi mieć pole z celem aiHook lub pole własne (CUSTOM); opcjonalnie włącz web search, by odświeżyć research.</span>
				) : kind === "DRAFT" ? (
					<span className="text-xs text-zinc-500">Typ draftu pisze cały temat i treść maila; pola wyjściowe nieużywane. Opcjonalnie włącz web search.</span>
				) : null}
```

Make the hidden `outputFields` input submit `[]` for DRAFT (newline-free anchor):

old:
```tsx
			<input name="outputFields" type="hidden" value={JSON.stringify(rows.map((r) => r.field))} />
```
new:
```tsx
			<input name="outputFields" type="hidden" value={kind === "DRAFT" ? "[]" : JSON.stringify(rows.map((r) => r.field))} />
```

Hide the output-fields editor for DRAFT. Wrap the `<div className="flex flex-col gap-2">` block that contains "Pola wyjściowe" in a `kind !== "DRAFT"` guard. Anchor on its opening:

old:
```tsx
			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium">Pola wyjściowe</span>
```
new:
```tsx
			{kind !== "DRAFT" ? (
			<div className="flex flex-col gap-2">
				<span className="text-sm font-medium">Pola wyjściowe</span>
```

And close the guard: the output-fields `<div>` ends just before `<div className="flex items-center gap-3">` (the submit row). Anchor on the `+ Dodaj pole` button's closing `</button>` + `</div>` that ends the output-fields section, then the submit row. Locate:

```tsx
				<button className="self-start rounded border border-dashed border-zinc-400 px-3 py-1.5 text-sm" type="button" onClick={addField}>
					+ Dodaj pole
				</button>
			</div>

			<div className="flex items-center gap-3">
```
replace with:

```tsx
				<button className="self-start rounded border border-dashed border-zinc-400 px-3 py-1.5 text-sm" type="button" onClick={addField}>
					+ Dodaj pole
				</button>
			</div>
			) : null}

			<div className="flex items-center gap-3">
```

- [ ] **Step 5: `/badania` — "Draft" badge**

In `app/(app)/badania/page.tsx`, add the DRAFT badge after the CONTENT badge line (newline-free anchor on the CONTENT badge):

old:
```tsx
							{t.kind === "CONTENT" ? <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">Treść</span> : null}{" "}
```
new:
```tsx
							{t.kind === "CONTENT" ? <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">Treść</span> : null}
							{t.kind === "DRAFT" ? <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-700">Draft</span> : null}{" "}
```

- [ ] **Step 6: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npx eslint "app/(app)/leady/[id]/draft-panel.tsx" "app/(app)/leady/[id]/page.tsx" "app/(app)/leady/page.tsx" "app/(app)/badania/research-type-form.tsx" "app/(app)/badania/page.tsx"`
Expected: tsc 0, eslint clean.

```bash
git add "app/(app)/leady/[id]/draft-panel.tsx" "app/(app)/leady/[id]/page.tsx" "app/(app)/leady/page.tsx" "app/(app)/badania/research-type-form.tsx" "app/(app)/badania/page.tsx"
git commit -m "feat(phase2d-3): draft panel on lead card + DRAFT config (option, hide fields, badge, filters)"
```

---

## Task 8: Full gates + ROADMAP + graph

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all pass — 176 (2d-2 baseline) + draft(3) + schema(2) = 181.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build (dev server OFF)**

Run: `npx next build`
Expected: green.

- [ ] **Step 4: Refresh the AST graph**

Run: `graphify update .`
Expected: graph updated.

- [ ] **Step 5: Update the ROADMAP**

In `docs/superpowers/ROADMAP.md`, mark 2d-3 DONE (code/test/build, not live-run), bump the test count, set the next task to **2d-4 (use the draft in sending)**.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase2d-3): mark email-draft DONE (code/test/build) + roadmap to 2d-4"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| `LeadDraft` model + `DraftStatus` + `ResearchTypeKind += DRAFT` + back-relations | Task 1 |
| Pure `buildDraftSchema` + `coerceDraft` | Task 2 |
| `runResearch` optional `system` (default unchanged) | Task 3 |
| `kind += DRAFT` + outputFields optional for DRAFT (refine) | Task 4 |
| `startDraft` / `getDraft` / `saveDraft` (org-scoped, upsert) | Task 5 |
| `runDraftFn` (reuses runResearch + draft schema + context block; writes LeadDraft; not touching runResearchFn) | Task 6 |
| Draft panel (generate/poll/edit) + lead-page wiring + split picker types | Task 7 |
| Config: DRAFT option + hint + hide output fields + `[]` submit + "Draft" badge | Task 7 |
| Batch launcher excludes DRAFT | Task 7 |
| Tests (draft, schema) + re-run + gates | Tasks 2, 4, 8 |
| Sending integration DEFERRED to 2d-4 | Respected — no task touches sending |

No gaps. Confirmed no task modifies `lib/inngest/sending.ts`, `lib/inngest/research.ts` (runResearchFn), or `lib/inngest/research-batch.ts`.

**2. Placeholder scan** — every step has complete code; no TBD/placeholders.

**3. Type consistency** — `kind` union `"RESEARCH" | "SCORING" | "CONTENT" | "DRAFT"` consistent across schema (Task 4), form + pickers (Task 1). `DraftStatus` values match between the model (Task 1), `coerceDraft`/`runDraftFn` writes (Tasks 2/6), and the `DraftView` union in the panel (Task 7). `buildDraftSchema`/`coerceDraft` signatures match their callers (Task 6). `startDraft`/`getDraft`/`saveDraft` signatures match the panel's calls (Tasks 5/7). The `organizationId_leadId` compound-unique upsert key matches the `@@unique([organizationId, leadId])` (Task 1).
