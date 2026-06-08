# Phase 2d-2 — AI Content Writing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `kind = CONTENT` research-type variant that writes `aiHook` and/or `customFields` per lead, with the prompt receiving a "lead context" block of prior research (the model decides whether to also web-search).

**Architecture:** `ResearchTypeKind` gains `CONTENT`. A pure `buildLeadContextBlock(lead)` renders the lead's non-empty gathered research; `runResearchFn` appends it to the prompt only when the (live-read) type kind is `CONTENT`. RESEARCH/SCORING are untouched. Output fields, editing (`aiHook` + `customFields`), diff, and run/batch all reuse the existing 2b/2c engine.

**Tech Stack:** Next 16 (App Router), Prisma 7 (`@/generated/prisma/client`), Zod 4, Inngest v4, Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (line 2 after a `"use client"`/`"use server"` directive), `className` first, `import {x}` no inner spaces, NO emoji, Polish UI strings, org-scoped via `requireOrg()`. NOTE: several existing files have mixed CRLF/LF — prefer newline-free, em-dash-free Edit anchors.

---

## File Structure

- Modify: `prisma/schema.prisma` — `ResearchTypeKind += CONTENT`.
- Create: `features/research/lead-context.ts` — pure `buildLeadContextBlock`.
- Modify: `lib/inngest/research.ts` — append context block for CONTENT runs.
- Modify: `features/research-types/schema.ts` — `kind` enum += CONTENT + "CONTENT requires aiHook/CUSTOM" refine.
- Modify: `app/(app)/badania/research-type-form.tsx` — CONTENT selector option + `Initial.kind` union.
- Modify: `app/(app)/badania/page.tsx` — "Treść" badge for CONTENT types.
- Modify: `app/(app)/leady/[id]/uruchom-research.tsx` + `app/(app)/leady/batch-research-launcher.tsx` — `[Treść]` label + `TypeOption.kind` union.
- Tests: `features/research/lead-context.test.ts` (new); `features/research-types/schema.test.ts`.

---

## Task 1: Migration — `CONTENT` enum value

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `CONTENT` to the enum**

In `prisma/schema.prisma`, change `enum ResearchTypeKind`:

```prisma
enum ResearchTypeKind {
	RESEARCH
	SCORING
	CONTENT
}
```

- [ ] **Step 2: Create the migration without applying (protect Neon data — see the prisma7 memory)**

Run: `npx prisma migrate dev --name phase2d2_content --create-only`
Then read `prisma/migrations/*phase2d2_content/migration.sql`
Expected: only `ALTER TYPE "ResearchTypeKind" ADD VALUE 'CONTENT';`. No DROP.

- [ ] **Step 3: Apply + regenerate**

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: applied; client regenerated.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase2d-2): ResearchTypeKind += CONTENT"
```

---

## Task 2: Pure `buildLeadContextBlock`

**Files:**
- Create: `features/research/lead-context.ts`
- Test: `features/research/lead-context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/lead-context.test.ts
import {describe, it, expect} from "vitest"
import {buildLeadContextBlock} from "@/features/research/lead-context"

const empty = {aiNotes: null, score: null, siteQuality: null, region: null, schoolType: null, contactRole: null, email: null, phone: null, customFields: null}

describe("buildLeadContextBlock", () => {
	it("returns an empty string when nothing is known", () => {
		expect(buildLeadContextBlock(empty)).toBe("")
	})

	it("includes only non-empty known fields", () => {
		const block = buildLeadContextBlock({...empty, aiNotes: "dyrektor lubi sport", score: 80, siteQuality: null})
		expect(block).toContain("Notatki researchu: dyrektor lubi sport")
		expect(block).toContain("Ocena (score): 80")
		expect(block).not.toContain("Jakość strony")
	})

	it("formats each non-empty customFields entry and skips empty ones", () => {
		const block = buildLeadContextBlock({...empty, customFields: {dyrektorImie: "Anna", pustePole: ""}})
		expect(block).toContain("dyrektorImie: Anna")
		expect(block).not.toContain("pustePole")
	})
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run features/research/lead-context.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// features/research/lead-context.ts
export interface LeadContextInput {
	aiNotes: string | null
	score: number | null
	siteQuality: number | null
	region: string | null
	schoolType: string | null
	contactRole: string | null
	email: string | null
	phone: string | null
	customFields: unknown
}

function present(value: unknown): boolean {
	return value !== null && value !== undefined && String(value).trim() !== ""
}

// Plain-text block of the lead's already-gathered research, appended to a CONTENT prompt so the model
// can reuse prior research instead of re-searching. Sent only to the model, never to a customer email.
export function buildLeadContextBlock(lead: LeadContextInput): string {
	const lines: string[] = []
	const add = (label: string, value: unknown) => {
		if (present(value)) lines.push(`- ${label}: ${value}`)
	}
	add("Notatki researchu", lead.aiNotes)
	add("Ocena (score)", lead.score)
	add("Jakość strony", lead.siteQuality)
	add("Region", lead.region)
	add("Typ placówki", lead.schoolType)
	add("Rola kontaktu", lead.contactRole)
	add("Email", lead.email)
	add("Telefon", lead.phone)
	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	for (const [key, value] of Object.entries(cf)) {
		if (present(value)) lines.push(`- ${key}: ${value}`)
	}
	if (lines.length === 0) return ""
	return `Co już wiemy o tym leadzie (wykorzystaj te dane; researchuj ponownie tylko jeśli to konieczne):\n${lines.join("\n")}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run features/research/lead-context.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add features/research/lead-context.ts features/research/lead-context.test.ts
git commit -m "feat(phase2d-2): pure buildLeadContextBlock for content prompts"
```

---

## Task 3: Append the context block in `runResearchFn` (CONTENT only)

**Files:**
- Modify: `lib/inngest/research.ts`

- [ ] **Step 1: Import the helper**

In `lib/inngest/research.ts`, add to the imports (after the `runResearch` import):

```ts
import {buildLeadContextBlock} from "@/features/research/lead-context"
```

- [ ] **Step 2: Inject the block for CONTENT runs**

Replace the `step.run("anthropic", ...)` block:

```ts
		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			return runResearch({renderedPrompt: buildResearchPrompt(prompt, ctx), inputSchema: buildFindingsSchema(fields), modelId, webSearchEnabled})
		})
```

with:

```ts
		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(lead, "", placeholders)
			const base = buildResearchPrompt(prompt, ctx)
			// CONTENT types get the lead's prior research appended so the model can reuse it (and decide
			// whether to web-search). kind is read live from the type; RESEARCH/SCORING get no block.
			const contextBlock = researchType.kind === "CONTENT" ? buildLeadContextBlock(lead) : ""
			const renderedPrompt = contextBlock ? `${base}\n\n${contextBlock}` : base
			return runResearch({renderedPrompt, inputSchema: buildFindingsSchema(fields), modelId, webSearchEnabled})
		})
```

(`lead` = `run.lead` (full row with aiNotes/score/etc.); `researchType` = `run.researchType` (loaded). For batch runs prompt/fields come from the snapshot but `kind` is read live — accepted, see spec.)

- [ ] **Step 3: Typecheck + re-run the engine tests (no regression)**

Run: `npx tsc --noEmit && npx vitest run features/research/apply.test.ts`
Expected: tsc 0; apply tests still pass (RESEARCH/SCORING behavior unchanged — block only for CONTENT).

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/research.ts
git commit -m "feat(phase2d-2): append lead-context block to CONTENT-type prompts"
```

---

## Task 4: `kind` enum += CONTENT + CONTENT refine

**Files:**
- Modify: `features/research-types/schema.ts`
- Test: `features/research-types/schema.test.ts`

- [ ] **Step 1: Extend the enum + add the refine**

In `features/research-types/schema.ts`, change the `kind` line in the base object:

```ts
		kind: z.enum(["RESEARCH", "SCORING", "CONTENT"]).default("RESEARCH"),
```

Append a new refine after the SCORING refine (the `"Typ oceny musi mieć pole z celem 'score'"` one):

```ts
	.refine((d) => d.kind !== "CONTENT" || d.outputFields.some((f) => f.target === "aiHook" || f.target === "CUSTOM"), {
		message: "Typ treści musi mieć pole z celem 'aiHook' lub pole własne (CUSTOM)",
		path: ["outputFields"],
	})
```

- [ ] **Step 2: Add schema tests**

In `features/research-types/schema.test.ts`, add (the `valid` fixture has a CUSTOM field, so override `outputFields` for the rejection case):

```ts
	it("rejects a CONTENT type without an aiHook or CUSTOM output", () => {
		const fields = [{key: "miasto", label: "Miasto", target: "city", type: "TEXT"}]
		expect(researchTypeSchema.safeParse({...valid, kind: "CONTENT", outputFields: fields}).success).toBe(false)
	})

	it("accepts a CONTENT type with an aiHook output", () => {
		const fields = [{key: "hak", label: "Hook", target: "aiHook", type: "TEXT"}]
		expect(researchTypeSchema.safeParse({...valid, kind: "CONTENT", outputFields: fields}).success).toBe(true)
	})

	it("accepts a CONTENT type with only a CUSTOM output", () => {
		const fields = [{key: "ps", label: "PS", target: "CUSTOM", type: "TEXT"}]
		expect(researchTypeSchema.safeParse({...valid, kind: "CONTENT", outputFields: fields}).success).toBe(true)
	})
```

- [ ] **Step 3: Run the schema test**

Run: `npx vitest run features/research-types/schema.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: 0 errors (the `kind` enum widening may surface union mismatches in the form/pickers — those are fixed in Task 5; if tsc errors there now, proceed to Task 5 and re-run tsc at its end).

```bash
git add features/research-types/schema.ts features/research-types/schema.test.ts
git commit -m "feat(phase2d-2): CONTENT kind + requires-aiHook/CUSTOM validation"
```

---

## Task 5: UI — selector option, badge, picker labels

**Files:**
- Modify: `app/(app)/badania/research-type-form.tsx`
- Modify: `app/(app)/badania/page.tsx`
- Modify: `app/(app)/leady/[id]/uruchom-research.tsx`
- Modify: `app/(app)/leady/batch-research-launcher.tsx`

- [ ] **Step 1: Form — widen `Initial.kind` + add the CONTENT option**

In `app/(app)/badania/research-type-form.tsx`, widen the union (newline-free anchor):

```ts
	kind: "RESEARCH" | "SCORING" | "CONTENT"
```

Add the CONTENT option to the kind `<select>` — anchor on the SCORING option line (newline-free):

old:
```tsx
						<option value="SCORING">Ocena (scoring)</option>
```
new:
```tsx
						<option value="SCORING">Ocena (scoring)</option>
						<option value="CONTENT">Treść (content)</option>
```

- [ ] **Step 2: `/badania` — add the "Treść" badge**

In `app/(app)/badania/page.tsx`, replace the SCORING-only badge line (newline-free anchor):

old:
```tsx
							{t.kind === "SCORING" ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Ocena</span> : null}{" "}
```
new:
```tsx
							{t.kind === "SCORING" ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">Ocena</span> : null}
							{t.kind === "CONTENT" ? <span className="ml-1 rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-700">Treść</span> : null}{" "}
```

- [ ] **Step 3: Run picker — widen union + `[Treść]` label**

In `app/(app)/leady/[id]/uruchom-research.tsx`, widen `TypeOption.kind` (newline-free anchor):

```ts
	kind: "RESEARCH" | "SCORING" | "CONTENT"
```

Replace the label ternary (newline-free anchor):

old:
```tsx
									{t.kind === "SCORING" ? "[Ocena] " : ""}
```
new:
```tsx
									{t.kind === "SCORING" ? "[Ocena] " : t.kind === "CONTENT" ? "[Treść] " : ""}
```

- [ ] **Step 4: Batch launcher — widen union + `[Treść]` label**

In `app/(app)/leady/batch-research-launcher.tsx`, widen `TypeOption.kind`:

```ts
	kind: "RESEARCH" | "SCORING" | "CONTENT"
```

Replace the label ternary (newline-free anchor):

old:
```tsx
								{t.kind === "SCORING" ? "[Ocena] " : ""}
```
new:
```tsx
								{t.kind === "SCORING" ? "[Ocena] " : t.kind === "CONTENT" ? "[Treść] " : ""}
```

(The call sites already pass `kind: t.kind` from 2d-1 — no change needed there. The edit page `app/(app)/badania/[id]/page.tsx` already passes `kind: type.kind` — no change.)

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npx tsc --noEmit && npx eslint "app/(app)/badania/research-type-form.tsx" "app/(app)/badania/page.tsx" "app/(app)/leady/[id]/uruchom-research.tsx" "app/(app)/leady/batch-research-launcher.tsx"`
Expected: tsc 0, eslint clean.

```bash
git add "app/(app)/badania/research-type-form.tsx" "app/(app)/badania/page.tsx" "app/(app)/leady/[id]/uruchom-research.tsx" "app/(app)/leady/batch-research-launcher.tsx"
git commit -m "feat(phase2d-2): CONTENT selector option, Tresc badge, [Tresc] picker labels"
```

---

## Task 6: Full gates + ROADMAP + graph

**Files:**
- Modify: `docs/superpowers/ROADMAP.md`

- [ ] **Step 1: Full suite**

Run: `npx vitest run`
Expected: all pass — 170 (2d-1 baseline) + lead-context(+3) + schema(+3) = 176.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Production build (dev server OFF)**

Run: `npx next build`
Expected: green.

- [ ] **Step 4: Refresh the AST graph**

Run: `graphify update .`
Expected: graph updated (no API cost).

- [ ] **Step 5: Update the ROADMAP**

In `docs/superpowers/ROADMAP.md`, mark 2d-2 DONE (code/test/build, not live-run), bump the test count, and set the next task to **2d-3 (full email draft)**.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/ROADMAP.md graphify-out
git commit -m "docs(phase2d-2): mark content writing DONE (code/test/build) + roadmap to 2d-3"
```

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Migration: `ResearchTypeKind += CONTENT` | Task 1 |
| Pure `buildLeadContextBlock` (non-empty fields incl customFields, "" when empty) | Task 2 |
| Append context block in `runResearchFn` when kind===CONTENT (live read; RESEARCH/SCORING unchanged) | Task 3 |
| `kind` enum += CONTENT + "CONTENT requires aiHook/CUSTOM" refine | Task 4 |
| Config selector option + `Initial.kind` widen | Task 5 |
| "Treść" badge on `/badania` | Task 5 |
| `[Treść]` labels + `TypeOption.kind` widen in both pickers | Task 5 |
| Web search = existing `webSearchEnabled` toggle (no change) | Respected — no task touches it |
| Editing (aiHook + customFields) + diff + run/batch reused | Respected — no task touches them |
| Tests (lead-context, schema) + re-run 2b + gates | Tasks 2, 4, 3, 6 |

No gaps. Engine change is confined to the prompt-assembly line in `runResearchFn`; `engine.ts`, `apply.ts`, `research-batch.ts`, and the actions are untouched.

**2. Placeholder scan** — every code step has complete code; no TBD/placeholders.

**3. Type consistency** — the `kind` union `"RESEARCH" | "SCORING" | "CONTENT"` is consistent across schema (Task 4), form `Initial.kind` (Task 5), and both pickers' `TypeOption.kind` (Task 5). `buildLeadContextBlock`'s `LeadContextInput` (Task 2) is a structural subset of the Prisma `Lead` passed in Task 3 (all fields present on the row). The label mapping `SCORING -> "[Ocena] "`, `CONTENT -> "[Treść] "` is identical in both pickers.
