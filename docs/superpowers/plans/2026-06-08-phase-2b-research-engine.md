# Phase 2b — Research engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run one `ResearchType` on one lead via Anthropic (+ web search) asynchronously through Inngest, returning structured findings and applying them to lead fields (AUTO fill-empty / MANUAL confirm).

**Architecture:** Pure modules (`features/research/{schema-build,apply,prompt,model,types}.ts`) hold schema-gen + coercion + render + model-resolve, unit-tested off the next-auth/SDK chain. `engine.ts` is the only Anthropic-SDK file (unified `submit_findings` tool + web_search loop). `lib/inngest/research.ts` runs it durably; `actions.ts` starts/polls/confirms; a client component drives the lead-page UI.

**Tech Stack:** Next 16 server actions, React 19 (`useActionState`/polling), Prisma 7, Inngest v4, `@anthropic-ai/sdk` ^0.100.1, Zod 4, Vitest 4. Conventions: tabs, no semicolons, path comment line 1 (line 2 after a directive), `className` first, no emoji.

Spec: `docs/superpowers/specs/2026-06-08-phase-2b-research-engine-design.md`.

---

## File structure

- Create `features/research/types.ts` — shared result/diff types.
- Create `features/research/model.ts` (+ test) — default model + per-model tuning (effort/thinking gating).
- Create `features/research/schema-build.ts` (+ test) — outputFields -> submit_findings JSON schema.
- Create `features/research/apply.ts` (+ test) — coercion + AUTO/MANUAL partition + lead-update builder.
- Create `features/research/prompt.ts` (+ test) — render the prompt per lead, strip missing tokens.
- Create `features/research/engine.ts` — Anthropic boundary (agentic loop).
- Modify `prisma/schema.prisma` + migration `phase2b_research_runs` — `ResearchRun`, enums, `LeadActivityKind += RESEARCH`, back-relations.
- Create `lib/inngest/research.ts` — durable function; Modify `app/api/inngest/route.ts` — register it.
- Create `features/research/actions.ts` — `startResearch` / `getResearchRun` / `confirmResearchApply`.
- Create `app/(app)/leady/[id]/uruchom-research.tsx` — client UI; Modify `app/(app)/leady/[id]/page.tsx` — mount it.

---

### Task 1: Types + model resolve/tuning

**Files:** Create `features/research/types.ts`, `features/research/model.ts`, `features/research/model.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/model.test.ts
import {describe, it, expect} from "vitest"
import {resolveModel, tuningForModel} from "@/features/research/model"

describe("model", () => {
	it("falls back to the default opus model", () => {
		expect(resolveModel(null)).toBe("claude-opus-4-8")
		expect(resolveModel("")).toBe("claude-opus-4-8")
		expect(resolveModel("claude-sonnet-4-6")).toBe("claude-sonnet-4-6")
	})

	it("enables effort+thinking for opus/sonnet but not haiku", () => {
		expect(tuningForModel("claude-opus-4-8").output_config?.effort).toBe("high")
		expect(tuningForModel("claude-sonnet-4-6").thinking?.type).toBe("adaptive")
		expect(tuningForModel("claude-haiku-4-5")).toEqual({})
	})
})
```

- [ ] **Step 2: Run, expect FAIL** — `npx vitest run features/research/model.test.ts`

- [ ] **Step 3: Implement**

```ts
// features/research/types.ts
export type ResearchFindings = Record<string, unknown>

export interface AppliedField {
	key: string
	target: string
	label: string
	value: string | number | null
}
export interface ProposedField extends AppliedField {
	current: string | number | null
}
export interface SkippedField {
	key: string
	label: string
	reason: string
}
export interface ResearchDiff {
	applied: AppliedField[]
	proposed: ProposedField[]
	skipped: SkippedField[]
}
export type EngineResult = {ok: true; findings: ResearchFindings} | {ok: false; error: string}
```

```ts
// features/research/model.ts
export const DEFAULT_RESEARCH_MODEL = "claude-opus-4-8"

export function resolveModel(modelId: string | null | undefined): string {
	return modelId && modelId.trim() ? modelId : DEFAULT_RESEARCH_MODEL
}

// effort + adaptive thinking are supported on opus/sonnet 4.6+, but 400 on haiku-4-5 -> gate them.
export function tuningForModel(model: string): {thinking?: {type: "adaptive"}; output_config?: {effort: "high"}} {
	const supports = model.startsWith("claude-opus") || model.startsWith("claude-sonnet")
	if (!supports) return {}
	return {thinking: {type: "adaptive"}, output_config: {effort: "high"}}
}
```

- [ ] **Step 4: Run, expect PASS** — `npx vitest run features/research/model.test.ts`

- [ ] **Step 5: Commit**

```bash
git add features/research/types.ts features/research/model.ts features/research/model.test.ts
git commit -m "feat(phase2b): research types + model resolve/tuning"
```

---

### Task 2: submit_findings schema builder

**Files:** Create `features/research/schema-build.ts`, `features/research/schema-build.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/schema-build.test.ts
import {describe, it, expect} from "vitest"
import {buildFindingsSchema} from "@/features/research/schema-build"

const f = (over: Record<string, unknown>) => ({key: "k", label: "L", target: "CUSTOM", type: "TEXT", required: false, description: null, ...over})

describe("buildFindingsSchema", () => {
	it("maps types and collects required keys", () => {
		const s = buildFindingsSchema([
			f({key: "imie", target: "contactPersonName", type: "TEXT", required: true}),
			f({key: "plec", target: "honorific", type: "GENDER"}),
			f({key: "jakosc", target: "siteQuality", type: "NUMBER"}),
			f({key: "mail", target: "email", type: "EMAIL"}),
			f({key: "flaga", target: "CUSTOM", type: "BOOLEAN"}),
		] as never)
		expect(s.type).toBe("object")
		expect(s.additionalProperties).toBe(false)
		expect(s.required).toEqual(["imie"])
		expect((s.properties.plec as {enum: string[]}).enum).toEqual(["PAN", "PANI"])
		expect((s.properties.jakosc as {type: string}).type).toBe("number")
		expect((s.properties.mail as {format: string}).format).toBe("email")
		expect((s.properties.flaga as {type: string}).type).toBe("boolean")
	})

	it("treats ENUM-without-options as a plain string", () => {
		const s = buildFindingsSchema([f({key: "x", target: "CUSTOM", type: "ENUM"})] as never)
		expect((s.properties.x as {type: string}).type).toBe("string")
		expect((s.properties.x as {enum?: unknown}).enum).toBeUndefined()
	})
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// features/research/schema-build.ts
import type {OutputField} from "@/features/research-types/schema"

export interface FindingsSchema {
	type: "object"
	additionalProperties: false
	properties: Record<string, Record<string, unknown>>
	required: string[]
}

export function buildFindingsSchema(fields: OutputField[]): FindingsSchema {
	const properties: Record<string, Record<string, unknown>> = {}
	const required: string[] = []
	for (const field of fields) {
		properties[field.key] = propertyFor(field)
		if (field.required) required.push(field.key)
	}
	return {type: "object", additionalProperties: false, properties, required}
}

function propertyFor(field: OutputField): Record<string, unknown> {
	const base: Record<string, unknown> = field.description ? {description: field.description} : {}
	switch (field.type) {
		case "NUMBER":
			return {...base, type: "number"}
		case "BOOLEAN":
			return {...base, type: "boolean"}
		case "EMAIL":
			return {...base, type: "string", format: "email"}
		case "GENDER":
			return {...base, type: "string", enum: ["PAN", "PANI"]}
		default:
			return {...base, type: "string"}
	}
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add features/research/schema-build.ts features/research/schema-build.test.ts
git commit -m "feat(phase2b): submit_findings JSON schema builder"
```

---

### Task 3: Apply (coercion + AUTO/MANUAL partition)

**Files:** Create `features/research/apply.ts`, `features/research/apply.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/apply.test.ts
import {describe, it, expect} from "vitest"
import {computeApply, toLeadUpdate} from "@/features/research/apply"

const FIELDS = [
	{key: "imie", label: "Imię", target: "contactPersonName", type: "TEXT", required: false, description: null},
	{key: "plec", label: "Płeć", target: "honorific", type: "GENDER", required: false, description: null},
	{key: "jakosc", label: "Jakość", target: "siteQuality", type: "NUMBER", required: false, description: null},
	{key: "mail", label: "Email", target: "email", type: "EMAIL", required: false, description: null},
	{key: "tel", label: "Tel", target: "CUSTOM", type: "TEXT", required: false, description: null},
] as never

const emptyLead = {contactPersonName: null, honorific: null, siteQuality: null, priority: null, email: null, contactRole: null, city: null, region: null, schoolType: null, aiHook: null, aiNotes: null, customFields: null}

describe("computeApply", () => {
	it("AUTO: empties applied, normalizes gender, clamps number, lowercases email", () => {
		const d = computeApply({lead: emptyLead, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {imie: " Jan Kowalski ", plec: "mężczyzna", jakosc: 9, mail: "DYR@Szkola.PL", tel: 123456}})
		const byKey = Object.fromEntries(d.applied.map((a) => [a.key, a.value]))
		expect(byKey.imie).toBe("Jan Kowalski")
		expect(byKey.plec).toBe("PAN")
		expect(byKey.jakosc).toBe(5)
		expect(byKey.mail).toBe("dyr@szkola.pl")
		expect(byKey.tel).toBe("123456")
		expect(d.proposed).toHaveLength(0)
	})

	it("AUTO: a set field becomes a proposal, not applied", () => {
		const d = computeApply({lead: {...emptyLead, honorific: "PANI"}, fields: FIELDS, mode: "AUTO", emailTaken: false, findings: {plec: "mężczyzna"}})
		expect(d.applied).toHaveLength(0)
		expect(d.proposed[0]).toMatchObject({key: "plec", value: "PAN", current: "PANI"})
	})

	it("MANUAL: everything is a proposal", () => {
		const d = computeApply({lead: emptyLead, fields: FIELDS, mode: "MANUAL", emailTaken: false, findings: {imie: "Anna"}})
		expect(d.applied).toHaveLength(0)
		expect(d.proposed.map((p) => p.key)).toContain("imie")
	})

	it("skips email when taken, unrecognized gender, and no-ops", () => {
		const d = computeApply({lead: {...emptyLead, contactPersonName: "Jan"}, fields: FIELDS, mode: "AUTO", emailTaken: true, findings: {mail: "x@y.pl", plec: "robot", imie: "Jan"}})
		const reasons = Object.fromEntries(d.skipped.map((s) => [s.key, s.reason]))
		expect(reasons.mail).toBeTruthy()
		expect(reasons.plec).toBeTruthy()
		expect(reasons.imie).toBeTruthy() // no-op (same value)
	})

	it("toLeadUpdate routes columns vs customFields and merges", () => {
		const {data, customFields} = toLeadUpdate(
			[{key: "imie", target: "contactPersonName", label: "", value: "Jan"}, {key: "tel", target: "CUSTOM", label: "", value: "123"}],
			{istniejace: "x"},
		)
		expect(data.contactPersonName).toBe("Jan")
		expect(customFields).toEqual({istniejace: "x", tel: "123"})
	})
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// features/research/apply.ts
import type {OutputField} from "@/features/research-types/schema"
import type {AppliedField, ProposedField, ResearchDiff, SkippedField} from "@/features/research/types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const COLUMN_TARGETS = new Set(["contactPersonName", "contactRole", "honorific", "aiHook", "aiNotes", "siteQuality", "priority", "city", "region", "schoolType", "email"])

interface LeadFields {
	contactPersonName: string | null
	contactRole: string | null
	email: string | null
	city: string | null
	region: string | null
	schoolType: string | null
	honorific: string | null
	siteQuality: number | null
	priority: number | null
	aiHook: string | null
	aiNotes: string | null
	customFields: unknown
}

interface ApplyArgs {
	lead: LeadFields
	fields: OutputField[]
	findings: Record<string, unknown>
	mode: "AUTO" | "MANUAL"
	emailTaken: boolean
}

export function computeApply({lead, fields, findings, mode, emailTaken}: ApplyArgs): ResearchDiff {
	const applied: AppliedField[] = []
	const proposed: ProposedField[] = []
	const skipped: SkippedField[] = []

	for (const field of fields) {
		const raw = findings[field.key]
		const coerced = coerce(field, raw)
		if ("skip" in coerced) {
			if (raw !== undefined && raw !== null && raw !== "") skipped.push({key: field.key, label: field.label, reason: coerced.skip})
			else if (field.required) skipped.push({key: field.key, label: field.label, reason: "brak wymaganej wartości"})
			continue
		}
		if (field.target === "email" && emailTaken) {
			skipped.push({key: field.key, label: field.label, reason: "email zajęty przez innego leada"})
			continue
		}
		const current = currentFor(lead, field)
		if (sameValue(current, coerced.value)) {
			skipped.push({key: field.key, label: field.label, reason: "bez zmian"})
			continue
		}
		const entry: AppliedField = {key: field.key, target: field.target, label: field.label, value: coerced.value}
		if (mode === "AUTO" && current === null) applied.push(entry)
		else proposed.push({...entry, current})
	}

	return {applied, proposed, skipped}
}

export function toLeadUpdate(applied: AppliedField[], existingCustom: Record<string, string>): {data: Record<string, unknown>; customFields: Record<string, string>} {
	const data: Record<string, unknown> = {}
	const customFields: Record<string, string> = {...existingCustom}
	for (const a of applied) {
		if (a.target === "CUSTOM") customFields[a.key] = a.value === null ? "" : String(a.value)
		else if (COLUMN_TARGETS.has(a.target)) data[a.target] = a.value
	}
	return {data, customFields}
}

function coerce(field: OutputField, raw: unknown): {value: string | number} | {skip: string} {
	if (raw === undefined || raw === null || raw === "") return {skip: "brak wartości"}
	if (field.target === "CUSTOM") {
		if (typeof raw === "boolean") return {value: String(raw)}
		const s = String(raw).trim()
		return s ? {value: s} : {skip: "puste"}
	}
	switch (field.target) {
		case "honorific": {
			const g = normalizeGender(raw)
			return g ? {value: g} : {skip: "nierozpoznana płeć"}
		}
		case "siteQuality":
		case "priority": {
			const n = typeof raw === "number" ? raw : Number(String(raw).trim())
			if (!Number.isFinite(n)) return {skip: "nie liczba"}
			return {value: Math.max(1, Math.min(5, Math.round(n)))}
		}
		case "email": {
			const e = String(raw).trim().toLowerCase()
			return EMAIL_RE.test(e) ? {value: e} : {skip: "błędny email"}
		}
		default: {
			const s = String(raw).trim()
			return s ? {value: s} : {skip: "puste"}
		}
	}
}

function normalizeGender(raw: unknown): "PAN" | "PANI" | null {
	const s = String(raw).trim().toLowerCase()
	if (["pan", "male", "m", "mężczyzna", "mezczyzna", "man"].includes(s)) return "PAN"
	if (["pani", "female", "f", "k", "kobieta", "woman"].includes(s)) return "PANI"
	return null
}

function currentFor(lead: LeadFields, field: OutputField): string | number | null {
	if (field.target === "CUSTOM") {
		const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
		const v = cf[field.key]
		return v === undefined || v === null || v === "" ? null : String(v)
	}
	const v = (lead as unknown as Record<string, unknown>)[field.target]
	if (v === undefined || v === null || v === "") return null
	return typeof v === "number" ? v : String(v)
}

function sameValue(a: string | number | null, b: string | number | null): boolean {
	return String(a ?? "") === String(b ?? "")
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add features/research/apply.ts features/research/apply.test.ts
git commit -m "feat(phase2b): research apply (coercion + AUTO/MANUAL partition + lead-update)"
```

---

### Task 4: Prompt rendering

**Files:** Create `features/research/prompt.ts`, `features/research/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// features/research/prompt.test.ts
import {describe, it, expect} from "vitest"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"

const lead = {organizationName: "Liceum X", contactPersonName: null, city: "Kraków", website: "x.pl", aiHook: null, honorific: null, customFields: null}

describe("prompt", () => {
	it("renders builtin tokens and strips missing markers", () => {
		const ctx = leadToRenderContext(lead, "", [])
		const out = buildResearchPrompt("Znajdź dyrektora {{nazwaPlacowki}} w {{miasto}}. Hook: {{hookAI}}", ctx)
		expect(out).toContain("Liceum X")
		expect(out).toContain("Kraków")
		expect(out).not.toContain("[brak:")
	})
})
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// features/research/prompt.ts
import {renderTemplate, type RenderContext, type RenderLead, type RenderPlaceholder} from "@/features/templates/render"

interface PromptLead {
	organizationName: string
	contactPersonName: string | null
	city: string | null
	website: string | null
	aiHook: string | null
	honorific: "PAN" | "PANI" | null
	customFields: Record<string, unknown> | null
}

export function leadToRenderContext(lead: PromptLead, senderName: string, placeholders: RenderPlaceholder[]): RenderContext {
	const renderLead: RenderLead = {
		organizationName: lead.organizationName,
		contactPersonName: lead.contactPersonName,
		city: lead.city,
		website: lead.website,
		aiHook: lead.aiHook,
		honorific: lead.honorific,
		customFields: lead.customFields,
	}
	return {lead: renderLead, senderName, placeholders}
}

export function buildResearchPrompt(rawPrompt: string, ctx: RenderContext): string {
	const {rendered} = renderTemplate(rawPrompt, ctx)
	return rendered
		.replace(/\[brak: [^\]]+\]/g, "")
		.replace(/[ \t]{2,}/g, " ")
		.trim()
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add features/research/prompt.ts features/research/prompt.test.ts
git commit -m "feat(phase2b): research prompt rendering (reuse renderTemplate, strip missing)"
```

---

### Task 5: Prisma model + migration

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add enums** (near the other enums)

```prisma
enum ResearchRunStatus {
	QUEUED
	RUNNING
	DONE
	FAILED
}

enum ResearchApplyMode {
	AUTO
	MANUAL
}
```

- [ ] **Step 2: Add `RESEARCH` to `LeadActivityKind`**

```prisma
enum LeadActivityKind {
	NOTE
	CALL
	MEETING
	OFFER_SENT
	STAGE_CHANGE
	RESEARCH
}
```

- [ ] **Step 3: Add the model** (after `ResearchType`)

```prisma
model ResearchRun {
	id               String            @id @default(cuid())
	organizationId   String
	leadId           String
	researchTypeId   String?
	researchTypeName String
	modelId          String?
	mode             ResearchApplyMode @default(AUTO)
	status           ResearchRunStatus @default(QUEUED)
	findings         Json?
	diff             Json?
	error            String?
	createdById      String?
	createdAt        DateTime          @default(now())
	updatedAt        DateTime          @updatedAt
	completedAt      DateTime?

	organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	lead         Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
	researchType ResearchType? @relation(fields: [researchTypeId], references: [id], onDelete: SetNull)
	createdBy    User?         @relation("ResearchRunCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@index([organizationId, leadId])
}
```

- [ ] **Step 4: Add back-relations** — in `Organization` add `researchRuns ResearchRun[]`; in `Lead` add `researchRuns ResearchRun[]`; in `User` add `researchRuns ResearchRun[] @relation("ResearchRunCreatedBy")`; in `ResearchType` add `runs ResearchRun[]`.

- [ ] **Step 5: Migrate + verify** (dev server OFF)

Run: `npx prisma migrate dev --name phase2b_research_runs` then `npx prisma generate` then `npx tsc --noEmit`
Expected: migration applied, client regenerated, tsc 0.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(phase2b): ResearchRun model + migration phase2b_research_runs"
```

---

### Task 6: Engine (Anthropic boundary)

**Files:** Create `features/research/engine.ts`

> Verify against the claude-api skill at build time: `web_search_20260209` / `web_fetch_20260209` tool literals, `output_config.effort`, `thinking.adaptive`, and `pause_turn` handling on SDK ^0.100.1. Adjust casts to satisfy `tsc`. The submit tool is intentionally NOT `strict` — `apply.ts` defensively validates findings — but add `strict: true` if the SDK shape is clean.

- [ ] **Step 1: Implement**

```ts
// features/research/engine.ts
import Anthropic from "@anthropic-ai/sdk"
import {resolveModel, tuningForModel} from "@/features/research/model"
import type {EngineResult} from "@/features/research/types"

const SUBMIT_TOOL = "submit_findings"
const SYSTEM =
	"Jesteś asystentem researchu B2B. Zbierz wymagane informacje o podmiocie (w razie potrzeby wyszukując w sieci), a następnie wywołaj narzędzie submit_findings z wynikami. Podawaj tylko zweryfikowane fakty; gdy czegoś nie ustalisz, pomiń pole. Nie zgaduj."

interface RunArgs {
	renderedPrompt: string
	inputSchema: object
	modelId: string | null
	webSearchEnabled: boolean
}

export async function runResearch({renderedPrompt, inputSchema, modelId, webSearchEnabled}: RunArgs): Promise<EngineResult> {
	if (!process.env.ANTHROPIC_API_KEY) return {ok: false, error: "Brak ANTHROPIC_API_KEY"}

	const client = new Anthropic()
	const model = resolveModel(modelId)

	const tools: unknown[] = [{name: SUBMIT_TOOL, description: "Zgłoś zebrane wyniki researchu zgodnie ze schematem.", input_schema: inputSchema}]
	if (webSearchEnabled) {
		tools.push({type: "web_search_20260209", name: "web_search"})
		tools.push({type: "web_fetch_20260209", name: "web_fetch"})
	}

	const messages: Anthropic.Messages.MessageParam[] = [{role: "user", content: renderedPrompt}]

	try {
		for (let i = 0; i < 12; i++) {
			const res = await client.messages.create({
				model,
				max_tokens: 8000,
				system: SYSTEM,
				tools: tools as Anthropic.Messages.ToolUnion[],
				messages,
				...tuningForModel(model),
			} as Anthropic.Messages.MessageCreateParamsNonStreaming)

			const submit = res.content.find((b) => b.type === "tool_use" && b.name === SUBMIT_TOOL)
			if (submit && submit.type === "tool_use") {
				return {ok: true, findings: (submit.input ?? {}) as Record<string, unknown>}
			}
			if (res.stop_reason === "end_turn") return {ok: false, error: "Model nie zwrócił wyników (brak submit_findings)"}
			messages.push({role: "assistant", content: res.content})
		}
		return {ok: false, error: "Przekroczono limit iteracji researchu"}
	} catch (e) {
		return {ok: false, error: e instanceof Error ? e.message : "Błąd API"}
	}
}
```

- [ ] **Step 2: Verify compile** — `npx tsc --noEmit` (fix SDK casts as needed).

- [ ] **Step 3: Commit**

```bash
git add features/research/engine.ts
git commit -m "feat(phase2b): Anthropic research engine (submit_findings + web_search loop)"
```

---

### Task 7: Inngest function + registration

**Files:** Create `lib/inngest/research.ts`; Modify `app/api/inngest/route.ts`

- [ ] **Step 1: Implement the function**

```ts
// lib/inngest/research.ts
import {inngest} from "@/lib/inngest/client"
import {prisma} from "@/lib/prisma"
import {buildFindingsSchema} from "@/features/research/schema-build"
import {computeApply, toLeadUpdate} from "@/features/research/apply"
import {buildResearchPrompt, leadToRenderContext} from "@/features/research/prompt"
import {runResearch} from "@/features/research/engine"
import {resolveModel} from "@/features/research/model"
import type {OutputField} from "@/features/research-types/schema"
import type {Prisma} from "@/generated/prisma/client"

async function emailTakenFor(orgId: string, leadId: string, fields: OutputField[], findings: Record<string, unknown>): Promise<boolean> {
	const field = fields.find((f) => f.target === "email")
	if (!field) return false
	const raw = findings[field.key]
	const email = typeof raw === "string" ? raw.trim().toLowerCase() : ""
	if (!email) return false
	const other = await prisma.lead.findFirst({where: {organizationId: orgId, email, id: {not: leadId}}, select: {id: true}})
	return Boolean(other)
}

export const runResearchFn = inngest.createFunction(
	{id: "run-research", triggers: {event: "research/run.requested"}, concurrency: {limit: 3, key: "event.data.organizationId"}, retries: 2},
	async ({event, step}) => {
		const {runId} = event.data as {runId: string}
		const run = await prisma.researchRun.findUnique({where: {id: runId}, include: {lead: true, researchType: true}})
		if (!run || !run.lead || !run.researchType) {
			if (run) await prisma.researchRun.update({where: {id: runId}, data: {status: "FAILED", error: "Brak typu researchu lub leada", completedAt: new Date()}})
			return {skipped: true}
		}
		await step.run("mark-running", () => prisma.researchRun.update({where: {id: runId}, data: {status: "RUNNING"}}))

		const fields = (run.researchType.outputFields as OutputField[]) ?? []
		const placeholders = await prisma.placeholder.findMany({where: {organizationId: run.organizationId}, select: {key: true, source: true, fallback: true}})

		const result = await step.run("anthropic", () => {
			const ctx = leadToRenderContext(run.lead, "", placeholders)
			return runResearch({renderedPrompt: buildResearchPrompt(run.researchType!.prompt, ctx), inputSchema: buildFindingsSchema(fields), modelId: run.researchType!.modelId, webSearchEnabled: run.researchType!.webSearchEnabled})
		})

		if (!result.ok) {
			await prisma.researchRun.update({where: {id: runId}, data: {status: "FAILED", error: result.error, completedAt: new Date()}})
			return {ok: false}
		}

		const emailTaken = await emailTakenFor(run.organizationId, run.leadId, fields, result.findings)
		const diff = computeApply({lead: run.lead, fields, findings: result.findings, mode: run.mode, emailTaken})

		if (diff.applied.length > 0) {
			const existing = (run.lead.customFields as Record<string, string> | null) ?? {}
			const {data, customFields} = toLeadUpdate(diff.applied, existing)
			await step.run("apply", () => prisma.lead.updateMany({where: {id: run.leadId, organizationId: run.organizationId}, data: {...data, customFields}}))
		}

		await step.run("finish", () =>
			prisma.$transaction([
				prisma.researchRun.update({where: {id: runId}, data: {status: "DONE", findings: result.findings as Prisma.InputJsonValue, diff: diff as unknown as Prisma.InputJsonValue, modelId: resolveModel(run.researchType!.modelId), completedAt: new Date()}}),
				prisma.leadActivity.create({data: {organizationId: run.organizationId, leadId: run.leadId, kind: "RESEARCH", body: `Research "${run.researchTypeName}": ${diff.applied.length} zastosowane, ${diff.proposed.length} propozycje, ${diff.skipped.length} pominięte`, authorUserId: run.createdById}}),
			]),
		)
		return {ok: true, applied: diff.applied.length}
	},
)
```

- [ ] **Step 2: Register** — in `app/api/inngest/route.ts` import `runResearchFn` and add it to the `functions` array.

```ts
import {runResearchFn} from "@/lib/inngest/research"
// ...functions: [helloWorld, runLeadSequence, scanMailboxesForReplies, pollMailboxReplies, runResearchFn]
```

- [ ] **Step 3: Verify compile** — `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/inngest/research.ts app/api/inngest/route.ts
git commit -m "feat(phase2b): durable Inngest research function + registration"
```

---

### Task 8: Server actions

**Files:** Create `features/research/actions.ts`

- [ ] **Step 1: Implement**

```ts
"use server"
// features/research/actions.ts

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {inngest} from "@/lib/inngest/client"
import {toLeadUpdate} from "@/features/research/apply"
import type {ProposedField} from "@/features/research/types"

export type StartResult = {ok: true; runId: string} | {ok: false; error: string}
export type ApplyResult = {ok: true} | {ok: false; error: string}

export async function startResearch(leadId: string, researchTypeId: string, mode: "AUTO" | "MANUAL"): Promise<StartResult> {
	const {orgId, userId} = await requireOrg()
	const [lead, type] = await Promise.all([
		prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {id: true}}),
		prisma.researchType.findFirst({where: {id: researchTypeId, organizationId: orgId}, select: {id: true, name: true}}),
	])
	if (!lead || !type) return {ok: false, error: "Nie znaleziono leada lub typu researchu"}

	const run = await prisma.researchRun.create({
		data: {organizationId: orgId, leadId, researchTypeId: type.id, researchTypeName: type.name, mode, status: "QUEUED", createdById: userId},
	})
	await inngest.send({name: "research/run.requested", data: {runId: run.id, organizationId: orgId}})
	revalidatePath(`/leady/${leadId}`)
	return {ok: true, runId: run.id}
}

export async function getResearchRun(runId: string) {
	const {orgId} = await requireOrg()
	return prisma.researchRun.findFirst({where: {id: runId, organizationId: orgId}})
}

export async function confirmResearchApply(runId: string): Promise<ApplyResult> {
	const {orgId, userId} = await requireOrg()
	const run = await prisma.researchRun.findFirst({where: {id: runId, organizationId: orgId}, include: {lead: true}})
	if (!run || !run.lead || run.status !== "DONE" || !run.diff) return {ok: false, error: "Brak wyników do zastosowania"}

	const diff = run.diff as unknown as {proposed?: ProposedField[]}
	let proposed = diff.proposed ?? []
	if (proposed.length === 0) return {ok: true}

	const emailItem = proposed.find((p) => p.target === "email")
	if (emailItem && typeof emailItem.value === "string") {
		const taken = await prisma.lead.findFirst({where: {organizationId: orgId, email: emailItem.value, id: {not: run.leadId}}, select: {id: true}})
		if (taken) proposed = proposed.filter((p) => p.target !== "email")
	}

	const existing = (run.lead.customFields as Record<string, string> | null) ?? {}
	const {data, customFields} = toLeadUpdate(proposed, existing)
	await prisma.$transaction([
		prisma.lead.updateMany({where: {id: run.leadId, organizationId: orgId}, data: {...data, customFields}}),
		prisma.leadActivity.create({data: {organizationId: orgId, leadId: run.leadId, kind: "RESEARCH", body: `Zastosowano propozycje researchu (${proposed.length})`, authorUserId: userId}}),
	])
	revalidatePath(`/leady/${run.leadId}`)
	return {ok: true}
}
```

- [ ] **Step 2: Verify compile** — `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add features/research/actions.ts
git commit -m "feat(phase2b): research actions (start/poll/confirm)"
```

---

### Task 9: Lead-page UI

**Files:** Create `app/(app)/leady/[id]/uruchom-research.tsx`; Modify `app/(app)/leady/[id]/page.tsx`

- [ ] **Step 1: Implement the client component**

```tsx
"use client"
// app/(app)/leady/[id]/uruchom-research.tsx

import {useEffect, useRef, useState} from "react"
import {useRouter} from "next/navigation"
import {startResearch, getResearchRun, confirmResearchApply} from "@/features/research/actions"

interface TypeOption {
	id: string
	name: string
}
interface DiffField {
	key: string
	label: string
	value: string | number | null
	current?: string | number | null
	reason?: string
}
interface RunView {
	status: "QUEUED" | "RUNNING" | "DONE" | "FAILED"
	error: string | null
	diff: {applied: DiffField[]; proposed: DiffField[]; skipped: DiffField[]} | null
}

export function UruchomResearch({leadId, types}: {leadId: string; types: TypeOption[]}) {
	const router = useRouter()
	const [typeId, setTypeId] = useState(types[0]?.id ?? "")
	const [mode, setMode] = useState<"AUTO" | "MANUAL">("AUTO")
	const [run, setRun] = useState<RunView | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => () => {
		if (timer.current) clearInterval(timer.current)
	}, [])

	function poll(runId: string) {
		if (timer.current) clearInterval(timer.current)
		timer.current = setInterval(async () => {
			const r = await getResearchRun(runId)
			if (!r) return
			setRun({status: r.status, error: r.error, diff: r.diff as RunView["diff"]})
			if (r.status === "DONE" || r.status === "FAILED") {
				if (timer.current) clearInterval(timer.current)
				setBusy(false)
				router.refresh()
			}
		}, 2000)
	}

	async function onRun() {
		if (!typeId) return
		setError(null)
		setBusy(true)
		setRun({status: "QUEUED", error: null, diff: null})
		const res = await startResearch(leadId, typeId, mode)
		if (!res.ok) {
			setError(res.error)
			setBusy(false)
			return
		}
		poll(res.runId)
	}

	async function onApply(runId: string) {
		setBusy(true)
		await confirmResearchApply(runId)
		setBusy(false)
		router.refresh()
	}

	const proposed = run?.diff?.proposed ?? []

	return (
		<div className="flex flex-col gap-3 rounded border border-zinc-200 p-3">
			<h2 className="text-sm font-semibold text-zinc-500">Research AI</h2>
			{types.length === 0 ? (
				<p className="text-sm text-zinc-500">
							Brak typów researchu. Dodaj w <a className="underline" href="/badania">Badania</a>.
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
						<select className="rounded border border-zinc-300 px-2 py-1" value={mode} onChange={(e) => setMode(e.target.value as "AUTO" | "MANUAL")}>
							<option value="AUTO">Auto (uzupełnij puste)</option>
							<option value="MANUAL">Ręczne zatwierdzenie</option>
						</select>
						<button className="rounded bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50" type="button" disabled={busy} onClick={onRun}>
							Uruchom research
						</button>
					</div>
					{error ? <p className="text-sm text-red-600">{error}</p> : null}
					{run && (run.status === "QUEUED" || run.status === "RUNNING") ? <p className="text-sm text-zinc-500">Trwa research…</p> : null}
					{run?.status === "FAILED" ? <p className="text-sm text-red-600">Błąd: {run.error}</p> : null}
					{run?.status === "DONE" && run.diff ? (
						<div className="flex flex-col gap-2 text-sm">
							{run.diff.applied.length > 0 ? (
								<div>
									<p className="font-medium text-green-700">Zastosowane:</p>
									<ul className="list-disc pl-5">
										{run.diff.applied.map((a) => (
											<li key={a.key}>
												{a.label}: {String(a.value)}
											</li>
										))}
									</ul>
								</div>
							) : null}
							{proposed.length > 0 ? (
								<div>
									<p className="font-medium text-amber-700">Propozycje (zatwierdź):</p>
									<ul className="list-disc pl-5">
										{proposed.map((p) => (
											<li key={p.key}>
												{p.label}: <span className="text-zinc-400 line-through">{String(p.current ?? "—")}</span> → {String(p.value)}
											</li>
										))}
									</ul>
									<button className="mt-1 rounded bg-amber-600 px-3 py-1 text-white disabled:opacity-50" type="button" disabled={busy} onClick={() => run && onApplyCurrent()}>
										Zastosuj propozycje
									</button>
								</div>
							) : null}
							{run.diff.skipped.length > 0 ? (
								<p className="text-xs text-zinc-400">Pominięte: {run.diff.skipped.map((s) => `${s.label} (${s.reason})`).join(", ")}</p>
							) : null}
						</div>
					) : null}
				</>
			)}
		</div>
	)

	function onApplyCurrent() {
		// runId tracked via the latest poll start; re-fetch newest run is overkill, so capture from closure
	}
}
```

> Note during implementation: track the active `runId` in state (set it in `onRun` from `res.runId`) and pass it to `onApply(runId)` for the "Zastosuj" button instead of the placeholder `onApplyCurrent`. Add `const [runId, setRunId] = useState<string|null>(null)`, `setRunId(res.runId)` after start, and `onClick={() => runId && onApply(runId)}`.

- [ ] **Step 2: Mount in the page** — in `app/(app)/leady/[id]/page.tsx`, load research types and render the component in the timeline column:

```tsx
import {listResearchTypes} from "@/features/research-types/queries"
import {UruchomResearch} from "./uruchom-research"
// ...inside the component, after timeline load:
const researchTypes = await listResearchTypes(orgId)
// ...in the right column, above ActivityForm:
<UruchomResearch leadId={lead.id} types={researchTypes.map((t) => ({id: t.id, name: t.name}))} />
```

- [ ] **Step 3: Verify compile** — `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/leady/\[id\]/uruchom-research.tsx app/\(app\)/leady/\[id\]/page.tsx
git commit -m "feat(phase2b): lead-page research UI (run/poll/confirm)"
```

---

### Task 10: Verification + adversarial review + docs

- [ ] **Step 1: Full gates** — `npx tsc --noEmit` (0); `npx vitest run` (green, prior + new); dev server OFF then `npx next build` (green, `/leady/[id]` present).
- [ ] **Step 2: Adversarial review** — dispatch reviewers (org-scoping on every read/write; spec conformance; conventions; correctness of engine loop + apply coercion + customFields merge + email pre-check; Next/React/Inngest idioms; the engine's SDK usage vs the claude-api skill). Fix confirmed findings; re-run gates.
- [ ] **Step 3: graphify + ROADMAP** — `graphify update .`; mark 2b DONE in `docs/superpowers/ROADMAP.md`, set next = 2c.
- [ ] **Step 4: Final commit.**

---

## Self-review

- **Spec coverage:** ResearchRun model + enums + RESEARCH activity (Task 5); submit_findings schema (Task 2); engine mechanism B + model gating (Tasks 1/6); apply AUTO/MANUAL + coercion + clamp + email + customFields merge (Task 3); prompt render+strip (Task 4); async Inngest + email pre-check + activity log (Task 7); actions start/poll/confirm (Task 8); UI run/poll/diff/confirm (Task 9); tests + gates + review (all + Task 10). All spec sections covered.
- **Placeholder scan:** the UI `onApplyCurrent` is explicitly flagged with the exact fix (track `runId` in state) — resolve during Task 9; no other TBDs.
- **Type consistency:** `EngineResult`/`ResearchDiff`/`AppliedField`/`ProposedField` (Task 1) used in apply (3), engine (6), inngest (7), actions (8), UI (9); `runResearch`/`computeApply`/`toLeadUpdate`/`buildFindingsSchema`/`buildResearchPrompt`/`resolveModel`/`tuningForModel` signatures consistent across consumers; `research/run.requested` event shape `{runId, organizationId}` matches between `startResearch` and `runResearchFn`.
