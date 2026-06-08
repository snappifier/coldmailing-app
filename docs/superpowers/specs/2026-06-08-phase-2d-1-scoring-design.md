# Phase 2d-1 — Lead scoring / prioritization — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2d-1 of Phase 2 (2d = scoring + content
writing; **scoring first, content writing is 2d-2**). Builds on 2a (research-type config), 2b (per-lead
engine), 2c (batch fan-out). **Implementation deferred to a fresh session** (the brainstorm/spec session
was long) — resume by reading this spec, run the writing-plans skill, then execute. Do NOT re-brainstorm.

## Goal

Let the user evaluate a lead with AI against **separately-authored scoring instructions**, writing a
numeric `score` (0-100) and a `priority` (1-5) plus a reasoning, and surface those values in the UI
(list column + sort + filter, lead card, pipeline card) with a manual override. Scoring is a **variant
of a research type** (`kind = SCORING`); the 2b/2c engine runs it unchanged except for a new `score`
output target. No score->priority derivation: the AI returns both independently.

## Key decisions (from the brainstorm)

- **Mechanism:** AI-applied, user-authored evaluation instructions — i.e. a research type whose prompt
  is the scoring criteria.
- **Entity:** a research-type **variant** via a `kind` flag (`RESEARCH` | `SCORING`), NOT a separate
  entity. (Approach B.)
- **Output:** both `score` (0-100, new `Lead.score`) and `priority` (1-5, existing). AI returns both as
  separate output fields (no derivation). Reasoning convention = `aiNotes` (existing field).
- **UI:** full — lead card display + manual override; `/leady` Score column + sort + "min score" filter;
  `/pipeline` score badge.

## Data model (migration `phase2d_scoring`)

Additive only:
- `enum ResearchTypeKind { RESEARCH SCORING }`
- `ResearchType.kind ResearchTypeKind @default(RESEARCH)`
- `Lead.score Int?` // 0-100

`priority` (Int? 1-5), `aiNotes` (String?), `siteQuality` (Int? 1-5), `aiHook` (String?) already exist.
No new models, no other columns.

## Scoring as a research-type variant (2a config)

- `features/research-types/targets.ts`: add `score: "NUMBER"` to `LEAD_TARGETS` (so it becomes a
  selectable output target; `derivedTypeForTarget("score") === "NUMBER"`).
- `features/research-types/schema.ts` (`researchTypeSchema`): add `kind: z.enum(["RESEARCH","SCORING"])`
  with default `RESEARCH`. Add a cross-field refine: when `kind === "SCORING"`, the `outputFields` MUST
  include at least one field with `target === "score"` (priority is optional but recommended; surfaced as
  a hint, not enforced). `RESEARCH` types are unaffected.
- `features/research-types/actions.ts` (create/update): persist `kind`. `queries.ts` already returns the
  full row (kind included).
- `app/(app)/badania/research-type-form.tsx`: add a `kind` selector (Research / Ocena). When `SCORING`
  is selected, show a hint that an evaluation type should output `score` (0-100), optionally `priority`
  (1-5), and a reasoning (e.g. `aiNotes`). No auto-insertion of rows (keep the existing manual editor).
- `app/(app)/badania/page.tsx`: show a small "Ocena" badge next to `SCORING` types in the list.

## Engine (shared with 2b/2c — only the `score` target is new)

- `features/research/apply.ts`:
  - add `"score"` to `COLUMN_TARGETS`.
  - `coerce`: add a `case "score"` that parses a number and **clamps 0-100, rounds** (distinct from the
    `siteQuality`/`priority` 1-5 clamp).
  - `LeadFields` interface: add `score: number | null`. `currentFor` resolves `score` from `lead.score`.
- No change to `schema-build.ts` (NUMBER already maps to `{type:"number"}`; the 0-100 range is conveyed
  by the field's `description`, authored by the user).
- No change to `engine.ts`, `lib/inngest/research.ts`, `lib/inngest/research-batch.ts`, or the run/batch
  actions: a `SCORING` type is queued, run, and applied exactly like any research type (per-lead "Uruchom
  research" + batch "Badanie zbiorcze"). `kind` is a config/UX attribute and is NOT snapshotted onto the
  run/batch.
- **Apply semantics (unchanged, important):** AUTO fills only empty fields, so a manually-set `score`
  is preserved on a later AUTO re-score; MANUAL proposes (user confirms). This is exactly how the
  override coexists with re-scoring.

## Run/batch pickers (labels only)

- `app/(app)/leady/[id]/uruchom-research.tsx` and `app/(app)/leady/batch-research-launcher.tsx` list all
  research types; the page/queries pass `kind` so the picker can prefix/badge `SCORING` types as
  "[Ocena] ...". No behavioral change (the diff/proposed UI is generic over output fields and already
  renders `score`). This is a small display tweak; the `TypeOption` passed to those components gains
  `kind`.

## UI surfacing + manual override

### Lead card `/leady/[id]`
- `app/(app)/leady/[id]/page.tsx`: in the header (next to the "Etap" badge) add a read-only **score badge**
  (`Ocena: {score ?? "—"} / priorytet {priority ?? "—"}`). Pass `score`, `priority`, `siteQuality`,
  `aiHook`, `aiNotes` into `LeadEditForm`.
- `LeadEditForm` (`app/(app)/leady/[id]/lead-edit-form.tsx`): extend `Props.lead` with `score`,
  `priority`, `siteQuality`, `aiHook`, `aiNotes`; render editable inputs — `score` (number, min 0 max 100),
  `priority` (select 1-5 or number), `siteQuality` (select 1-5 or number), `aiHook` (text), `aiNotes`
  (textarea = the reasoning). This is the manual override.
- `features/leads/actions.ts` `updateLead`: parse the numeric/text scoring fields **separately** from the
  shared `leadFormSchema` (so `createLead`, which reuses `leadFormSchema`, is untouched — mirrors how
  `honorific` is parsed inline today). Extract a pure helper `parseScoreFields(formData)` ->
  `{score, priority, siteQuality, aiHook, aiNotes}` with: empty -> `null`; `score` clamped 0-100; `priority`
  and `siteQuality` clamped 1-5; non-numeric -> `null`. Add the parsed fields to the `updateMany` data.

### `/leady` list
- `app/(app)/leady/page.tsx`: add a **Score** column (show `lead.score ?? "—"`, optionally with priority).
  Add `sort=score` (orderBy `{score: {sort: "desc", nulls: "last"}}` -- Postgres defaults NULLS FIRST on
  DESC, so `nulls: "last"` is required to keep unscored leads at the bottom). Add a **min score** filter:
  a numeric input `minScore` in the filter form -> when set, `where.score = {gte: n}`. searchParams gains
  `minScore` (and `sort` already supports new value `score`).
- **Scope boundary:** `minScore` is for list display/triage only; it is NOT threaded into the
  `BatchResearchLauncher` criteria for v1 (that becomes useful for 2d-2 content batches — note as a future
  extension; `BatchCriteria`/`buildLeadWhere` stay `{offeringLineId, q}`).

### `/pipeline`
- `features/pipeline/queries.ts` `getPipelineLeads`: add `score: true` (and `priority: true` if not
  already implied) to the `select`; add `score` to the returned `PipelineLead`.
- `features/pipeline/types.ts`: add `score: number | null` to `PipelineLead`.
- `app/(app)/pipeline/card.tsx`: render a small score badge on the card.

## Modules / files

New / changed pure logic (unit-tested, no next-auth/SDK):
- `features/research/apply.ts` — `score` coercion (clamp 0-100) + COLUMN_TARGETS + LeadFields/currentFor.
- `features/research-types/targets.ts` — `score` target.
- `features/research-types/schema.ts` — `kind` + SCORING-requires-score refine.
- `features/leads/score-fields.ts` (new) — pure `parseScoreFields(formData)` (testable without next-auth).

Boundary / UI:
- `features/leads/actions.ts` — `updateLead` uses `parseScoreFields`.
- `features/research-types/actions.ts` — persist `kind`.
- `features/pipeline/queries.ts` + `types.ts` — `score`.
- UI: `research-type-form.tsx`, `badania/page.tsx`, `leady/page.tsx`, `leady/[id]/page.tsx`,
  `lead-edit-form.tsx`, `pipeline/card.tsx`, `uruchom-research.tsx`, `batch-research-launcher.tsx`.

## Testing

- `apply.test.ts` — `score` coercion: clamp 0/100 bounds, round, empty -> skip, AUTO fills empty `score`,
  MANUAL proposes `score`.
- `targets.test.ts` — `score` in `LEAD_TARGETS` + `derivedTypeForTarget("score") === "NUMBER"`.
- `schema.test.ts` — `kind` default `RESEARCH`; `SCORING` without a `score` output -> validation error;
  `SCORING` with a `score` output -> ok.
- `score-fields.test.ts` (new) — `parseScoreFields`: clamp 0-100 (score) / 1-5 (priority, siteQuality),
  empty -> null, non-numeric -> null, text fields trimmed/null.
- Gates: `tsc` 0, `vitest` green (existing 162 + new), `next build` green.

## Error handling / edge cases

- Scoring run failures reuse the 2b/2c paths (transient -> Inngest retry, permanent -> FAILED).
- A `SCORING` type with no `score` output is rejected at config time (Zod refine).
- Manual override writes directly; a subsequent AUTO scoring run will not overwrite a set `score`
  (fill-empty), and a MANUAL run proposes a new value for the user to accept/reject.
- `score` sort: use `orderBy {score: {sort: "desc", nulls: "last"}}` so unscored leads sort last (Postgres
  would otherwise put NULLs first on DESC); the column shows "—" for them.

## Risks / notes

- The `score` 0-100 vs `siteQuality`/`priority` 1-5 clamp split lives in one `coerce` switch — keep the
  ranges straight (covered by `apply.test.ts`).
- `kind` adds a small surface to 2a config + pickers; it is purely organizational (the `score` value is
  surfaced regardless of which type wrote it), so the risk of conceptual bloat is low and accepted.
- Not live-run: as with 2b/2c, the first real scoring run needs `ANTHROPIC_API_KEY`; smoke-test one lead
  before a batch.
- Forward hook for 2d-2 (content writing): the `minScore` filter + score field make "write outreach for
  leads with score >= N" a natural batch selection later.
