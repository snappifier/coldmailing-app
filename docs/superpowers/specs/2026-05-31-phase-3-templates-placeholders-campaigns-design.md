# Phase 3: Templates + Placeholders + Campaigns — Design

- Date: 2026-05-31
- Repo: `coldmailing-app`
- Status: Approved in brainstorm, pending written-spec review
- Builds on: Phase 0 + 1 (auth, org scoping, leads, offering lines, suppression — all shipped and verified)

## 1. Purpose & scope

Phase 3 adds the message layer: a shared team **template library**, a user-extensible **placeholder system** (insert via buttons, resolved per lead — including Pan/Pani and gendered Polish forms), and **campaigns** built from **sequences** of templates with per-step delays, plus assigning leads to a campaign.

This phase is **definition and management only**. There is no email sending, no mailbox connection, no reply detection, and no real schedule execution — those are Phase 4-5. Everything here is fully clickable and verifiable without a mailbox.

User directives carried in:
- Build the **whole** of Phase 3 in one cycle (not split).
- Mechanics-first: minimal/raw Tailwind UI, no design system; visual polish is a later phase.
- Conventions identical to the rest of the repo (tabs, no semicolons, path comment, `import {x}` no spaces, no emoji, `z.email()` not `z.string().email()`).
- Per the standing rule: verify current library versions/best practices in docs before writing code that uses them.

## 2. Data model additions (new Prisma migration)

These entities do not yet exist in the schema. All are scoped by `organizationId` and follow the existing model conventions (`cuid()` ids, `createdAt`/`updatedAt`).

New enums:
- `TemplateVisibility { TEAM, PRIVATE }`
- `PlaceholderType { TEXT, CHOICE }`
- `CampaignStatus { DRAFT, ACTIVE, PAUSED, DONE }`
- `SequenceCondition { ALWAYS, SEND_IF_NO_REPLY }`
- `CampaignLeadStatus { PENDING, ACTIVE, REPLIED, BOUNCED, UNSUBSCRIBED, DONE }`

Models:
- **Template** — shared team library entry:
  `organizationId`, `name`, `subject`, `body` (with `{{tokens}}`), `isFollowup: Boolean` (default false),
  `offeringLineId: String?` (onDelete SetNull), `visibility: TemplateVisibility` (default TEAM),
  `folder: String?`, `createdById`. Index `[organizationId]`.
- **Placeholder** — org-scoped custom variable:
  `organizationId`, `key` (token name, e.g. `branza`), `label`, `type: PlaceholderType`,
  `options: Json?` (for CHOICE, e.g. `["Pan","Pani"]`), `fallback: String?`,
  `source: String?` (which `lead.customFields` key or lead field it reads from; defaults to `key`),
  `createdById`. `@@unique([organizationId, key])`.
- **Campaign** — `organizationId`, `offeringLineId: String?` (onDelete SetNull), `name`,
  `status: CampaignStatus` (default DRAFT), `createdById`. Sending-related fields are added in Phase 4.
  `@@unique([organizationId, name])`.
- **SequenceStep** — `campaignId` (onDelete Cascade), `order: Int`, `templateId` (onDelete Restrict),
  `delayDays: Int` (default 0; days after the previous step / after enrollment for step 0),
  `condition: SequenceCondition` (default SEND_IF_NO_REPLY; first step typically ALWAYS).
  `@@unique([campaignId, order])`.
- **CampaignLead** — membership + per-campaign state:
  `campaignId` (onDelete Cascade), `leadId` (onDelete Cascade),
  `status: CampaignLeadStatus` (default PENDING), `currentStep: Int` (default 0), `nextSendAt: DateTime?`.
  `@@unique([campaignId, leadId])`. In Phase 3 only PENDING is written; sending sets the rest.

`Lead` already has `customFields: Json?` and `honorific: Honorific?` from Phase 1 — used by the placeholder resolver. No `Lead` change required (custom placeholder values live in `customFields`).

## 3. Placeholder system

### Token syntax
- **Named token**: `{{key}}` (whitespace-tolerant: `{{ key }}`). `key` is a built-in or a custom placeholder.
- **Gendered token**: `{{masculine|feminine}}` — contains a `|`. Resolved by the lead's `honorific`:
  `PAN` -> first form, `PANI` -> second form. Example: `{{Szanowny|Szanowna}}`, `{{Drogi|Droga}}`.

### Built-in placeholders (always available)
Resolved from `Lead` fields (and session for the signature):

| Token | Source |
|---|---|
| `{{nazwaPlacowki}}` | `lead.organizationName` |
| `{{osoba}}` | `lead.contactPersonName` |
| `{{miasto}}` | `lead.city` |
| `{{www}}` | `lead.website` |
| `{{hookAI}}` | `lead.aiHook` |
| `{{zwrot}}` | `lead.honorific` -> "Pan" / "Pani" |
| `{{podpisNadawcy}}` | acting user's `name` (a per-org signature setting can replace this later) |

### Custom placeholders
User-defined in the UI (`Placeholder` model). Resolution: read `lead.customFields[source ?? key]`;
if missing, use `fallback`; if still missing, treat as unresolved. `CHOICE` placeholders carry `options`
for editor hints/validation but resolve to the stored value the same way.

In Phase 3, custom-placeholder values (and `honorific`, which drives `{{zwrot}}` and gendered tokens) are
populated **manually** via a lead edit form that **this phase adds** — Phase 1 shipped only create +
delete, and the manual create form does not even cover `honorific`. So Phase 3 introduces `updateLead`
plus a minimal lead edit UI covering the standard fields, `honorific`, and a simple key/value
`customFields` editor. Populating these from CSV import (column -> customFields) and from AI research is
deferred to those phases (`honorific` itself is already importable via the Phase 1 column mapping).

### Resolution result
`TemplateRenderer.render(text, {lead, senderName, placeholders})` returns
`{ rendered: string, missing: string[] }`:
- Each named token resolves to its value; if a placeholder/field has no value and no fallback, the token
  is left as a visible marker (e.g. `[brak: key]`) and its key is added to `missing`.
- Gendered tokens with a known `honorific` resolve; with `honorific == null` they are added to `missing`
  (and rendered as the masculine form as a visible best-effort, clearly flagged in the UI).
- Unknown tokens (no matching built-in or custom placeholder) are added to `missing`.

### Editor UX
- Subject + body are plain `<textarea>`s (mechanics-first; rich editor is a later phase).
- A **palette of buttons** (built-in + custom + a "forma zależna od płci" inserter) inserts the token at
  the cursor position.
- **Live preview** renders subject + body against a chosen sample lead (default: first lead in the org),
  showing resolved text and a list of unresolved/missing tokens.
- **Pre-send-style validation** (used here for the preview, reused by sending later): given a set of
  leads, report which leads have unresolved required tokens.

## 4. Modules / boundaries

- `features/templates/render.ts` — **pure** `TemplateRenderer` (tokenize, resolve named + gendered tokens,
  collect missing). No DB, no React. **TDD** — this is the testable core.
- `features/templates/schema.ts` — Zod schemas (template, placeholder).
- `features/templates/actions.ts` — template CRUD (org-scoped).
- `features/placeholders/actions.ts` — placeholder CRUD (org-scoped).
- `features/campaigns/schema.ts`, `features/campaigns/actions.ts` — campaign + sequence-step CRUD,
  lead assignment (create `CampaignLead` rows), all org-scoped via `requireOrg`.
- `features/leads/actions.ts` — add `updateLead` (org-scoped: standard fields + `honorific` +
  `customFields`); minimal lead edit UI at `app/(app)/leady/[id]` so the data templates resolve can be
  entered by hand (Phase 1 shipped only create + delete).
- UI under `app/(app)/szablony`, `app/(app)/placeholdery` (or a section within szablony),
  `app/(app)/kampanie` — server components + small client components using `useActionState`.

Each server action calls `requireOrg()` and scopes every query by `organizationId`. Deletes use
`deleteMany({where: {id, organizationId}})` (tenant-safe no-op on foreign ids) and return `Promise<void>`
when used as bound form actions (matching the Phase 0+1 pattern).

## 5. Templates / campaigns UI behavior

- **Templates**: list (filter by offering line / folder), create/edit (name, subject, body, isFollowup,
  visibility, optional line/folder), delete. Editor includes the placeholder palette + live preview.
- **Placeholders**: list + create/edit/delete custom placeholders (key, label, type, options for CHOICE,
  fallback, source).
- **Campaigns**: create campaign (name, optional offering line, status). Build the sequence: ordered steps,
  each picking a template + `delayDays` + `condition`. Assign leads: filter/select leads -> add ->
  creates `CampaignLead` (status PENDING). Show a read-only "co i kiedy poszłoby" timeline derived from the
  steps (no actual scheduling).
- **Lead edit**: a minimal edit page per lead (standard fields + `honorific` Pan/Pani + a key/value
  `customFields` editor), so the values that templates resolve can be entered manually.

## 6. Testing

- **TDD (unit, Vitest)** for `TemplateRenderer`: named tokens, gendered tokens by honorific (PAN/PANI/null),
  custom placeholder via `customFields` + fallback, unknown-token collection, whitespace tolerance,
  multiple occurrences. Also Zod schema tests for template/placeholder validation.
- **Manual/runtime verification** (against the real DB, as in Phase 0+1) for CRUD + UI flows + preview,
  plus `npx tsc --noEmit`, `npx vitest run`, and a production `next build`.

## 7. Out of scope (Phase 4-5+)

Mailbox connection (Google OAuth), Gmail API sending, the Inngest sending engine and real schedule
execution, reply detection / stop-on-reply, bounce + unsubscribe handling, open/click tracking,
import-column -> `customFields` mapping, AI research populating placeholders, and the full visual design pass.

## 8. Open questions / deferred

- Per-org sender signature setting (vs. acting user's name for `{{podpisNadawcy}}`) — use the user's name
  for now; add a setting later.
- Folders vs tags for template organization — start with a single optional `folder` string.
- `PRIVATE` template visibility is modeled now but the UI may surface it minimally; full per-user private
  views can be refined later.
