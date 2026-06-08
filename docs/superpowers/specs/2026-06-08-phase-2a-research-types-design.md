# Phase 2a — Research-type config (ResearchType CRUD) — Design

Date: 2026-06-08. Status: approved (brainstorm). Sub-project 2a of Phase 2 (Research AI).

## Goal

Make research prompts/types **in-app, user-editable data** instead of hand-authored code. 2a is the
foundation: an org-scoped `ResearchType` model plus a CRUD section at `/badania`, mirroring
`/placeholdery` and `/szablony`. 2a is **data-entry only** — no Anthropic API calls, no Inngest, no
research runs. Those arrive in 2b (single-lead engine), 2c (batch), 2d (scoring/content).

A `ResearchType` carries everything 2b needs to run later: the `prompt`, an `outputFields` contract
(what JSON the model must return and where each value lands on the Lead), the `modelId`, and a
`webSearchEnabled` flag.

## Scope

In scope (2a):
- Prisma model `ResearchType` (+ migration `phase2a_research_types`).
- Pure mapping module `features/research-types/targets.ts` (allow-listed Lead targets + derived types).
- Pure Zod validation `features/research-types/schema.ts` (unit-tested).
- `use server` actions `features/research-types/actions.ts` (create / update / delete).
- Read queries `features/research-types/queries.ts`.
- Pages: `/badania` (list + delete), `/badania/nowy` (create), `/badania/[id]` (edit); nav link.
- Client editor `research-type-form.tsx` (variant B: card-per-output-field).

Out of scope (later phases): any API call, structured-output schema generation, web search, batch
runs, scoring. Versioning/snapshots (2c handles run reproducibility). Per-offering-line scoping.
Full visual polish (Phase 7).

## Data model

```prisma
model ResearchType {
	id               String   @id @default(cuid())
	organizationId   String
	name             String
	prompt           String
	outputFields     Json     // OutputField[] (see below)
	modelId          String?  // null -> app/org default, resolved in 2b
	webSearchEnabled Boolean  @default(false)
	createdById      String?
	createdAt        DateTime @default(now())
	updatedAt        DateTime @updatedAt

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	createdBy    User?        @relation("ResearchTypeCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

	@@unique([organizationId, name])
}
```

Back-relations added: `Organization.researchTypes ResearchType[]`,
`User.researchTypes ResearchType[] @relation("ResearchTypeCreatedBy")`.

`target`/`type` are **not** Prisma enums — they live as strings inside `outputFields Json`, validated
by Zod. This keeps the migration to a single new table (no `CREATE TYPE`).

### OutputField (element of `outputFields`)

```ts
interface OutputField {
	key: string          // slug, unique within the type; matches /^[A-Za-z][A-Za-z0-9]*$/
	label: string        // display label
	target: TargetField  // a Lead column from the allow-list, or "CUSTOM"
	type: FieldType       // TEXT | NUMBER | BOOLEAN | EMAIL | ENUM | GENDER
	required: boolean
	description: string | null  // optional hint for the AI (used by 2b)
}
```

## Lead-field mapping (the allow-list)

Defined once in `features/research-types/targets.ts` as the single source of truth (pure module,
imports nothing but is importable by schema.ts now and 2b later):

| target (Lead column) | derived type | notes |
|---|---|---|
| `contactPersonName` | TEXT | |
| `contactRole` | TEXT | |
| `honorific` | GENDER | model returns gender; 2b coerces -> PAN/PANI enum |
| `aiHook` | TEXT | |
| `aiNotes` | TEXT | |
| `siteQuality` | NUMBER | UI/2b bound 1-5 |
| `priority` | NUMBER | UI/2b bound 1-5 |
| `city` | TEXT | |
| `region` | TEXT | |
| `schoolType` | TEXT | |
| `email` | EMAIL | special: writable, but org-unique (`@@unique([organizationId, email])`); collision is checked at apply time in 2b, not 2a |
| `CUSTOM` | (user picks) | value lands in `Lead.customFields[key]`; type chosen from TEXT/NUMBER/BOOLEAN/EMAIL/ENUM |

Forbidden as targets (must fail validation): `dealStage` (immutable `LeadActivity` STAGE_CHANGE audit
trail) and any Lead column not on the allow-list above.

When `target` is a known column, its `type` is **derived and locked** (the editor shows it read-only).
When `target` is `CUSTOM`, the user picks the `type` (anything except `GENDER`, which only makes sense
for `honorific`).

## Validation rules (Zod, `schema.ts`)

`researchTypeSchema` validates a plain object (the action adapts FormData -> object first, so the
schema stays pure and unit-testable):

- `name`: trimmed, 1..120.
- `prompt`: trimmed, 1..8000.
- `modelId`: trimmed, optional, max 80, empty -> null.
- `webSearchEnabled`: boolean (default false).
- `outputFields`: array, min 1 ("Dodaj co najmniej jedno pole wyjściowe").

Per output field:
- `key`: trimmed, 1..40, regex `/^[A-Za-z][A-Za-z0-9]*$/` (same as Placeholder).
- `label`: trimmed, 1..80.
- `target`: enum of the allow-list keys + `"CUSTOM"`.
- `type`: enum `TEXT|NUMBER|BOOLEAN|EMAIL|ENUM|GENDER`.
- `required`: boolean (default false).
- `description`: trimmed, optional, max 300, empty -> null.
- refine: if `target` is a known column, `type` must equal its derived type
  (`type-niezgodny-z-celem`). If `target === "CUSTOM"`, `type` must be in
  `TEXT|NUMBER|BOOLEAN|EMAIL|ENUM` (GENDER forbidden for CUSTOM).
- refine: `CUSTOM` `key` must not collide with reserved placeholder keys
  (`nazwaPlacowki, osoba, miasto, www, hookAI, zwrot, podpisNadawcy`) — reuse the same reserved set as
  placeholders to avoid a custom field silently shadowing a builtin token in `render.ts`.

Across the array:
- refine: `key`s are unique within the type ("Klucze pól muszą być unikalne").
- refine: each non-`CUSTOM` `target` is used at most once (two fields writing the same Lead column is
  ambiguous) ("Każde pole Lead można zmapować tylko raz").

## Architecture / components

Mirror the Placeholder stack exactly:

- `features/research-types/targets.ts` — pure: `LEAD_TARGETS` map (column -> derived type),
  `TARGET_FIELDS` list, `CUSTOM_TYPES`, `RESERVED_KEYS`, helper `derivedTypeForTarget(target)`.
- `features/research-types/schema.ts` — pure Zod (imports only `zod` + `targets.ts`). Exports
  `researchTypeSchema` + `ResearchTypeInput` + `OutputField` type.
- `features/research-types/actions.ts` — `"use server"`, only async exports, `requireOrg()` at the top
  of each. `createResearchType` / `updateResearchType(id, ...)` / `deleteResearchType(id)`. Adapt
  FormData -> object (JSON.parse `outputFields`, coerce `webSearchEnabled`), `safeParse`, return
  `{ok:false,error}` on failure, try/catch the unique-name DB error -> "Typ researchu o tej nazwie już
  istnieje", `revalidatePath("/badania")`, and return `{ok:true}` on create/update success. The client
  form navigates to `/badania` via `useRouter().push` in an effect watching the `{ok:true}` result
  (no existing action in this codebase uses `redirect()`; client navigation avoids a Next-version
  redirect-in-action quirk while keeping `useActionState` for inline error display).
- `features/research-types/queries.ts` — `listResearchTypes(orgId)`, `getResearchType(orgId, id)`,
  org-scoped on every call.
- `app/(app)/badania/page.tsx` — server: list (name, output-field count, model, web-search badge),
  "Nowy typ" link, per-row edit link + delete form.
- `app/(app)/badania/nowy/page.tsx` — create: `<ResearchTypeForm action={createResearchType} />`.
- `app/(app)/badania/[id]/page.tsx` — edit: load via `getResearchType`, 404 if missing/other-org,
  `<ResearchTypeForm action={updateResearchType.bind(null, id)} initial={...} />`.
- `app/(app)/badania/research-type-form.tsx` — `"use client"`: holds name/prompt/modelId/webSearch +
  `outputFields[]` state; card-per-field (variant B); target select derives+locks type, CUSTOM unlocks
  type; add/remove field; serializes `outputFields` to a hidden JSON input on submit; `useActionState`
  for error display. `modelId` is a curated `<select>` (empty = domyślny;
  `claude-haiku-4-5` / `claude-sonnet-4-6` / `claude-opus-4-8`).
- nav: add `<Link href="/badania">Badania</Link>` to `app/(app)/layout.tsx`.

## Data flow

1. User fills the form at `/badania/nowy` (or `/badania/[id]`).
2. Client serializes `outputFields` to JSON (hidden input) + scalar fields; posts to the bound action.
3. Action `requireOrg()` -> adapt FormData -> `researchTypeSchema.safeParse` -> on success
   `prisma.researchType.create/update` (org-scoped) -> `revalidatePath("/badania")` + return
   `{ok:true}`; the client form then `router.push("/badania")`.
4. 2b (future) reads a `ResearchType`, renders `prompt` per lead via the `{{token}}` engine in
   `features/templates/render.ts`, asks Anthropic for structured output shaped by `outputFields`, then
   coerces + writes each value to its `target` Lead column (or `customFields[key]`).

## Error handling

Actions never throw to the user; they return `{ok:false,error}` for: empty/oversized name or prompt,
zero output fields, bad/duplicate `key`, disallowed `target`, `type` mismatched with `target`, reserved
CUSTOM key, duplicate Lead-column target. Duplicate **name** is caught from the DB unique violation.
The edit page returns Next `notFound()` for a missing or other-org id. Delete is the safe
`deleteMany({where:{id, organizationId:orgId}})` idiom (no-op cross-org).

## Decisions (locked in brainstorm)

- **Storage:** `outputFields` is a flat `Json` array on the model (mirrors `Placeholder.options`); no
  separate `OutputField` table.
- **Versioning:** none in 2a; definitions are mutable. 2c will snapshot the definition at queue time
  for run reproducibility (noted for the 2c spec).
- **Deletion:** hard delete (Placeholder pattern); nothing references a `ResearchType` in 2a.
- **Permissions/visibility:** org-wide, any member CRUD (like Placeholders/Templates); no per-user
  visibility.
- **Prompt:** plain text in 2a (only stored). Rendered per-lead in 2b via the existing `{{token}}`
  engine; the form may show available tokens as a hint but does no rendering.
- **Model IDs:** curated dropdown. 2a only stores the string; **2b** (which actually calls the API)
  must consult the claude-api skill to resolve/validate the current model id.
- **Naming:** Prisma model `ResearchType`; route `/badania`; nav label "Badania".

## Testing

- `features/research-types/targets.test.ts` — derived-type lookups, allow-list membership, CUSTOM has
  no derived type.
- `features/research-types/schema.test.ts` — vitest, pure: valid full type parses + defaults
  (description/modelId null, required default false); rejects zero output fields; rejects bad key
  regex; rejects reserved CUSTOM key; rejects a forbidden target (`dealStage`); rejects type mismatched
  with a known target; rejects GENDER on a CUSTOM field; rejects duplicate keys; rejects the same
  non-CUSTOM target used twice; accepts the example "Licea" type (contactPersonName/honorific/email/
  siteQuality).

Gates: `npx tsc --noEmit` 0, `npx vitest run` green (existing 99 + new), `next build` green
(`/badania`, `/badania/nowy`, `/badania/[id]` in the route list).

## Risks / notes

- `actions.ts` may export only async functions — all validation lives in `schema.ts`/`targets.ts`
  (the documented Phase 4 `validateActivation` reason: keep unit tests off the next-auth import chain).
- `customFields` is untyped `Json` whose existing UI coerces values to strings; CUSTOM NUMBER/BOOLEAN
  outputs are a 2b apply-time concern, not 2a.
- `siteQuality`/`priority` are unbounded `Int` in the DB; the 1-5 bound is enforced in the UI/2b, not
  the schema.
- Prisma client import path is `@/generated/prisma/client`; run `npx prisma migrate dev
  --name phase2a_research_types` (regenerates the client) before tsc/tests. Stop the dev server first
  if client regeneration is locked on Windows.
- `next-auth` is 5.0.0-beta.31 and this Next.js has breaking changes vs training data — verify
  server-action / `redirect` / `revalidatePath` idioms against `node_modules/next/dist/docs` before
  writing.
