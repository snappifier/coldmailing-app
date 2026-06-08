# Phase 2d-2 — AI content writing (hook + placeholder fields) — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2d-2 of Phase 2 (2d = scoring + content;
2d-1 scoring is DONE). Builds on 2a (research-type config), 2b (per-lead engine), 2c (batch fan-out),
2d-1 (`kind` flag + lead-card editing of `aiHook`). **Implementation deferred to a fresh session**
(the session was long) — resume by reading this spec, run the writing-plans skill, then execute. Do NOT
re-brainstorm. **Not live-runnable until a funded `ANTHROPIC_API_KEY` exists** (see project memory).

## Goal

Generate personalized outreach content (`aiHook` and/or `customFields` placeholder values) per lead with
AI, as a research-type variant (`kind = CONTENT`). The content prompt receives a structured block of the
lead's **already-gathered research** so the model can reuse it; it decides for itself whether that
suffices or to refresh via web search (the existing per-type `webSearchEnabled` toggle). A full
per-lead email draft is OUT OF SCOPE here — that is a later sub-project (2d-3).

## Key decisions (from the brainstorm)

- **Produces:** hook (`aiHook`) and/or placeholder fields (`customFields`) — existing output targets. Full
  email draft deferred to 2d-3.
- **Entity:** research-type variant via `ResearchType.kind` extended to `RESEARCH | SCORING | CONTENT`.
- **Prior research access:** a structured "lead context" block is appended to the CONTENT prompt (NOT new
  render tokens) — safe, no risk of leaking internal notes/score into outbound customer emails. The model
  decides whether to also web-search (existing `webSearchEnabled`).
- **No score->content coupling, no new storage:** `aiHook` + `customFields` already exist and are editable.

## Data model (migration `phase2d2_content`)

Additive, enum-value only:
- `ResearchTypeKind` gains `CONTENT` (now `RESEARCH | SCORING | CONTENT`).

No new columns. `kind` already exists (2d-1); the content fields (`aiHook`, `customFields`) already exist.

## Prompt context block (the only real engine change)

- New pure module `features/research/lead-context.ts`: `buildLeadContextBlock(lead)` returns a plain-text
  block titled e.g. "Co już wiemy o tym leadzie:" listing only the **non-empty** fields among: `aiNotes`,
  `score`, `siteQuality`, `region`, `schoolType`, `contactRole`, `email`, `phone`, and each `customFields`
  entry (`key: value`). Returns an empty string when nothing is known. Pure + unit-tested; takes a typed
  subset object, not a Prisma model.
- `lib/inngest/research.ts` `runResearchFn`: when `researchType.kind === "CONTENT"`, append the context
  block to the rendered prompt before calling `runResearch`:
  `renderedPrompt = base + (kind === "CONTENT" && block ? "\n\n" + block : "")`.
  `kind` is read **live** from `run.researchType` (always loaded; the existing guard requires the type to
  exist). No `kind` snapshot field is added — so a `kind` edit mid-batch could change the injection
  decision for in-flight runs (very unlikely, low stakes; documented). RESEARCH/SCORING runs are
  unaffected (no block).
- "AI decides whether to refresh": no new mechanism — a CONTENT type with `webSearchEnabled` true gives the
  model `web_search`/`web_fetch`, which the existing system prompt already uses "w razie potrzeby". The
  context block gives it the prior research to prefer over re-searching.
- The block is sent only to Anthropic (the prompt), never to a customer email — that was the point of the
  safe choice (no new email-template tokens, no `RESERVED_KEYS` change).

## Config + validation (2a)

- `features/research-types/schema.ts`: extend the `kind` enum to include `CONTENT`. Add a refine: when
  `kind === "CONTENT"`, `outputFields` MUST include at least one field whose `target` is `aiHook` or
  `CUSTOM` (the content vehicles). RESEARCH and the existing SCORING refine are unchanged.
- `features/research-types/actions.ts`: no change (already persists `kind`).
- `app/(app)/badania/research-type-form.tsx`: add a `CONTENT` option to the `kind` selector ("Treść
  (CONTENT)") + a hint that a content type should output a hook (`aiHook`) and/or custom placeholder
  fields, and may enable web search to refresh research.
- `app/(app)/badania/page.tsx`: show a "Treść" badge for `CONTENT` types (alongside the "Ocena" badge).

## UX / reuse

- Editing content already exists: `aiHook` is editable on the lead card (2d-1) and `customFields` have
  their own editor. The diff/propose (AUTO fill-empty / MANUAL) + per-lead "Uruchom research" + batch
  "Badanie zbiorcze" all reuse 2b/2c unchanged. Net-new UI is only: the selector option, the `/badania`
  badge, and `[Treść]` prefixes in the run/batch pickers (`uruchom-research.tsx`,
  `batch-research-launcher.tsx`) — extend the existing `kind === "SCORING" ? "[Ocena] "` logic to also map
  `CONTENT -> "[Treść] "`.

## Modules / files

Pure (unit-tested):
- `features/research/lead-context.ts` — `buildLeadContextBlock`.
- `features/research-types/schema.ts` — `kind` enum += CONTENT + CONTENT refine.

Boundary / UI:
- `lib/inngest/research.ts` — append the context block for CONTENT runs.
- `app/(app)/badania/research-type-form.tsx`, `app/(app)/badania/page.tsx` — selector option + badge.
- `app/(app)/leady/[id]/uruchom-research.tsx`, `app/(app)/leady/batch-research-launcher.tsx` — `[Treść]`
  label (the picker `kind` prop already carries the value; just map the new case).
- `prisma/schema.prisma` — enum value.

## Testing

- `lead-context.test.ts` — omits empty fields; includes aiNotes/score/siteQuality when present; formats
  each `customFields` entry; empty input -> "".
- `schema.test.ts` — CONTENT without an aiHook/CUSTOM output -> rejected; CONTENT with an `aiHook` (or a
  CUSTOM) output -> accepted; SCORING/RESEARCH refines still hold.
- Re-run the 2b tests — `runResearchFn`/prompt change touches shared code (keep RESEARCH/SCORING behavior
  identical: no block).
- Gates: `tsc` 0, `vitest` green (existing 170 + new), `next build` green.

## Risks / notes

- The injection is gated on **live** `kind` (no snapshot) — a mid-batch `kind` edit changes the block
  decision for not-yet-run runs. Accepted (rare, low stakes); snapshot `kind` later if it ever matters.
- Content quality depends on prior research existing — run a RESEARCH type first, then CONTENT (the context
  block is empty for a bare lead, in which case the model relies on tokens + optional web search).
- Shared-engine change: `runResearchFn` + the prompt path are touched; RESEARCH/SCORING must stay
  behaviorally identical (block only for CONTENT) — covered by re-running 2b tests + the gate.
- Not live-run (no funded key); first real content run is deferred. AUTO fill-empty means a CONTENT run
  won't overwrite a manually-written `aiHook`; MANUAL proposes.
- 2d-3 (full email draft) will build on this: a per-lead draft model + sequence/sending integration.
