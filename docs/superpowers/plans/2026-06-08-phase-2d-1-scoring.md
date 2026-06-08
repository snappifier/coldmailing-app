# Phase 2d-1 — Lead Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user score/prioritize leads with AI via a research-type variant (`kind = SCORING`) that writes `score` (0-100) + `priority` (1-5) + reasoning, and surface those values across the lead card, `/leady` list (column + sort + min-score filter), and `/pipeline`, with manual override.

**Architecture:** Scoring reuses the 2b/2c engine unchanged except a new `score` output target (clamp 0-100). `ResearchType` gains a `kind` flag (RESEARCH | SCORING) used only for config/UX labeling + a Zod refine ("SCORING must output a score"). The new `Lead.score` column is editable on the lead card (manual override) via a pure `parseScoreFields` helper wired into the existing `updateLead`. No score->priority derivation (AI returns both).

**Tech Stack:** Next 16 (App Router, server actions), Prisma 7 (`@/generated/prisma/client`), Zod 4, Tailwind v4, Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (line 2 after `"use client"`/`"use server"`), `className` first, `import {x}` no inner spaces, NO emoji, Polish UI strings, org-scoped via `requireOrg()`.

---

## File Structure

**Migration / schema**
- Modify: `prisma/schema.prisma` — `ResearchTypeKind` enum; `ResearchType.kind`; `Lead.score`.

**Pure logic (unit-tested)**
- Modify: `features/research-types/targets.ts` — add `score` target.
- Modify: `features/research/apply.ts` — `score` coercion (clamp 0-100) + COLUMN_TARGETS + LeadFields.
- Modify: `features/research-types/schema.ts` — `kind` + "SCORING requires score" refine.
- Create: `features/leads/score-fields.ts` — pure `parseScoreFields`.

**Boundary / actions**
- Modify: `features/research-types/actions.ts` — persist `kind`.
- Modify: `features/leads/actions.ts` — `updateLead` uses `parseScoreFields`.
- Modify: `features/pipeline/queries.ts` + `features/pipeline/types.ts` — `score`.

**UI**
- Modify: `app/(app)/badania/research-type-form.tsx` — `kind` selector + `Initial.kind`.
- Modify: `app/(app)/badania/[id]/page.tsx` — pass `kind` into `initial`.
- Modify: `app/(app)/badania/page.tsx` — "Ocena" badge for SCORING types.
- Modify: `app/(app)/leady/[id]/lead-edit-form.tsx` + `app/(app)/leady/[id]/page.tsx` — edit score/priority/siteQuality/aiHook/aiNotes + header badge.
- Modify: `app/(app)/leady/page.tsx` — Score column + `sort=score` + `minScore` filter.
- Modify: `app/(app)/pipeline/card.tsx` — score badge.
- Modify: `app/(app)/leady/[id]/uruchom-research.tsx` + `app/(app)/leady/batch-research-launcher.tsx` — `[Ocena]` labels.

**Tests**
- Modify: `features/research/apply.test.ts`; `features/research-types/targets.test.ts`; `features/research-types/schema.test.ts`.
- Create: `features/leads/score-fields.test.ts`.

---

## Task 1: Migration + schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the `ResearchTypeKind` enum**

In `prisma/schema.prisma`, add near the other research enums (before `model ResearchType`):

```prisma
enum ResearchTypeKind {
	RESEARCH
	SCORING
}
```

- [ ] **Step 2: Add `kind` to `ResearchType`**

In `model ResearchType`, add after `webSearchEnabled Boolean  @default(false)`:

```prisma
	kind             ResearchTypeKind @default(RESEARCH)
```

- [ ] **Step 3: Add `score` to `Lead`**

In `model Lead`, add after `siteQuality       Int?`:

```prisma
	score             Int?
```

- [ ] **Step 4: Create the migration without applying (protects Neon data — see the prisma7 memory)**

Run: `npx prisma migrate dev --name phase2d_scoring --create-only`
Then read the generated SQL: `prisma/migrations/*phase2d_scoring/migration.sql`
Expected: purely additive — `CREATE TYPE "ResearchTypeKind"`, `ALTER TABLE "ResearchType" ADD COLUMN "kind"`, `ALTER TABLE "Lead" ADD COLUMN "score"`. No DROP.

- [ ] **Step 5: Apply + regenerate**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: migration applied; client regenerated, no errors.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase2d-1): ResearchType.kind + Lead.score schema"
```

---

## Task 2: `score` output target + engine coercion

**Files:**
- Modify: `features/research-types/targets.ts:4-16`
- Modify: `features/research/apply.ts`
- Test: `features/research-types/targets.test.ts`, `features/research/apply.test.ts`

- [ ] **Step 1: Add `score` to `LEAD_TARGETS`**

In `features/research-types/targets.ts`, add to the `LEAD_TARGETS` object (after `priority: "NUMBER",`):

```ts
	score: "NUMBER",
```

(This automatically adds `score` to `TARGET_OPTIONS` and makes `derivedTypeForTarget("score") === "NUMBER"`.)

- [ ] **Step 2: Add the targets test**

In `features/research-types/targets.test.ts`, add:

```ts
	it("exposes score as a NUMBER target", () => {
		expect(LEAD_TARGETS.score).toBe("NUMBER")
		expect(derivedTypeForTarget("score")).toBe("NUMBER")
		expect(TARGET_OPTIONS).toContain("score")
	})
```

Ensure `LEAD_TARGETS`, `derivedTypeForTarget`, `TARGET_OPTIONS` are imported at the top of that test file (add any missing ones to the existing import from `@/features/research-types/targets`).

- [ ] **Step 3: Run the targets test**

Run: `npx vitest run features/research-types/targets.test.ts`
Expected: PASS (existing + the new case).

- [ ] **Step 4: Add `score` coercion + routing in `apply.ts`**

In `features/research/apply.ts`:

(a) Add `"score"` to `COLUMN_TARGETS` (line 6):

```ts
const COLUMN_TARGETS = new Set(["contactPersonName", "contactRole", "honorific", "aiHook", "aiNotes", "siteQuality", "priority", "score", "city", "region", "schoolType", "email"])
```

(b) Add `score` to the `LeadFields` interface (after `siteQuality: number | null`):

```ts
	score: number | null
```

(c) In `coerce`, add a `case "score"` before the `siteQuality`/`priority` case (distinct 0-100 clamp):

```ts
		case "score": {
			const n = typeof raw === "number" ? raw : Number(String(raw).trim())
			if (!Number.isFinite(n)) return {skip: "nie liczba"}
			return {value: Math.max(0, Math.min(100, Math.round(n)))}
		}
```

(`currentFor` needs no change — it resolves non-CUSTOM targets generically via `lead[field.target]`, which now includes `score`.)

- [ ] **Step 5: Extend the apply test fixture + add score cases**

In `features/research/apply.test.ts`:

(a) Add `score: null` to `emptyLead`:

```ts
const emptyLead = {contactPersonName: null, honorific: null, siteQuality: null, priority: null, score: null, email: null, contactRole: null, city: null, region: null, schoolType: null, aiHook: null, aiNotes: null, customFields: null}
```

(b) Add a `score` field to `FIELDS`:

```ts
	{key: "ocena", label: "Ocena", target: "score", type: "NUMBER", required: false, description: null},
```

(c) Add a dedicated test:

```ts
	it("score: AUTO clamps 0-100, rounds, fills empty; a set score becomes a proposal", () => {
		const high = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 150}})
		expect(high.applied.find((a) => a.key === "ocena")?.value).toBe(100)
		const low = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: -5}})
		expect(low.applied.find((a) => a.key === "ocena")?.value).toBe(0)
		const round = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 73.6}})
		expect(round.applied.find((a) => a.key === "ocena")?.value).toBe(74)
		const set = computeApply({lead: {...emptyLead, score: 40}, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {ocena: 90}})
		expect(set.applied.find((a) => a.key === "ocena")).toBeUndefined()
		expect(set.proposed.find((p) => p.key === "ocena")).toMatchObject({value: 90, current: 40})
	})
```

- [ ] **Step 6: Run the apply test**

Run: `npx vitest run features/research/apply.test.ts`
Expected: PASS (existing + new score case).

- [ ] **Step 7: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/research-types/targets.ts features/research-types/targets.test.ts features/research/apply.ts features/research/apply.test.ts
git commit -m "feat(phase2d-1): score output target (clamp 0-100) in engine apply"
```

---

## Task 3: `kind` in the research-type schema + actions

**Files:**
- Modify: `features/research-types/schema.ts:38-61`
- Modify: `features/research-types/actions.ts:11-25,33-43,57-66`
- Test: `features/research-types/schema.test.ts`

- [ ] **Step 1: Add `kind` + the SCORING refine to the schema**

In `features/research-types/schema.ts`, add `kind` to the base object (inside `z.object({...})`, after `webSearchEnabled`):

```ts
		kind: z.enum(["RESEARCH", "SCORING"]).default("RESEARCH"),
```

Then append a refine after the existing two `.refine(...)` calls (after the "Każde pole Lead można zmapować tylko raz" refine):

```ts
	.refine((d) => d.kind !== "SCORING" || d.outputFields.some((f) => f.target === "score"), {
		message: "Typ oceny musi mieć pole z celem 'score'",
		path: ["outputFields"],
	})
```

- [ ] **Step 2: Add schema tests**

In `features/research-types/schema.test.ts`, add (adjust the base-input helper to match whatever the file already uses; otherwise this self-contained version works):

```ts
	it("defaults kind to RESEARCH", () => {
		const r = researchTypeSchema.safeParse({
			name: "Licea", prompt: "p",
			outputFields: [{key: "miasto", label: "Miasto", target: "city", type: "TEXT"}],
		})
		expect(r.success).toBe(true)
		if (r.success) expect(r.data.kind).toBe("RESEARCH")
	})

	it("rejects a SCORING type without a score output", () => {
		const r = researchTypeSchema.safeParse({
			name: "Ocena", prompt: "oceń", kind: "SCORING",
			outputFields: [{key: "uwagi", label: "Uwagi", target: "aiNotes", type: "TEXT"}],
		})
		expect(r.success).toBe(false)
	})

	it("accepts a SCORING type with a score output", () => {
		const r = researchTypeSchema.safeParse({
			name: "Ocena", prompt: "oceń", kind: "SCORING",
			outputFields: [{key: "ocena", label: "Ocena", target: "score", type: "NUMBER"}],
		})
		expect(r.success).toBe(true)
	})
```

Ensure `researchTypeSchema` is imported in that test file.

- [ ] **Step 3: Run the schema test**

Run: `npx vitest run features/research-types/schema.test.ts`
Expected: PASS.

- [ ] **Step 4: Persist `kind` in actions**

In `features/research-types/actions.ts`:

(a) In `parseForm`, add `kind` to the parsed object:

```ts
	return researchTypeSchema.safeParse({
		name: formData.get("name") ?? "",
		prompt: formData.get("prompt") ?? "",
		modelId: formData.get("modelId") ?? undefined,
		webSearchEnabled: formData.get("webSearchEnabled") === "true",
		kind: formData.get("kind") ?? undefined,
		outputFields,
	})
```

(b) In `createResearchType`'s `prisma.researchType.create` data, add `kind: parsed.data.kind,` (after `webSearchEnabled`).

(c) In `updateResearchType`'s `prisma.researchType.updateMany` data, add `kind: parsed.data.kind,` (after `webSearchEnabled`).

- [ ] **Step 5: Typecheck + full suite + commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc 0; all tests pass.

```bash
git add features/research-types/schema.ts features/research-types/schema.test.ts features/research-types/actions.ts
git commit -m "feat(phase2d-1): ResearchType kind flag + SCORING-requires-score validation"
```

---

## Task 4: `kind` selector in the research-type form

**Files:**
- Modify: `app/(app)/badania/research-type-form.tsx`
- Modify: `app/(app)/badania/[id]/page.tsx`

- [ ] **Step 1: Add `kind` to the form's `Initial` interface**

In `app/(app)/badania/research-type-form.tsx`, add to the `Initial` interface (after `name: string`):

```ts
	kind: "RESEARCH" | "SCORING"
```

- [ ] **Step 2: Render the `kind` selector**

In the same file, add this block immediately after the "Nazwa" `<label>` (before the "Prompt researchu" label):

```tsx
				<label className="flex flex-col gap-1 text-sm">
					<span className="font-medium">Rodzaj</span>
					<select className="rounded border border-zinc-300 px-2 py-1" name="kind" defaultValue={initial?.kind ?? "RESEARCH"}>
						<option value="RESEARCH">Research (zbieranie danych)</option>
						<option value="SCORING">Ocena (scoring)</option>
					</select>
					<span className="text-xs text-zinc-500">Typ oceny powinien mieć pole z celem score (0-100), opcjonalnie priority (1-5) i uzasadnienie (np. aiNotes).</span>
				</label>
```

- [ ] **Step 3: Pass `kind` from the edit page**

In `app/(app)/badania/[id]/page.tsx`, add `kind` to the `initial` object:

```ts
	const initial = {
		name: type.name,
		kind: type.kind,
		prompt: type.prompt,
		modelId: type.modelId ?? "",
		webSearchEnabled: type.webSearchEnabled,
		outputFields: (type.outputFields as OutputField[]) ?? [],
	}
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add "app/(app)/badania/research-type-form.tsx" "app/(app)/badania/[id]/page.tsx"
git commit -m "feat(phase2d-1): kind selector in the research-type form"
```

---

## Task 5: "Ocena" badge on `/badania`

**Files:**
- Modify: `app/(app)/badania/page.tsx`

- [ ] **Step 1: Show the kind badge**

In `app/(app)/badania/page.tsx`, inside the research-types `<li>`, change the type link line to add a badge for SCORING types. Replace:

```tsx
								<Link className="font-medium underline" href={`/badania/${t.id}`}>
									{t.name}
								</Link>{" "}
```

with:

```tsx
								<Link className="font-medium underline" href={`/badania/${t.id}`}>
									{t.name}
								</Link>
								{t.kind === "SCORING" ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Ocena</span> : null}{" "}
```

(`listResearchTypes` returns the full row, so `t.kind` is available.)

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add "app/(app)/badania/page.tsx"
git commit -m "feat(phase2d-1): Ocena badge for scoring types on /badania"
```

---

## Task 6: Pure `parseScoreFields`

**Files:**
- Create: `features/leads/score-fields.ts`
- Test: `features/leads/score-fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/leads/score-fields.test.ts
import {describe, it, expect} from "vitest"
import {parseScoreFields} from "@/features/leads/score-fields"

function from(obj: Record<string, string>) {
	return (name: string) => (name in obj ? obj[name] : null)
}

describe("parseScoreFields", () => {
	it("parses + clamps score 0-100 and priority/siteQuality 1-5", () => {
		const r = parseScoreFields(from({score: "150", priority: "9", siteQuality: "0", aiHook: " hak ", aiNotes: "bo X"}))
		expect(r).toEqual({score: 100, priority: 5, siteQuality: 1, aiHook: "hak", aiNotes: "bo X"})
	})

	it("rounds and keeps in-range values", () => {
		const r = parseScoreFields(from({score: "73.6", priority: "3", siteQuality: "4"}))
		expect(r.score).toBe(74)
		expect(r.priority).toBe(3)
		expect(r.siteQuality).toBe(4)
	})

	it("maps empty / missing / non-numeric to null", () => {
		const r = parseScoreFields(from({score: "", priority: "abc", aiHook: "  "}))
		expect(r).toEqual({score: null, priority: null, siteQuality: null, aiHook: null, aiNotes: null})
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/leads/score-fields.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// features/leads/score-fields.ts
export interface ScoreFields {
	score: number | null
	priority: number | null
	siteQuality: number | null
	aiHook: string | null
	aiNotes: string | null
}

function clampInt(raw: string | null, min: number, max: number): number | null {
	const s = String(raw ?? "").trim()
	if (!s) return null
	const n = Number(s)
	if (!Number.isFinite(n)) return null
	return Math.max(min, Math.min(max, Math.round(n)))
}

function text(raw: string | null): string | null {
	const s = String(raw ?? "").trim()
	return s ? s : null
}

export function parseScoreFields(get: (name: string) => string | null): ScoreFields {
	return {
		score: clampInt(get("score"), 0, 100),
		priority: clampInt(get("priority"), 1, 5),
		siteQuality: clampInt(get("siteQuality"), 1, 5),
		aiHook: text(get("aiHook")),
		aiNotes: text(get("aiNotes")),
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/leads/score-fields.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add features/leads/score-fields.ts features/leads/score-fields.test.ts
git commit -m "feat(phase2d-1): pure parseScoreFields (score/priority/siteQuality + text)"
```

---

## Task 7: Editable score fields on the lead card (override)

**Files:**
- Modify: `features/leads/actions.ts:47-97`
- Modify: `app/(app)/leady/[id]/lead-edit-form.tsx`
- Modify: `app/(app)/leady/[id]/page.tsx`

> Implement the action + form + page together in one commit: `updateLead` must read these fields only once the form sends them, otherwise an edit would null out existing AI-set values.

- [ ] **Step 1: Wire `parseScoreFields` into `updateLead`**

In `features/leads/actions.ts`, add the import (top, with the other imports):

```ts
import {parseScoreFields} from "@/features/leads/score-fields"
```

In `updateLead`, after the `honorific` parsing block, add:

```ts
	const scoreFields = parseScoreFields((name) => {
		const v = formData.get(name)
		return v === null ? null : String(v)
	})
```

In the `prisma.lead.updateMany` `data`, add the five fields (after `honorific,`):

```ts
				honorific,
				score: scoreFields.score,
				priority: scoreFields.priority,
				siteQuality: scoreFields.siteQuality,
				aiHook: scoreFields.aiHook,
				aiNotes: scoreFields.aiNotes,
				customFields,
```

- [ ] **Step 2: Extend `LeadEditForm` props + inputs**

In `app/(app)/leady/[id]/lead-edit-form.tsx`, extend `Props.lead`:

```ts
	lead: {
		id: string
		organizationName: string
		email: string | null
		website: string | null
		contactPersonName: string | null
		contactRole: string | null
		city: string | null
		honorific: "PAN" | "PANI" | null
		score: number | null
		priority: number | null
		siteQuality: number | null
		aiHook: string | null
		aiNotes: string | null
	}
```

Add these inputs after the "Zwrot (honorific)" `<label>` (before the customFields `<fieldset>`):

```tsx
				<div className="flex flex-wrap gap-3">
					<label className="flex flex-col text-sm">
						Score (0-100)
						<input className="w-24 rounded border border-zinc-300 px-2 py-1" name="score" type="number" min={0} max={100} defaultValue={lead.score ?? ""} />
					</label>
					<label className="flex flex-col text-sm">
						Priorytet (1-5)
						<input className="w-20 rounded border border-zinc-300 px-2 py-1" name="priority" type="number" min={1} max={5} defaultValue={lead.priority ?? ""} />
					</label>
					<label className="flex flex-col text-sm">
						Jakość strony (1-5)
						<input className="w-24 rounded border border-zinc-300 px-2 py-1" name="siteQuality" type="number" min={1} max={5} defaultValue={lead.siteQuality ?? ""} />
					</label>
				</div>
				<label className="flex flex-col text-sm">
					Hook AI
					<input className="rounded border border-zinc-300 px-2 py-1" name="aiHook" defaultValue={lead.aiHook ?? ""} />
				</label>
				<label className="flex flex-col text-sm">
					Uzasadnienie / notatki AI
					<textarea className="min-h-20 rounded border border-zinc-300 px-2 py-1" name="aiNotes" defaultValue={lead.aiNotes ?? ""} />
				</label>
```

- [ ] **Step 3: Pass the new fields + header badge from the lead page**

In `app/(app)/leady/[id]/page.tsx`, extend the `lead={{...}}` passed to `LeadEditForm`:

```tsx
						lead={{
							id: lead.id,
							organizationName: lead.organizationName,
							email: lead.email,
							website: lead.website,
							contactPersonName: lead.contactPersonName,
							contactRole: lead.contactRole,
							city: lead.city,
							honorific: lead.honorific,
							score: lead.score,
							priority: lead.priority,
							siteQuality: lead.siteQuality,
							aiHook: lead.aiHook,
							aiNotes: lead.aiNotes,
						}}
```

And add a read-only score badge next to the "Etap" badge in the header. Replace:

```tsx
					<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Etap: {STAGE_LABEL[lead.dealStage]}</span>
```

with:

```tsx
					<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Etap: {STAGE_LABEL[lead.dealStage]}</span>
					<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Ocena: {lead.score ?? "—"} / prio {lead.priority ?? "—"}</span>
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/leads/actions.ts "app/(app)/leady/[id]/lead-edit-form.tsx" "app/(app)/leady/[id]/page.tsx"
git commit -m "feat(phase2d-1): edit score/priority/siteQuality/aiHook/aiNotes on the lead card"
```

---

## Task 8: `/leady` Score column + sort + min-score filter

**Files:**
- Modify: `app/(app)/leady/page.tsx`

- [ ] **Step 1: Extend searchParams + where + orderBy**

In `app/(app)/leady/page.tsx`, change the function signature destructuring:

```tsx
export default async function LeadsPage({searchParams}: {searchParams: Promise<{q?: string; line?: string; sort?: string; minScore?: string}>}) {
	const {orgId} = await requireOrg()
	const {q, line, sort, minScore} = await searchParams
```

After the existing `if (q) {...}` block, add the min-score filter:

```tsx
	const minScoreNum = minScore ? Number(minScore) : NaN
	if (Number.isFinite(minScoreNum)) where.score = {gte: minScoreNum}
```

Change the `orderBy` line to add the `score` sort (nulls last — Postgres puts NULLs first on DESC by default):

```tsx
	const orderBy: Prisma.LeadOrderByWithRelationInput =
		sort === "priority" ? {priority: "desc"} : sort === "score" ? {score: {sort: "desc", nulls: "last"}} : sort === "name" ? {organizationName: "asc"} : {createdAt: "desc"}
```

- [ ] **Step 2: Add the filter inputs**

In the filter `<form>`, add a min-score input (after the `q` input) and a `score` sort option. Add after the `name="q"` input:

```tsx
					<input className="w-28 rounded border border-zinc-300 px-2 py-1" name="minScore" type="number" min={0} max={100} placeholder="min score" defaultValue={minScore ?? ""} />
```

In the sort `<select>`, add (after the "Priorytet" option):

```tsx
						<option value="score">Score</option>
```

- [ ] **Step 3: Add the Score column**

In the table head, add a header after the "Miasto" `<th>`:

```tsx
							<th className="py-1 pr-2">Score</th>
```

In the table body row, add a cell after the city cell (`<td>{lead.city ?? "—"}</td>`):

```tsx
								<td className="py-1 pr-2">{lead.score ?? "—"}</td>
```

Update the empty-state `colSpan` from `6` to `7`:

```tsx
							<td className="py-2 text-zinc-500" colSpan={7}>
```

(The leads `findMany` returns full rows, so `lead.score` is already available — no `select` change.)

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add "app/(app)/leady/page.tsx"
git commit -m "feat(phase2d-1): /leady score column + sort + min-score filter"
```

---

## Task 9: `/pipeline` score badge

**Files:**
- Modify: `features/pipeline/types.ts:25-33`
- Modify: `features/pipeline/queries.ts:6-29`
- Modify: `app/(app)/pipeline/card.tsx`

- [ ] **Step 1: Add `score` to `PipelineLead`**

In `features/pipeline/types.ts`, add to the `PipelineLead` interface (after `lineName`):

```ts
	score: number | null
```

- [ ] **Step 2: Select + map `score` in the query**

In `features/pipeline/queries.ts` `getPipelineLeads`, add `score: true,` to the `select` (after `city: true,`), and add `score: l.score,` to the returned object (after `lineName: ...,`):

```ts
		select: {
			id: true,
			organizationName: true,
			city: true,
			score: true,
			dealStage: true,
			offeringLine: {select: {name: true}},
			campaignLeads: {orderBy: {createdAt: "desc"}, take: 1, select: {status: true}},
			activities: {orderBy: {createdAt: "desc"}, take: 1, select: {createdAt: true}},
		},
```

```ts
		lineName: l.offeringLine?.name ?? null,
		score: l.score,
		sequenceStatus: l.campaignLeads[0]?.status ?? null,
```

- [ ] **Step 3: Show the score on the card**

In `app/(app)/pipeline/card.tsx`, change the bottom meta row to include the score. Replace:

```tsx
				<div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
					<span>{lead.sequenceStatus ?? ""}</span>
					<span>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString("pl-PL") : ""}</span>
				</div>
```

with:

```tsx
				<div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
					<span>{lead.sequenceStatus ?? ""}</span>
					<span>{lead.score != null ? `score ${lead.score}` : ""}</span>
					<span>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString("pl-PL") : ""}</span>
				</div>
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add features/pipeline/types.ts features/pipeline/queries.ts "app/(app)/pipeline/card.tsx"
git commit -m "feat(phase2d-1): show lead score on pipeline cards"
```

---

## Task 10: `[Ocena]` labels in the run/batch pickers

**Files:**
- Modify: `app/(app)/leady/[id]/uruchom-research.tsx`
- Modify: `app/(app)/leady/[id]/page.tsx`
- Modify: `app/(app)/leady/batch-research-launcher.tsx`
- Modify: `app/(app)/leady/page.tsx`

- [ ] **Step 1: `uruchom-research.tsx` — carry + show `kind`**

In `app/(app)/leady/[id]/uruchom-research.tsx`, extend `TypeOption`:

```ts
interface TypeOption {
	id: string
	name: string
	kind: "RESEARCH" | "SCORING"
}
```

In the type `<select>`, prefix scoring types. Replace:

```tsx
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
```

with:

```tsx
								<option key={t.id} value={t.id}>
									{t.kind === "SCORING" ? "[Ocena] " : ""}
									{t.name}
								</option>
```

- [ ] **Step 2: Pass `kind` from the lead page**

In `app/(app)/leady/[id]/page.tsx`, change the `types` prop mapping:

```tsx
				<UruchomResearch leadId={lead.id} types={researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} />
```

- [ ] **Step 3: `batch-research-launcher.tsx` — carry + show `kind`**

In `app/(app)/leady/batch-research-launcher.tsx`, extend `TypeOption`:

```ts
interface TypeOption {
	id: string
	name: string
	kind: "RESEARCH" | "SCORING"
}
```

In the type `<select>`, prefix scoring types. Replace:

```tsx
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
```

with:

```tsx
							<option key={t.id} value={t.id}>
								{t.kind === "SCORING" ? "[Ocena] " : ""}
								{t.name}
							</option>
```

- [ ] **Step 4: Pass `kind` from `/leady`**

In `app/(app)/leady/page.tsx`, change the launcher's `types` prop:

```tsx
			<BatchResearchLauncher types={researchTypes.map((t) => ({id: t.id, name: t.name, kind: t.kind}))} criteria={{offeringLineId: line, q}} />
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors.

```bash
git add "app/(app)/leady/[id]/uruchom-research.tsx" "app/(app)/leady/[id]/page.tsx" "app/(app)/leady/batch-research-launcher.tsx" "app/(app)/leady/page.tsx"
git commit -m "feat(phase2d-1): [Ocena] labels for scoring types in run/batch pickers"
```

---

## Task 11: Full gates + ROADMAP + graph

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all pass — 162 (Phase 2c baseline) + targets(+1) + apply(+1) + schema(+3) + score-fields(+3) = 170.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build (dev server OFF)**

Run: `npx next build`
Expected: green. (If `.next`/port is locked by `npm run dev`, ask the user to stop it first.)

- [ ] **Step 4: Refresh the AST graph**

Run: `graphify update .`
Expected: graph updated (no API cost).

- [ ] **Step 5: Update the ROADMAP**

In `docs/superpowers/ROADMAP.md`, mark 2d-1 DONE (code/test/build, not live-run), bump the test count, and set the next task to **2d-2 (content writing)**.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase2d-1): mark scoring DONE (code/test/build) + roadmap to 2d-2"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Migration `phase2d_scoring` (ResearchTypeKind, kind, Lead.score) | Task 1 |
| `score` output target + 0-100 clamp coercion | Task 2 |
| `kind` flag + SCORING-requires-score refine + persist | Task 3 |
| kind selector in config form + edit-page initial | Task 4 |
| Ocena badge on /badania | Task 5 |
| Pure `parseScoreFields` | Task 6 |
| Lead-card edit (override) of score/priority/siteQuality/aiHook/aiNotes + header badge | Task 7 |
| /leady Score column + sort=score (nulls last) + minScore filter | Task 8 |
| /pipeline score badge (query + type + card) | Task 9 |
| [Ocena] labels in run + batch pickers | Task 10 |
| Tests (apply, targets, schema, score-fields) + gates + roadmap | Tasks 2,3,6,11 |
| Apply AUTO-fill-empty preserves manual override | Verified by Task 2 score test (set-score -> proposal, not applied) |
| minScore NOT threaded into batch criteria (v1 boundary) | Respected — Task 8 touches only `/leady` page; `BatchCriteria`/`buildLeadWhere` untouched |

No gaps. Engine/run/batch (2b/2c) reused unchanged — no task touches `engine.ts`/`research.ts`/`research-batch.ts`, matching the spec.

**2. Placeholder scan** — every code step has complete code; no TBD/TODO/"handle errors" placeholders.

**3. Type consistency** — `ScoreFields` shape is identical in `score-fields.ts` (Task 6), its test (Task 6), and the `updateLead` usage (Task 7). `kind` literal union `"RESEARCH" | "SCORING"` is consistent across schema (Task 3), form `Initial` (Task 4), and the picker `TypeOption`s (Task 10). `score` target string is consistent across `targets.ts` (Task 2), `apply.ts` COLUMN_TARGETS + coerce (Task 2), and the schema refine (Task 3). `PipelineLead.score` (Task 9) matches the query select/map.
