# Phase 2b — Research engine (single lead, on-demand) — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2b of Phase 2 (Research AI). Builds on 2a
(`ResearchType` config, `docs/superpowers/specs/2026-06-08-phase-2a-research-types-design.md`).

## Goal

Run ONE `ResearchType` on ONE lead via the Anthropic API (with optional web search), return structured
output shaped by the type's `outputFields`, and apply the values to the lead's fields. Triggered by an
"Uruchom research" button on the lead page. Runs **asynchronously via Inngest** (research is optimized
for depth/accuracy — long web-search runs would exceed server-action timeouts). The durable engine is
the foundation 2c (batch fan-out) and later features (target finding, potential scoring) reuse.

Scope is deliberately narrow: one type x one lead -> apply to fields. Batch, scoring, and content
generation are 2c/2d.

## What 2b consumes from 2a (the contract)

From `features/research-types/{schema,targets,queries}.ts` + the `ResearchType` model:
`name`, `prompt` (<=8000, `{{token}}` syntax), `outputFields` (Json: `{key,label,target,type,required,
description}[]`), `modelId` (nullable -> app default), `webSearchEnabled`. `target` is a `LEAD_TARGET`
(contactPersonName/contactRole/honorific/aiHook/aiNotes/siteQuality/priority/city/region/schoolType/
email) or `CUSTOM`. `derivedTypeForTarget`: honorific->GENDER, siteQuality/priority->NUMBER,
email->EMAIL, rest->TEXT, CUSTOM->null. `outputFields` is unversioned Json -> **re-validate
defensively** in 2b (a type may be hand-edited or authored under an older shape).

## Anthropic call shape (decision: unified `submit_findings` tool)

Verified via the claude-api skill (SDK `^0.100.1`): structured outputs (`output_config.format`) are
**incompatible with citations**, and the `web_search` server tool emits citations -> a single
`messages.create()` cannot do both. **Chosen mechanism (B):** one agentic loop with a strict custom
`submit_findings` tool whose `input_schema` is generated from `outputFields`, plus the `web_search`
(and `web_fetch`) server tools when `webSearchEnabled`. `strict: true` guarantees schema-valid tool
args. One code path works with or without web search (when off, the model just calls `submit_findings`
directly). Rejected: two-call research->extract (always two billable calls + lossy handoff) and
branch-by-config (a rarely-run no-web `parse()` path that would ship under-tested).

Engine boundary mirrors `features/replies/optout/llm.ts`: `import Anthropic from "@anthropic-ai/sdk"`,
guard `if (!process.env.ANTHROPIC_API_KEY)`, `new Anthropic()`, fail-safe `try/catch`.

Quality posture (the engine is built for accurate research): default model `claude-opus-4-8` when
`modelId` is null; `thinking: {type: "adaptive"}`; `output_config: {effort: "high"}`; tools
`[submit_findings(strict)] (+ [{type:"web_search_20260209"}, {type:"web_fetch_20260209"}] when
enabled)`; a manual agentic loop that continues on `stop_reason: "pause_turn"` (re-send with the
assistant turn appended so the server-tool loop resumes) and captures the `submit_findings` tool_use
input as the findings; generous `max_tokens` (stream if large). Optional `task_budget` (beta
`task-budgets-2026-03-13`) to bound cost. No `temperature`/`top_p`/`budget_tokens` (removed on 4.x).
Re-verify the exact tool-version strings + loop handling against the claude-api skill at build time.

## Data model (migration `phase2b_research_runs`)

```prisma
enum ResearchRunStatus { QUEUED RUNNING DONE FAILED }
enum ResearchApplyMode { AUTO MANUAL }

model ResearchRun {
	id               String            @id @default(cuid())
	organizationId   String
	leadId           String
	researchTypeId   String?           // SetNull: 2a hard-deletes types
	researchTypeName String            // snapshot for history
	modelId          String?           // resolved model actually used
	mode             ResearchApplyMode @default(AUTO)
	status           ResearchRunStatus @default(QUEUED)
	findings         Json?             // validated submit_findings output
	diff             Json?             // {applied, proposed, skipped} with before/after
	error            String?
	createdById      String?
	createdAt        DateTime          @default(now())
	updatedAt        DateTime          @updatedAt
	completedAt      DateTime?

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	lead         Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
	researchType ResearchType? @relation(fields: [researchTypeId], references: [id], onDelete: SetNull)
	createdBy    User?        @relation("ResearchRunCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@index([organizationId, leadId])
}
```

Back-relations: `Organization.researchRuns`, `Lead.researchRuns`, `ResearchType.runs`,
`User.researchRuns @relation("ResearchRunCreatedBy")`. Also `LeadActivityKind += RESEARCH` (log a
completed run on the lead timeline; cuttable but cheap and fits Phase 6 auditability).

`ResearchRun` serves double duty: async status surface (client polls it) AND the carrier of findings +
computed diff between the run and the optional manual-confirm step.

## Modules

Pure (zero next-auth / @anthropic-ai/sdk imports -> unit-testable):
- `features/research/schema-build.ts` - `outputFields[] -> submit_findings input_schema` (object,
  `additionalProperties:false`, `required[]` from `required:true`): TEXT->string, NUMBER->number,
  BOOLEAN->boolean, EMAIL->string`/email`, GENDER->`enum [PAN,PANI]` (the model returns the honorific
  directly), ENUM-without-options->plain string. Also exports field metadata the apply step needs.
- `features/research/apply.ts` - `computeApply(lead, findings, outputFields, mode) ->
  {applied, proposed, skipped, conflicts}`. Coercion per target: GENDER->PAN/PANI (normalize
  `male/m/mężczyzna/M`->PAN, `female/f/kobieta/K`->PANI, else null), siteQuality/priority **clamped
  1-5** (out-of-range or non-int -> skipped), email format-validated, NUMBER/BOOLEAN coerced from JSON,
  TEXT trimmed, CUSTOM -> `customFields[key]` **as string** (symmetry with `updateLead` + `render.ts`,
  which read `String(raw)`). `required:true` field returned null/empty -> skipped + reported.
  Mode: AUTO -> empty lead fields go to `applied`, already-set fields go to `proposed`; MANUAL ->
  everything goes to `proposed`. email is NEVER auto-applied if it would collide with another lead's
  unique `(organizationId,email)` -> always `skipped` with a flag (collision pre-checked in the
  action, which passes a `emailTaken` boolean in).
- `features/research/prompt.ts` - wraps `renderTemplate` (`features/templates/render.ts`) for the
  `ResearchType.prompt`; **strips** unresolved `missing` tokens rather than injecting `[brak: key]`
  into the LLM prompt; assembles `RenderContext` from a lead + the org's placeholders.
- `features/research/model.ts` - `resolveModel(modelId) = modelId ?? "claude-opus-4-8"`.
- `features/research/types.ts` - `ResearchFindings`, `AppliedField`, `ProposedField`, `SkippedField`,
  `ResearchDiff`, `ResearchResult`.

Boundary / orchestration:
- `features/research/engine.ts` - the only @anthropic-ai/sdk file. `runResearch({renderedPrompt,
  inputSchema, modelId, webSearchEnabled}) -> {ok, findings} | {ok:false, error}`. Builds the request,
  drives the agentic loop, returns the validated `submit_findings` input. Thin; delegates schema to
  schema-build.
- `lib/inngest/research.ts` - `runResearchHandler(runId, step)` (pure-ish, mirrors
  `runLeadSequenceHandler`): load run + type + lead (org-scoped), set RUNNING, render -> engine ->
  defensive-validate -> `computeApply` -> in AUTO persist `applied` (merge customFields, scoped
  `updateMany`), write findings+diff, set DONE (or FAILED + error); log a `RESEARCH` `LeadActivity`.
  `createFunction` wrapper registered in `app/api/inngest/route.ts`; `retries` set; concurrency keyed
  by org.
- `features/research/actions.ts` - `"use server"`: `startResearch(leadId, researchTypeId, mode)`
  (requireOrg, validate the type+lead are in-org, create `ResearchRun` QUEUED, emit
  `research/run.requested {runId}`, return `{ok, runId}`); `confirmResearchApply(runId)` (requireOrg,
  load run, persist its `proposed` fields after re-coercion + email pre-check, merge customFields,
  scoped `updateMany`, log activity, return `{ok}`); `getResearchRun(runId)` (org-scoped poll).
- `app/(app)/leady/[id]/uruchom-research.tsx` - `"use client"`: `ResearchType` picker + mode toggle
  (AUTO default / MANUAL) + "Uruchom research" button; polls `getResearchRun` while QUEUED/RUNNING;
  on DONE renders the diff (auto-applied + proposed-to-confirm + skipped-with-reason) and an "Zastosuj"
  button calling `confirmResearchApply`. Mechanics-first styling.

## Data flow

1. Click (type + mode) -> `startResearch` creates `ResearchRun` QUEUED, emits `research/run.requested`.
2. Inngest `runResearchHandler`: RUNNING -> render prompt -> `engine.runResearch` (web_search +
   submit_findings loop) -> defensive-validate findings against outputFields -> `computeApply`.
   AUTO: persist `applied` (customFields **merged** into existing, `updateMany {id,organizationId}`).
   MANUAL: persist nothing. Store `findings`+`diff`, set DONE; log `RESEARCH` activity.
3. Client polls `getResearchRun` -> on DONE shows the diff.
4. User clicks "Zastosuj" -> `confirmResearchApply` persists `proposed` (re-coerced, email pre-checked,
   customFields merged).

## Apply policy (locked)

- Mode toggle is a **per-run** choice in the UI (default AUTO). 2c batch will run AUTO unattended.
- AUTO: fill empty lead fields automatically; already-set fields become `proposed` (never silently
  overwritten - honorific is highest-stakes, it drives `{{a|b}}` template forms).
- MANUAL: nothing auto-applied; full diff shown for confirmation.
- email: never auto-applied over a colliding unique address; always `skipped` + flagged. Pre-check by
  querying for another in-org lead with that email before any write.
- customFields: **merge** into the lead's existing `customFields` (read -> merge -> write); values
  stored as strings. (`updateLead` replaces the whole object, so 2b must read-merge to avoid wiping
  other custom fields.)
- siteQuality/priority clamped 1-5 (no DB/Zod bound exists today); out-of-range -> skipped.

## Smaller decisions (locked)

- `required:true` -> in the schema `required[]` (model must emit) AND gates the write (null/empty ->
  skipped + reported).
- ENUM without options (2a allows it) -> emit a plain string (no allowed values to enforce); a richer
  ENUM-with-options is a possible later 2a enhancement, out of scope here.
- model gating: default `claude-opus-4-8`; the 2a picker's three models
  (`claude-haiku-4-5`/`claude-sonnet-4-6`/`claude-opus-4-8`) all support strict tool use.

## Error handling

Actions return `{ok}|{ok:false,error}` (never throw to the UI). Engine is fail-safe: missing
`ANTHROPIC_API_KEY`, API error, or an unparseable/invalid `submit_findings` payload -> the run is
marked FAILED with a readable `error`, surfaced on the lead page. Inngest `retries` cover transient API
failures; a terminal failure sets FAILED via the handler (guarded so it never stomps a DONE run).
email-collision on confirm -> that field stays skipped; the rest still apply.

## Testing

- `schema-build.test.ts` - type mapping (TEXT/NUMBER/BOOLEAN/EMAIL/GENDER/ENUM-no-options),
  `required[]` assembly, GENDER enum, additionalProperties:false.
- `apply.test.ts` - GENDER normalization (case/locale variants), siteQuality/priority clamp,
  email validation, NUMBER/BOOLEAN coercion, CUSTOM-as-string, customFields merge, AUTO vs MANUAL
  partitioning (empty->applied, set->proposed), required-missing->skipped, email-collision->skipped.
- `prompt.test.ts` - missing-token stripping; context assembly.
- `model.test.ts` - default fallback.
- Inngest handler covered by a mutation-proven integration test if practical (mirror
  `lib/inngest/sending.test.ts`); engine itself is mocked.
- Gates: `tsc` 0, `vitest` green (existing + new), `next build` green.

## Risks / notes

- **Mechanism correctness:** never send `web_search` + `output_config.format` in one call (400). The
  `submit_findings`-tool path with `strict:true` is what guarantees valid findings; without strict the
  loop can return malformed args that pass `tool_use` but fail apply.
- **customFields merge** (not replace) - else research wipes other custom fields. Keep values as
  strings to stay symmetric with the edit form + `render.ts`.
- **email** collision today is only caught post-write as a Prisma unique error returning a generic
  message; 2b pre-checks and skips instead, so other fields still apply.
- **honorific** normalization must handle `pan/Pani/male/F/kobieta` etc.; a low-confidence gender guess
  must not silently overwrite a manually-set honorific (hence AUTO -> proposed, not applied).
- **2a hard-deletes types**, so `ResearchRun.researchTypeId` is `onDelete: SetNull` + a
  `researchTypeName` snapshot preserves run history.
- **2c reuse:** `runResearchHandler` + the pure modules are the batch engine; 2c fans out
  `research/run.requested` events over many leads with AUTO mode + per-org concurrency/cost guards.
- **async moots the deploy-timeout risk** that a sync server action would have had with long
  web-search runs.
- `next-auth` 5 beta + this Next.js have breaking changes vs training data - verify server-action /
  Inngest idioms against `node_modules/next/dist/docs` and the existing `lib/inngest/*` before coding.
