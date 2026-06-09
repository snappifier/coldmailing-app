# Phase 7 — page-level-visual-pass — Design

Date: 2026-06-09. Status: spec ready (design approved via visual choice). Sub-project #9 (build order, LAST) of
Phase 7. High-taste, L/XL. **Implementation deferred to a FRESH session** (per the split-spec/implement convention
+ the user's request: "przygotuj porównanie i wykonasz w nowej sesji"). Depends on `design-foundation`
(primitives + tokens) and the now-complete shell. Grounded by the `page-level-visual-audit` workflow (2026-06-09).
Visual references: `docs/superpowers/design/polish-mock/index.html` (before/after direction) +
`docs/superpowers/design/list-style-mock/index.html` (list style).

## Goal

Bring every app surface up to the design-foundation bar: adopt the `components/ui/*` primitives everywhere (no more
hand-rolled `rounded border border-border px-2 py-1` raw elements), translate every leaked DB-enum string to a
friendly Polish label (via shared maps + the `Badge` primitive), and fix copy inconsistencies (English/jargon
leaks, code-identifier leaks). Dark-correctness is already done (dark-ready migration); this is the deeper polish.

## Approved direction (from the visual choices)

- **Library lists** (`szablony`, `placeholdery`, `linie usług`, `kampanie`) -> **Card rows** (variant K). Each row
  is a `Card`-styled row: name + status/type `Badge` inline, a meta line below, the action (Usuń via `ConfirmButton`)
  on the right. (Genuine DATA tables — the `/leady` list and the `batch-view` runs table — stay tabular via the
  `Table` primitive; they are columnar data, not library lists.)
- **Copy: full polonization.** Translate all enum renders to Polish labels; `Suppression` -> `Wykluczenia`;
  `score` -> `ocena`; `research`/`researchu` -> `badania`/`badań`; `web search` -> `wyszukiwanie w sieci`; remove
  code-identifier leaks (`(customFields)` -> drop / "Pola własne"; `(honorific)` -> "Forma grzecznościowa");
  `Import` -> `Importuj`; `To follow-up` -> `Wiadomość follow-up`. **Keep** established terms: `Pipeline`,
  `follow-up`, `draft`.
- **Badges**: the existing `Badge` primitive (`variant` = neutral|ok|warn|bad|info, already tokenized for dark) is
  the category/status chip. No new tokens — map each enum value to `{label, variant}`.

## Scope

**IN:** the shared enum-label module; primitive adoption + enum-labeling + copy fixes across the ~25 surfaces in
the inventory below; library lists -> Card rows; data tables -> `Table` primitive; ad-hoc badges -> `Badge`.

**OUT:** any data-model / behavior change (pure presentation); new features; `team-role-ui` (role enforcement);
the `/ustawienia` pages, `mailbox-settings-form`, the sidebar, and the dashboard parts (already primitive — the
reference). No migration.

## Shared foundation — `features/enums/labels.ts` (pure, unit-tested) + Badge export

Export `BadgeVariant` from `components/ui/badge.tsx` (currently a private type) so the maps can reference it.
Then a pure module of Polish labels + Badge variants for every leaking enum:

```ts
import type {CampaignStatus, CampaignLeadStatus, SequenceCondition, InboundKind, ResearchTypeKind, PlaceholderType, Role} from "@/generated/prisma/client"
import type {BadgeVariant} from "@/components/ui/badge"

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {DRAFT: "Szkic", ACTIVE: "Aktywna", PAUSED: "Wstrzymana", DONE: "Zakończona"}
export const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, BadgeVariant> = {DRAFT: "neutral", ACTIVE: "ok", PAUSED: "warn", DONE: "neutral"}

export const LEAD_STATUS_LABEL: Record<CampaignLeadStatus, string> = {PENDING: "Oczekuje", ACTIVE: "W toku", REPLIED: "Odpowiedział", BOUNCED: "Odbicie", UNSUBSCRIBED: "Rezygnacja", SKIPPED: "Pominięty", FAILED: "Błąd", DONE: "Zakończony"}
export const LEAD_STATUS_VARIANT: Record<CampaignLeadStatus, BadgeVariant> = {PENDING: "neutral", ACTIVE: "ok", REPLIED: "info", BOUNCED: "bad", UNSUBSCRIBED: "warn", SKIPPED: "neutral", FAILED: "bad", DONE: "neutral"}

export const CONDITION_LABEL: Record<SequenceCondition, string> = {ALWAYS: "Zawsze", SEND_IF_NO_REPLY: "Jeśli brak odpowiedzi"}
export const INBOUND_KIND_LABEL: Record<InboundKind, string> = {REPLY: "Odpowiedź", BOUNCE: "Odbicie", AUTO_REPLY: "Auto-odpowiedź", OPT_OUT_SUSPECT: "Możliwa rezygnacja"}
export const RESEARCH_KIND_LABEL: Record<ResearchTypeKind, string> = {RESEARCH: "Badanie", SCORING: "Ocena", CONTENT: "Treść", DRAFT: "Draft maila"}
export const RESEARCH_KIND_VARIANT: Record<ResearchTypeKind, BadgeVariant> = {RESEARCH: "neutral", SCORING: "warn", CONTENT: "info", DRAFT: "neutral"}
export const PLACEHOLDER_TYPE_LABEL: Record<PlaceholderType, string> = {TEXT: "Tekst", CHOICE: "Wybór"}
export const ROLE_LABEL: Record<Role, string> = {OWNER: "Właściciel", ADMIN: "Administrator", MEMBER: "Członek"}

// ResearchRunStatus + ResearchBatchStatus share these keys (QUEUED/RUNNING/DONE/FAILED/CANCELLED/PARTIAL):
export const RESEARCH_STATUS_LABEL: Record<string, string> = {QUEUED: "W kolejce", RUNNING: "W toku", DONE: "Gotowe", FAILED: "Błąd", CANCELLED: "Anulowane", PARTIAL: "Częściowe"}
```

`DealStage` already has `STAGE_LABEL` in `features/pipeline/types` — reuse it (do not duplicate). `Target`/`FieldType`
(research-type config, in `features/research-types/targets.ts`, not Prisma) get Polish option labels added there or
a small local map in the form. Tests: assert each `Record` covers every enum member (no `undefined` label) +
spot-check a couple of labels/variants.

## Inventory -> slices (the per-surface checklist; from the audit: 131 raw-element sites, 27 enum leaks, 32 copy issues)

**Slice 1 — foundation:** `features/enums/labels.ts` (+ test) + export `BadgeVariant`. Everything else imports it.

**Slice 2 — leady:** `/leady/page.tsx` (filters+sort -> Input/Select/Button; leads list -> `Table` primitive;
`{lead.dealStage}` -> `STAGE_LABEL` Badge; "Import" -> "Importuj"). `lead-form.tsx`, `lead-edit-form.tsx`,
`activity-form.tsx`, `draft-panel.tsx`, `uruchom-research.tsx` -> Field/Input/Select/Textarea/Button/Note/Spinner;
`timeline.tsx` -> `EmptyState` + Card-ish rows; badges on `[id]/page.tsx` -> `Badge`. Copy: drop `(honorific)` ->
"Forma grzecznościowa", `(customFields)` -> "Pola własne". `batch-research-launcher.tsx` -> Card + primitives + Switch.

**Slice 3 — kampanie:** `kampanie/page.tsx` -> **Card rows** + `CAMPAIGN_STATUS_LABEL`/`_VARIANT` Badge.
`campaign-form.tsx`, `sending-controls.tsx`, `sequence-and-leads.tsx` -> primitives; `{s.condition}` +
the ALWAYS/SEND_IF_NO_REPLY `<option>` labels -> `CONDITION_LABEL`; the violet "draft" pill -> `Badge`.
`[id]/page.tsx` heading `{campaign.status}` -> `CAMPAIGN_STATUS_LABEL` Badge. `lead-inbox.tsx`: `{r.status}` ->
`LEAD_STATUS_LABEL` Badge; the inbound pill -> `Badge` (`INBOUND_KIND_LABEL`, no raw fallback).

**Slice 4 — badania:** `research-type-form.tsx` -> Field/Input/Select/Textarea/Switch/Button/Card; Target +
FieldType `<option>`/locked-display -> Polish labels; copy: "researchu" -> "badań", "web search" -> "wyszukiwanie w
sieci", drop the `(DRAFT)` token in labels. `badania/page.tsx` -> Card rows + `RESEARCH_KIND_LABEL`/`_VARIANT`
Badge (incl. RESEARCH which currently has no badge), batch mode + status via the maps. `batch-view.tsx` -> Button
primitives + `Table` primitive (runs) + status Badge via `RESEARCH_STATUS_LABEL` (fix the run-vs-batch map leak) +
EmptyState; counts strip "DONE" -> "Gotowe"; the double-"Anuluj" confirm -> confirmLabel "Anuluj badanie",
cancelLabel "Wróć". `nowy`/`[id]` headings -> "badań".

**Slice 5 — content (szablony / placeholdery / linie):** the three library lists -> **Card rows**;
`template-editor.tsx`, `placeholder-form.tsx`, `offering-line-form.tsx` -> Field/Input/Select/Textarea/Switch/Button/
Note/Card. `PlaceholderType` (list + form option) -> `PLACEHOLDER_TYPE_LABEL`. Copy: "To follow-up" -> "Wiadomość
follow-up"; "(follow-up)" marker -> a `Badge`; placeholder helper "opcje CHOICE" -> "opcje listy wyboru".

**Slice 6 — sending + pipeline:** `suppression/page.tsx` heading "Suppression" -> "Wykluczenia" + EmptyState;
`suppression-form.tsx` -> Field/Input/Button ("Dodaj do wykluczeń"). `pipeline/page.tsx` filter -> Select/Button
(heading "Pipeline" kept). `pipeline/card.tsx` -> Card primitive; `{lead.sequenceStatus}` -> `LEAD_STATUS_LABEL`
Badge; `score N` -> "ocena N"; `board.tsx` "+N więcej" -> Button(ghost), empty column "—" -> friendly text.

## Testing

- TDD `features/enums/labels.test.ts`: every `Record` is total over its enum (no missing key -> no `undefined`);
  spot-check labels/variants.
- Per slice: `tsc` 0, `eslint` clean, no behavior change. Final: `vitest` green (+ the labels cases),
  `next build` green.
- High-taste -> a live eyeball of each migrated surface (the executing session does this on the dev server).

## Risks / notes

- Large surface area -> decompose strictly by slice; each slice is independently shippable + committable. A
  subagent-driven or workflow fan-out fits well (slices touch disjoint files; the labels module lands first).
- Pure presentation: do NOT change server actions, queries, or form field `name`s — only the rendered markup +
  labels. Verify each form still submits the same field names.
- `Table`/`Card`/`Badge`/`EmptyState` primitives already exist; this is adoption, not new primitives.
- Keep diffs reviewable: one slice = one area = one commit (or a few). The audit (this spec's inventory) is the
  per-file checklist.
