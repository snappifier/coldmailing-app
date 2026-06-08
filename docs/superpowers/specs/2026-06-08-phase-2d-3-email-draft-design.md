# Phase 2d-3 — Per-lead AI email draft (generation + edit) — Design

Date: 2026-06-08. Status: approved autonomously (user AFK, "rób automatycznie" — decisions made on
sensible defaults and documented here; see project memory [[autonomous-execution-when-afk]]). Sub-project
2d-3 of Phase 2. Builds on 2a/2b (engine), 2d-1 (`kind` flag), 2d-2 (`buildLeadContextBlock`, controlled
kind form). **Not live-runnable** until a funded `ANTHROPIC_API_KEY` (see [[no-funded-anthropic-key-yet]]).

## Goal

Generate a full personalized email **draft (subject + body)** per lead with AI, store it, and let the
user view/edit it on the lead page. Generation is configured as a research-type variant `kind = DRAFT`
(prompt = copywriting instructions); the model gets the lead's prior-research context block and may
web-search. Reuses the existing `runResearch` Anthropic boundary unchanged except one additive optional
`system` override.

## Scope decision (autonomous, documented)

**This phase is deliberately additive and isolated** so it cannot regress the verified, live-tested
sending path (Phase 4/5) or the verified research run/batch engine:
- It does NOT modify `runResearchFn`, the batch orchestrator, the sending worker (`runLeadSequence`), or
  the existing per-lead run UI.
- **Using a draft when sending is OUT OF SCOPE — deferred to 2d-4.** 2d-3 delivers generation + storage +
  edit only. The draft is visible/editable on the lead card; wiring it into a campaign/step is the next
  slice.
- **Batch draft generation is OUT OF SCOPE** (single-lead only here; batch is a later add, mirroring 2c).

## Data model (migration `phase2d3_drafts`)

```prisma
enum DraftStatus { QUEUED RUNNING DONE FAILED }

model LeadDraft {
	id             String      @id @default(cuid())
	organizationId String
	leadId         String
	subject        String      @default("")
	body           String      @default("")
	status         DraftStatus @default(QUEUED)
	error          String?
	sourceTypeId   String?     // ResearchType, SetNull
	sourceTypeName String      // snapshot
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

One draft per lead (the `@@unique` enforces it; upsert on regenerate). Back-relations:
`Organization.leadDrafts LeadDraft[]`, `Lead.drafts LeadDraft[]`, `User.leadDrafts LeadDraft[] @relation("LeadDraftCreatedBy")`,
`ResearchType.drafts LeadDraft[]`. `ResearchTypeKind += DRAFT`.

## Engine reuse (one tiny additive change)

- Pure `features/research/draft.ts`:
  - `buildDraftSchema()` -> fixed JSON schema `{type:"object", additionalProperties:false, properties:{subject:{type:"string"}, body:{type:"string"}}, required:["subject","body"]}`.
  - `coerceDraft(findings)` -> `{ok:true, subject, body}` (trimmed) when both non-empty, else `{ok:false}`.
- `features/research/engine.ts` `runResearch`: add an optional `system?: string` to `RunArgs`, defaulting
  to the current `SYSTEM`. No behavior change for existing callers (they omit it). Drafts pass a
  copywriting system prompt: "Jesteś copywriterem B2B. Napisz zwięzłego, spersonalizowanego maila (temat
  + treść) ... zwróć wynik przez narzędzie (pola subject, body); nie zmyślaj faktów."
- Draft generation calls the SAME `runResearch` with `inputSchema = buildDraftSchema()` -> `findings =
  {subject, body}`. No new engine/agentic loop.

## Orchestration (new, isolated)

- `lib/inngest/draft.ts` `runDraftFn` (event `research/draft.requested {draftId, organizationId}`,
  `concurrency {limit:3,key:event.data.organizationId}`, `retries:3`, `onFailure` marks the draft FAILED):
  load `LeadDraft` (org-scoped via the event orgId) + its `lead` + `sourceType`; guard
  type-exists/kind===DRAFT/org-match (FAILED + return on mismatch); `step.run("mark-running")`; build the
  prompt = `buildResearchPrompt(sourceType.prompt, leadToRenderContext(lead,"",placeholders))` + "\n\n" +
  `buildLeadContextBlock(lead)`; `step.run("anthropic")` = `runResearch({renderedPrompt, inputSchema:
  buildDraftSchema(), modelId: sourceType.modelId, webSearchEnabled: sourceType.webSearchEnabled, system:
  DRAFT_SYSTEM})`; on `{ok:false}` -> FAILED; on transient throw -> bubble (Inngest retry); on ok ->
  `coerceDraft` -> if ok upsert `LeadDraft {subject, body, status:DONE}` else FAILED ("pusty draft").
  Register in `app/api/inngest/route.ts`. Mirrors `runResearchFn` but writes `LeadDraft` (does not touch
  `runResearchFn`).

## Actions

`features/research/draft-actions.ts` ("use server", org-scoped, `{ok,error}`):
- `startDraft(leadId, draftTypeId)`: validate lead + type (org-scoped, `kind === "DRAFT"`); upsert
  `LeadDraft` (status QUEUED, subject/body kept if re-running, `sourceTypeId`/`sourceTypeName` snapshot,
  `createdById`); emit `research/draft.requested {draftId, organizationId}`; return `{ok, draftId}`.
- `getDraft(leadId)`: the lead's draft (org-scoped) — for polling (status/subject/body/error).
- `saveDraft(leadId, subject, body)`: manual override — upsert subject/body, status DONE; org-scoped;
  `revalidatePath`.

## UI

- `app/(app)/leady/[id]/draft-panel.tsx` ("use client"): a "Draft maila (AI)" panel — DRAFT-type picker +
  "Generuj draft" -> `startDraft` -> poll `getDraft` every 2s -> show status; when DONE render editable
  `subject` input + `body` textarea + "Zapisz" (`saveDraft`). Empty-state when no draft + no DRAFT types
  ("Dodaj typ Draft w Badania").
- `app/(app)/leady/[id]/page.tsx`: fetch the lead's draft + DRAFT-kind types; render `<DraftPanel>` in the
  right column (near `UruchomResearch`). Pass only `kind === "DRAFT"` types to the panel; pass only
  `kind !== "DRAFT"` types to `UruchomResearch` (DRAFT types produce no field diff).
- `app/(app)/leady/page.tsx`: the batch launcher excludes DRAFT types (no batch draft yet) — filter
  `kind !== "DRAFT"`.
- `app/(app)/badania/research-type-form.tsx`: add a "Draft maila (DRAFT)" option to the kind selector +
  a per-kind hint; **hide the output-fields editor when kind === DRAFT** (drafts produce subject+body, not
  output fields).
- `app/(app)/badania/page.tsx`: "Draft" badge for DRAFT types.

## Config / validation

- `features/research-types/schema.ts`: `kind` enum += `DRAFT`. Relax `outputFields` so it is **not
  required for DRAFT**: change `outputFields: z.array(outputFieldSchema).min(1, ...)` to
  `z.array(outputFieldSchema).default([])` and add a refine "non-DRAFT requires >= 1 output field"
  (`d.kind === "DRAFT" || d.outputFields.length >= 1`). The existing SCORING/CONTENT refines already gate
  on their kinds, so they don't fire for DRAFT. The per-field + unique-key + one-target-each refines hold
  vacuously for an empty array.
- `features/research-types/actions.ts`: no change (already persists `kind`, `outputFields`).

## Modules / files

Pure (unit-tested): `features/research/draft.ts` (`buildDraftSchema`, `coerceDraft`);
`features/research-types/schema.ts` (DRAFT relax + refine).
Boundary: `features/research/engine.ts` (optional `system`); `features/research/draft-actions.ts`;
`lib/inngest/draft.ts`; `app/api/inngest/route.ts` (register).
UI: `draft-panel.tsx`, `leady/[id]/page.tsx`, `leady/page.tsx`, `research-type-form.tsx`, `badania/page.tsx`.
Schema/migration: `prisma/schema.prisma`.

## Testing

- `draft.test.ts` — `buildDraftSchema` shape (subject+body required, additionalProperties false);
  `coerceDraft` trims, rejects empty/whitespace subject or body, accepts valid.
- `schema.test.ts` — a DRAFT type with empty `outputFields` is accepted; a RESEARCH type with empty
  `outputFields` is rejected; DRAFT still needs a prompt.
- Re-run existing suites (the engine `system` param + schema change touch shared code; RESEARCH/SCORING/
  CONTENT must stay identical).
- Gates: `tsc` 0, `vitest` green (176 + new), `next build` green (`/leady/[id]` route unchanged).

## Error handling / risks

- Transient Anthropic errors retry (Inngest); permanent -> draft FAILED; empty draft -> FAILED.
- DRAFT type deleted mid-run -> guard fails the draft (mirrors runResearchFn).
- The engine `system` param is additive + defaulted — existing research/scoring/content runs unaffected
  (covered by re-running the suite).
- Isolation: no change to `runResearchFn`, batch orchestrator, or sending — the verified paths are
  untouched. Sending integration (use the draft) is explicitly **2d-4**.
- No funded key: first real draft is deferred; the generation path is exercised by the suite (pure parts)
  + tsc/build (boundary).
- `saveDraft`/`startDraft` race: regenerate while editing overwrites — acceptable (single-user tool).
