# Phase 7 — page-level-visual-pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every remaining app surface up to the design-foundation bar — adopt the `components/ui/*` primitives everywhere, render every leaked DB-enum string as a friendly Polish `Badge` label via one shared module, convert the four library lists to Card rows, and fix the copy leaks — with zero behavior change.

**Architecture:** One pure, unit-tested label module (`features/enums/labels.ts`) lands first; every other slice imports it. The rest is pure presentation: hand-rolled `<input>/<select>/<textarea>/<button>` and ad-hoc chips become `Input/Select/Textarea/Button/Field/Note/Switch/Badge`; library `<ul class="divide-y">` lists become Card rows; the genuine data tables (`/leady`, `batch-view` runs) become the `Table` primitive. Server actions, queries, and form-field `name`s are untouched. No migration.

**Tech Stack:** Next 16 (App Router, `app/(app)/*`), React 19, TypeScript 6, Tailwind v4 (design tokens), Prisma 7 client at `@/generated/prisma/client`, Vitest 4. Primitives at `@/components/ui/*`.

---

## Conventions (every code step)

- Tabs, no semicolons. Path comment on line 1 — or line 2 when the file starts with `"use client"`/`"use server"`. `className` first prop. `import {x}` no inner spaces. NO emoji anywhere.
- **Pure presentation only:** never change a server action, query, Zod schema, or a form field's `name`/`value`/`defaultValue`/`onChange` wiring. You are swapping the rendered element and its classes, not the form contract.
- Primitive import paths: `@/components/ui/{badge,card,table,empty-state,field,input,select,textarea,button,note,switch,spinner}`. ConfirmButton at `@/components/ui/confirm-button` (already adopted at every destructive site — keep it).
- After each slice: re-run the gates and **live-eyeball the migrated surface** on the dev server (the user runs `npm run dev` on :3000/:3001; this is dark-default). One slice = one commit.

---

## Reference A — primitive adoption patterns (apply verbatim; do not re-derive)

These are the before -> after swaps. Names/values/`name=` stay identical — only the element + classes change.

**Text input**
```tsx
// before
<input name="email" className="rounded border border-border px-2 py-1 text-sm" />
// after
<Input name="email" />
```

**Select (preserve every `<option>` and its `value`)**
```tsx
// before
<select name="sort" className="rounded border border-border px-2 py-1">...</select>
// after
<Select name="sort">...</Select>   // same <option> children
```

**Textarea**
```tsx
// before
<textarea name="body" className="rounded border border-border px-2 py-1 text-sm" />
// after
<Textarea name="body" />
```

**Buttons** — map by role:
```tsx
<button className="rounded bg-primary px-3 py-1.5 text-primary-fg">Zapisz</button>   -> <Button variant="primary" type="submit">Zapisz</Button>
<button className="rounded border border-border px-3 py-1">Filtruj</button>          -> <Button type="submit">Filtruj</Button>   // secondary is the default
<button className="text-xs text-accent">+N więcej</button>                            -> <Button variant="ghost" size="sm">+N więcej</Button>
```
`ButtonVariant = "primary" | "secondary" | "ghost" | "danger"`; default (omitted) = secondary. `size="sm"` for compact toolbars. NEVER wrap an existing `ConfirmButton` in `Button`.

**Labeled field** — wrap the label+control that today is a bare `<label>` + text + control:
```tsx
<Field label="Adres e-mail" hint="opcjonalnie" error={state?.error}>
	<Input name="email" />
</Field>
```
Use `Field` only where a visible label exists today; do not invent labels. `error` shows danger text, else `hint` shows faint text.

**Inline note / status line** (`<p className="text-sm text-danger">` etc.) — for guidance boxes use `Note` (`variant="info"|"warning"`); for transient form status keep a `<p>` but use tokens (`text-danger`/`text-success`/`text-fg-muted`). Do not over-convert one-line submit errors into `Note`.

**Switch** (replace a bare `<input type="checkbox">` only where it reads as an on/off toggle in a client component that already holds the boolean in state):
```tsx
<Switch checked={webSearch} onChange={setWebSearch} />
```
Where the checkbox is an uncontrolled form field submitted by `name` (e.g. `useLeadDraft`, `isFollowup`, `required`, `includeRecent`), KEEP a native `<input type="checkbox" name=...>` so the form still submits — just tidy its wrapper label classes. Do not break the form contract to gain a Switch.

**Ad-hoc chip / pill -> Badge**
```tsx
// before
<span className="rounded bg-surface-2 px-2 py-0.5 text-xs text-fg-muted">{value}</span>
// after
<Badge variant={SOME_VARIANT[value]}>{SOME_LABEL[value]}</Badge>
```

## Reference B — Card-row pattern (variant K, the approved library-list style)

Replaces `<ul className="divide-y divide-border border-y border-border">` + `<li>` rows. The list container becomes a gap stack; each row is the `Card` primitive with compact padding:

```tsx
// container
<div className="flex flex-col gap-2">
	{items.map((it) => (
		<Card key={it.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
			<div className="min-w-0">
				<div className="flex items-center gap-2 text-sm font-semibold text-fg">
					<Link href={`/.../${it.id}`} className="truncate hover:text-accent">{it.name}</Link>
					<Badge variant={VARIANT[it.status]}>{LABEL[it.status]}</Badge>
				</div>
				<p className="mt-0.5 text-[12px] text-fg-faint">{metaLine}</p>
			</div>
			<div className="flex-none">{/* existing action: Edytuj link + ConfirmButton Usuń */}</div>
		</Card>
	))}
</div>
```
`metaLine` is the existing secondary text joined with ` · ` (e.g. `` `${steps} kroków · ${leads} leadów` ``). Keep whatever link/action markup the row already had; only restructure the wrapper. `Card` already supplies `border-border` + `bg-surface-1` + `rounded-lg` + shadow.

## Reference C — copy fixes (exact strings; from the spec)

| Find | Replace with |
|---|---|
| `Import` (the leads button) | `Importuj` |
| `(honorific)` label leak | `Forma grzecznościowa` |
| `(customFields)` label leak | `Pola własne` |
| `To follow-up` | `Wiadomość follow-up` |
| `(follow-up)` plain marker | a `<Badge variant="info">Follow-up</Badge>` |
| `Suppression` (heading) | `Wykluczenia` |
| `score` / `score N` (UI label) | `ocena` / `ocena N` |
| `research` / `researchu` / `researchem` | `badania` / `badań` / `badaniem` (grammatical) |
| `web search` | `wyszukiwanie w sieci` |
| `opcje CHOICE` (helper) | `opcje listy wyboru` |
| `DONE` count chip (batch) | `Gotowe` |

**Keep unchanged:** `Pipeline`, `follow-up` (as a term), `draft`.

---

## Task 1: Slice 1 — shared foundation (`features/enums/labels.ts` + Badge export)

**Files:**
- Modify: `components/ui/badge.tsx` (export the `BadgeVariant` type)
- Create: `features/enums/labels.ts`
- Create: `features/enums/labels.test.ts`

- [ ] **Step 1: Export `BadgeVariant` from the Badge primitive**

In `components/ui/badge.tsx` change the private type declaration to an export (one line; nothing else changes):
```tsx
export type BadgeVariant = "neutral" | "ok" | "warn" | "bad" | "info"
```

- [ ] **Step 2: Write the failing test**

Create `features/enums/labels.test.ts` (enums are exported from the generated client as runtime const objects via `export * from "./enums"`, so `Object.values(Enum)` yields the members):
```tsx
// features/enums/labels.test.ts
import {describe, it, expect} from "vitest"
import {CampaignStatus, CampaignLeadStatus, SequenceCondition, InboundKind, ResearchTypeKind, PlaceholderType, Role, ResearchRunStatus, ResearchBatchStatus} from "@/generated/prisma/client"
import {CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_VARIANT, LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT, CONDITION_LABEL, INBOUND_KIND_LABEL, INBOUND_KIND_VARIANT, RESEARCH_KIND_LABEL, RESEARCH_KIND_VARIANT, PLACEHOLDER_TYPE_LABEL, ROLE_LABEL, RESEARCH_STATUS_LABEL} from "@/features/enums/labels"

function total(enumObj: Record<string, string>, map: Record<string, string>) {
	for (const v of Object.values(enumObj)) {
		expect(typeof map[v], `missing key ${v}`).toBe("string")
		expect(map[v]).not.toBe("")
	}
}

describe("enum labels", () => {
	it("label maps are total over their enum", () => {
		total(CampaignStatus, CAMPAIGN_STATUS_LABEL)
		total(CampaignLeadStatus, LEAD_STATUS_LABEL)
		total(SequenceCondition, CONDITION_LABEL)
		total(InboundKind, INBOUND_KIND_LABEL)
		total(ResearchTypeKind, RESEARCH_KIND_LABEL)
		total(PlaceholderType, PLACEHOLDER_TYPE_LABEL)
		total(Role, ROLE_LABEL)
		total(ResearchRunStatus, RESEARCH_STATUS_LABEL)
		total(ResearchBatchStatus, RESEARCH_STATUS_LABEL)
	})
	it("variant maps are total over their enum", () => {
		total(CampaignStatus, CAMPAIGN_STATUS_VARIANT)
		total(CampaignLeadStatus, LEAD_STATUS_VARIANT)
		total(InboundKind, INBOUND_KIND_VARIANT)
		total(ResearchTypeKind, RESEARCH_KIND_VARIANT)
	})
	it("spot-checks labels + variants", () => {
		expect(CAMPAIGN_STATUS_LABEL.ACTIVE).toBe("Aktywna")
		expect(LEAD_STATUS_LABEL.REPLIED).toBe("Odpowiedział")
		expect(RESEARCH_KIND_LABEL.DRAFT).toBe("Draft maila")
		expect(CONDITION_LABEL.SEND_IF_NO_REPLY).toBe("Jeśli brak odpowiedzi")
		expect(RESEARCH_STATUS_LABEL.PARTIAL).toBe("Częściowe")
		expect(CAMPAIGN_STATUS_VARIANT.ACTIVE).toBe("ok")
		expect(LEAD_STATUS_VARIANT.FAILED).toBe("bad")
	})
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run features/enums/labels.test.ts`
Expected: FAIL — cannot resolve `@/features/enums/labels`.

- [ ] **Step 4: Write the label module**

Create `features/enums/labels.ts` (type-only Prisma imports; `RESEARCH_STATUS_LABEL` typed over the union of both status enums so tsc enforces totality):
```tsx
// features/enums/labels.ts
import type {CampaignStatus, CampaignLeadStatus, SequenceCondition, InboundKind, ResearchTypeKind, PlaceholderType, Role, ResearchRunStatus, ResearchBatchStatus} from "@/generated/prisma/client"
import type {BadgeVariant} from "@/components/ui/badge"

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {DRAFT: "Szkic", ACTIVE: "Aktywna", PAUSED: "Wstrzymana", DONE: "Zakończona"}
export const CAMPAIGN_STATUS_VARIANT: Record<CampaignStatus, BadgeVariant> = {DRAFT: "neutral", ACTIVE: "ok", PAUSED: "warn", DONE: "neutral"}

export const LEAD_STATUS_LABEL: Record<CampaignLeadStatus, string> = {PENDING: "Oczekuje", ACTIVE: "W toku", REPLIED: "Odpowiedział", BOUNCED: "Odbicie", UNSUBSCRIBED: "Rezygnacja", SKIPPED: "Pominięty", FAILED: "Błąd", DONE: "Zakończony"}
export const LEAD_STATUS_VARIANT: Record<CampaignLeadStatus, BadgeVariant> = {PENDING: "neutral", ACTIVE: "ok", REPLIED: "info", BOUNCED: "bad", UNSUBSCRIBED: "warn", SKIPPED: "neutral", FAILED: "bad", DONE: "neutral"}

export const CONDITION_LABEL: Record<SequenceCondition, string> = {ALWAYS: "Zawsze", SEND_IF_NO_REPLY: "Jeśli brak odpowiedzi"}

export const INBOUND_KIND_LABEL: Record<InboundKind, string> = {REPLY: "Odpowiedź", BOUNCE: "Odbicie", AUTO_REPLY: "Auto-odpowiedź", OPT_OUT_SUSPECT: "Możliwa rezygnacja"}
export const INBOUND_KIND_VARIANT: Record<InboundKind, BadgeVariant> = {REPLY: "info", BOUNCE: "bad", AUTO_REPLY: "neutral", OPT_OUT_SUSPECT: "warn"}

export const RESEARCH_KIND_LABEL: Record<ResearchTypeKind, string> = {RESEARCH: "Badanie", SCORING: "Ocena", CONTENT: "Treść", DRAFT: "Draft maila"}
export const RESEARCH_KIND_VARIANT: Record<ResearchTypeKind, BadgeVariant> = {RESEARCH: "neutral", SCORING: "warn", CONTENT: "info", DRAFT: "neutral"}

export const PLACEHOLDER_TYPE_LABEL: Record<PlaceholderType, string> = {TEXT: "Tekst", CHOICE: "Wybór"}

export const ROLE_LABEL: Record<Role, string> = {OWNER: "Właściciel", ADMIN: "Administrator", MEMBER: "Członek"}

// ResearchRunStatus = QUEUED|RUNNING|DONE|FAILED|CANCELLED; ResearchBatchStatus = QUEUED|RUNNING|DONE|PARTIAL|CANCELLED
export const RESEARCH_STATUS_LABEL: Record<ResearchRunStatus | ResearchBatchStatus, string> = {QUEUED: "W kolejce", RUNNING: "W toku", DONE: "Gotowe", FAILED: "Błąd", CANCELLED: "Anulowane", PARTIAL: "Częściowe"}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run features/enums/labels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` -> 0 errors. Run: `npx eslint components/ui/badge.tsx features/enums/labels.ts features/enums/labels.test.ts` -> clean.

- [ ] **Step 7: Commit**

```bash
git add components/ui/badge.tsx features/enums/labels.ts features/enums/labels.test.ts
git commit -m "feat(phase7): shared enum-label module + export BadgeVariant (page-level-visual-pass slice 1)"
```

---

## Task 2: Slice 2 — leady

**Files (all under `app/(app)/leady/`):** `page.tsx`, `lead-form.tsx`, `[id]/lead-edit-form.tsx`, `[id]/activity-form.tsx`, `[id]/draft-panel.tsx`, `[id]/uruchom-research.tsx`, `[id]/timeline.tsx`, `[id]/page.tsx`, `batch-research-launcher.tsx`.

Read each file before editing; apply Reference A/B/C. Per-file checklist:

- [ ] **`page.tsx`** (server): filter/sort row -> `Input` (`name="q"`, `name="minScore"`) + `Select` (`name="line"`, `name="sort"`) + `Button` (the filter submit). The leads list `<table>` -> `Table`/`Th`/`Td` primitive. `{lead.dealStage}` -> `<Badge>{STAGE_LABEL[lead.dealStage]}</Badge>` (import `STAGE_LABEL` from `@/features/pipeline/types`). Button copy `Import` -> `Importuj`. If the list is empty, render `EmptyState`. Preserve `name`s `q/minScore/line/sort`.
- [ ] **`lead-form.tsx`** (client): 5 `<input>` -> `Input`, the `<select name="offeringLineId">` -> `Select`, submit -> `<Button variant="primary" type="submit">`, error `<span>` -> keep `<p className="text-sm text-danger">`. Wrap labeled rows in `Field` where a label exists. Preserve `name`s `organizationName/email/website/contactPersonName/city/offeringLineId`.
- [ ] **`[id]/lead-edit-form.tsx`** (client): all `<input>` -> `Input`, `<select name="honorific">` -> `Select`, `<textarea name="aiNotes">` -> `Textarea`, custom-fields `<fieldset>` -> `Card`/`CardBody` wrapper, submit -> `<Button variant="primary">`. Copy: any `(honorific)` -> `Forma grzecznościowa`, `(customFields)` -> `Pola własne`. KEEP all `name`s incl. `cf_key`/`cf_value` and the per-row structure (the customFields submit contract).
- [ ] **`[id]/activity-form.tsx`** (client): `<select name="kind">` -> `Select`, `<textarea name="body">` -> `Textarea`, submit -> `<Button variant="primary">`. Preserve `leadId/kind/body`.
- [ ] **`[id]/draft-panel.tsx`** (client): type `<select>` -> `Select`, Generuj/Zapisz -> `Button` (`primary`), subject `<input>` -> `Input`, body `<textarea>` -> `Textarea`, status `<p>` -> token classes. Add `Spinner` next to the poll/pending text. No form `name`s here (stateful) — preserve the action calls.
- [ ] **`[id]/uruchom-research.tsx`** (client): both `<select>` -> `Select`, Uruchom/Zastosuj -> `Button` (`primary`), the diff `<ul>` keep but token the strikethrough (`text-fg-faint line-through`). Copy: any `research` label leak -> `badania`/`badań`. Add `Spinner` for the poll state.
- [ ] **`[id]/timeline.tsx`** (server): `<li className="rounded border border-border p-2">` rows -> `Card`-styled rows (Reference B without the action column). When empty -> `EmptyState` (title e.g. "Brak aktywności"). Keep the `ConfirmButton` deletes.
- [ ] **`[id]/page.tsx`** (server): the two `<span className="rounded bg-surface-2 ...">` pills -> `Badge` (stage already uses `STAGE_LABEL[lead.dealStage]` -> wrap in `<Badge>`; the score pill -> `<Badge>ocena {lead.score}</Badge>`, copy `score` -> `ocena`).
- [ ] **`batch-research-launcher.tsx`** (client): wrap in `Card`; both `<select>` -> `Select`; the `includeRecent` checkbox -> keep native `<input type="checkbox">` (form/state field) with a tidy `<label>`; Podgląd -> `<Button>`, Uruchom -> `<Button variant="primary">`; preview panel -> token classes; truncation warning -> `Note variant="warning"`.

- [ ] **Gates:** `npx tsc --noEmit` -> 0. `npx eslint "app/(app)/leady/**"` -> clean. Confirm form field names unchanged: `git diff -U0 -- "app/(app)/leady" | grep -E '^[+-].*name=' ` shows only moved lines, no renamed `name=`. Live-eyeball `/leady` + a lead detail page on the dev server (filters, table, badges, forms submit).
- [ ] **Commit:** `git add "app/(app)/leady" && git commit -m "feat(phase7): leady primitives + enum Badges + copy (page-level-visual-pass slice 2)"`

---

## Task 3: Slice 3 — kampanie

**Files:** `app/(app)/kampanie/page.tsx`, `campaign-form.tsx`, `[id]/sending-controls.tsx`, `[id]/sequence-and-leads.tsx`, `[id]/page.tsx`, `[id]/lead-inbox.tsx`. Import label maps from `@/features/enums/labels`.

- [ ] **`page.tsx`** (server): the `<ul className="divide-y ...">` campaign list -> **Card rows** (Reference B). `{c.status}` -> `<Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>`. `metaLine` = the existing steps/leads counts joined ` · `. Empty -> `EmptyState`.
- [ ] **`campaign-form.tsx`** (client): `<input name="name">` -> `Input`, `<select name="offeringLineId">` -> `Select`, submit -> `<Button variant="primary">`, error -> token `<p>`. Preserve `name/offeringLineId`.
- [ ] **`[id]/sending-controls.tsx`** (client): `<select name="emailAccountId">` -> `Select`, Zapisz -> `<Button>`, Aktywuj -> `<Button variant="primary">`, status `<p>` -> token classes. Preserve `emailAccountId`.
- [ ] **`[id]/sequence-and-leads.tsx`** (client): the step `<ol>` list keep but the hardcoded `<span className="... bg-violet-100 text-violet-700">` draft marker -> `<Badge variant="neutral">draft</Badge>`; the three `<select>` (templateId/condition/offeringLineId) -> `Select`; the ALWAYS/SEND_IF_NO_REPLY `<option>` labels -> `CONDITION_LABEL[...]` text; `{s.condition}` in the step list -> `CONDITION_LABEL[s.condition]`; `<input name="delayDays">` -> `Input`; the `useLeadDraft` checkbox -> keep native `<input type="checkbox" name="useLeadDraft">`; submit -> `<Button variant="primary">`. Preserve `campaignId/templateId/delayDays/condition/useLeadDraft/offeringLineId`.
- [ ] **`[id]/page.tsx`** (server): heading `{campaign.status}` -> `<Badge variant={CAMPAIGN_STATUS_VARIANT[campaign.status]}>{CAMPAIGN_STATUS_LABEL[campaign.status]}</Badge>`.
- [ ] **`[id]/lead-inbox.tsx`** (client): delete the local `BADGE` map; `{r.status}` -> `<Badge variant={LEAD_STATUS_VARIANT[r.status]}>{LEAD_STATUS_LABEL[r.status]}</Badge>`; the inbound pill -> `<Badge variant={INBOUND_KIND_VARIANT[r.inboundKind]}>{INBOUND_KIND_LABEL[r.inboundKind]}</Badge>` (no raw fallback). Keep the `ConfirmButton` "Nie kontaktować".

- [ ] **Gates:** `npx tsc --noEmit` -> 0. `npx eslint "app/(app)/kampanie/**"` -> clean. Field-name diff check (as Task 2). Live-eyeball `/kampanie`, a campaign detail (status badge, sequence builder, lead-inbox badges).
- [ ] **Commit:** `git add "app/(app)/kampanie" && git commit -m "feat(phase7): kampanie Card rows + status/condition/inbound Badges (page-level-visual-pass slice 3)"`

---

## Task 4: Slice 4 — badania

**Files:** `app/(app)/badania/page.tsx`, `research-type-form.tsx`, `batches/[id]/batch-view.tsx`, `nowy/page.tsx`, `[id]/page.tsx`. Import label maps from `@/features/enums/labels`.

- [ ] **`page.tsx`** (server): the type `<ul className="divide-y ...">` -> **Card rows**. Replace the three hardcoded category badges (`bg-amber-100 text-amber-700` SCORING, sky CONTENT, violet DRAFT) AND add one for RESEARCH (currently unbadged): `<Badge variant={RESEARCH_KIND_VARIANT[t.kind]}>{RESEARCH_KIND_LABEL[t.kind]}</Badge>`. The recent-batches list: batch status -> `<Badge variant=...>{RESEARCH_STATUS_LABEL[b.status]}</Badge>` (pick a sensible variant inline: DONE->ok, FAILED->bad, RUNNING/QUEUED->info, CANCELLED/PARTIAL->warn). Empty -> `EmptyState`.
- [ ] **`research-type-form.tsx`** (client): inputs -> `Input`, the `kind`/`modelId`/`target`/`type`/`condition` selects -> `Select`, prompt `<textarea>` -> `Textarea`, the `required`/`webSearchEnabled` checkboxes -> keep native checkbox (state-bound) or `Switch` if already controlled via state (`webSearchEnabled` is controlled -> `Switch` ok; `required` per-field stays a checkbox), add-field dashed button -> `<Button size="sm" className="border-dashed">`, locked-type display `<span>` -> `<Badge>`. **Target/FieldType Polish option labels** — add two local maps at the top of the file and use them for the `<option>` text + the locked display (keep the `value` = the enum/string identifier):
```tsx
const TARGET_LABEL: Record<string, string> = {contactPersonName: "Osoba kontaktowa", contactRole: "Stanowisko", honorific: "Forma grzecznościowa", aiHook: "Hak AI", aiNotes: "Notatki AI", siteQuality: "Jakość strony", priority: "Priorytet", score: "Ocena", city: "Miasto", region: "Region", schoolType: "Typ szkoły", email: "E-mail", CUSTOM: "Pole własne"}
const FIELD_TYPE_LABEL: Record<string, string> = {TEXT: "Tekst", NUMBER: "Liczba", BOOLEAN: "Tak/Nie", EMAIL: "E-mail", ENUM: "Lista wyboru", GENDER: "Płeć"}
```
Copy: `researchu`/`research` -> `badań`/`badania`; `web search` -> `wyszukiwanie w sieci`; drop any `(DRAFT)`/`(CUSTOM)` code token in visible labels (use the maps above). Preserve every `name=` (`outputFields/name/kind/prompt/modelId/webSearchEnabled/label/key/target/type/required/description`).
- [ ] **`batches/[id]/batch-view.tsx`** (client): action `<button>`s -> `Button` (Anuluj -> default; Wznów/primary actions -> `variant="primary"`); the runs `<table>` -> `Table`/`Th`/`Td`. Replace the LOCAL `STATUS_LABEL` map with `RESEARCH_STATUS_LABEL` from the shared module (fixes the run-vs-batch label leak): `{STATUS_LABEL[r.status]}` -> `<Badge variant=...>{RESEARCH_STATUS_LABEL[r.status]}</Badge>`, same for `batch.status`. Counts strip `DONE` -> `Gotowe` (and other raw status words via the map). The double-"Anuluj" confirm: pass `confirmLabel="Anuluj badanie"` + `cancelLabel="Wróć"` to the `ConfirmButton`/`useConfirm` call. Empty runs -> `EmptyState`.
- [ ] **`nowy/page.tsx` + `[id]/page.tsx`** (server, composition): headings/prose `research`/`researchu` -> `badania`/`badań`. No raw elements; copy only.

- [ ] **Gates:** `npx tsc --noEmit` -> 0. `npx eslint "app/(app)/badania/**"` -> clean. Field-name diff check. Live-eyeball `/badania` (kind badges incl. RESEARCH), the type editor, and a batch view (run table, status badges, the cancel confirm copy).
- [ ] **Commit:** `git add "app/(app)/badania" && git commit -m "feat(phase7): badania Card rows + kind/status Badges + PL copy (page-level-visual-pass slice 4)"`

---

## Task 5: Slice 5 — content (szablony / placeholdery / linie)

**Files:** `app/(app)/szablony/page.tsx`, `szablony/template-editor.tsx`, `placeholdery/page.tsx`, `placeholdery/placeholder-form.tsx`, `linie/page.tsx`, `linie/offering-line-form.tsx`. Import `PLACEHOLDER_TYPE_LABEL` from `@/features/enums/labels`.

- [ ] **`szablony/page.tsx`** (server): `<ul className="divide-y ...">` -> **Card rows**. The `<span>(follow-up)</span>` marker -> `<Badge variant="info">Follow-up</Badge>`. `metaLine` = line/type joined ` · `. Empty -> `EmptyState`.
- [ ] **`szablony/template-editor.tsx`** (client): `<input name="name">` -> `Input`; the 13 placeholder-insert `<button>`s -> `<Button variant="ghost" size="sm">` (keep their onClick); subject + body `<textarea>` -> `Textarea`; the `isFollowup` checkbox -> keep native `<input type="checkbox" name="isFollowup">`; `<select name="offeringLineId">` -> `Select`; submit -> `<Button variant="primary">`; status `<p>` -> token classes; preview `<hr>` -> `border-border`. Copy `To follow-up` -> `Wiadomość follow-up`. Preserve `name/subject/body/isFollowup/offeringLineId`.
- [ ] **`placeholdery/page.tsx`** (server): `<ul className="divide-y ...">` -> **Card rows**. The placeholder type -> `<Badge>{PLACEHOLDER_TYPE_LABEL[p.type]}</Badge>`. Keep the `<code>{{...}}</code>` key. Empty -> `EmptyState`.
- [ ] **`placeholdery/placeholder-form.tsx`** (client): 5 `<input>` -> `Input`, `<select name="type">` -> `Select` (option labels via `PLACEHOLDER_TYPE_LABEL`, values stay `TEXT`/`CHOICE`), submit -> `<Button variant="primary">`, error -> token `<p>`. Helper text `opcje CHOICE` -> `opcje listy wyboru`. Preserve `key/label/type/options/fallback/source`.
- [ ] **`linie/page.tsx`** (server): `<ul className="divide-y ...">` -> **Card rows** (name + description meta). Empty -> `EmptyState`.
- [ ] **`linie/offering-line-form.tsx`** (client): 2 `<input>` -> `Input`, submit -> `<Button variant="primary">`, error -> token `<p>`. Preserve `name/description`.

- [ ] **Gates:** `npx tsc --noEmit` -> 0. `npx eslint "app/(app)/szablony/**" "app/(app)/placeholdery/**" "app/(app)/linie/**"` -> clean. Field-name diff check. Live-eyeball the three lists (Card rows), the template editor (palette buttons + preview), and the placeholder/line forms.
- [ ] **Commit:** `git add "app/(app)/szablony" "app/(app)/placeholdery" "app/(app)/linie" && git commit -m "feat(phase7): content Card rows + placeholder Badge + copy (page-level-visual-pass slice 5)"`

---

## Task 6: Slice 6 — sending (suppression) + pipeline

**Files:** `app/(app)/suppression/page.tsx`, `suppression/suppression-form.tsx`, `app/(app)/pipeline/page.tsx`, `pipeline/card.tsx`, `pipeline/board.tsx`. Import `LEAD_STATUS_LABEL`/`_VARIANT` + `STAGE_LABEL` as needed.

- [ ] **`suppression/page.tsx`** (server): heading `Suppression` -> `Wykluczenia`. `<ul className="divide-y ...">` -> **Card rows** (email + reason/date meta). Empty -> `EmptyState` (e.g. "Brak wykluczeń").
- [ ] **`suppression/suppression-form.tsx`** (client): `<input name="email">` -> `Input` wrapped in `Field`, submit -> `<Button variant="primary">Dodaj do wykluczeń</Button>`, error -> token `<p>`. Preserve `email`.
- [ ] **`pipeline/page.tsx`** (server): the filter `<select name="line">` -> `Select`, filter `<button>` -> `<Button>`. Heading `Pipeline` KEPT. Preserve `line`.
- [ ] **`pipeline/card.tsx`** (client): the draggable `<div className="cursor-pointer rounded border ...">` -> `Card` primitive (keep the drag handlers + `cursor-pointer hover:border-border-strong` via className). If the card renders `lead.sequenceStatus`, render `<Badge variant={LEAD_STATUS_VARIANT[lead.sequenceStatus]}>{LEAD_STATUS_LABEL[lead.sequenceStatus]}</Badge>`; if it renders a `score`, label it `ocena {score}`. (Read the file: the audit saw only score/subtitle here — apply whichever of sequenceStatus/score actually render.)
- [ ] **`pipeline/board.tsx`** (client): `{STAGE_LABEL[stage]}` already correct — keep. The `+N więcej` expand `<button>` -> `<Button variant="ghost" size="sm">`. The empty-column `—`/`text-fg-faint` -> a friendly line (e.g. `<p className="text-xs text-fg-faint">Brak leadów</p>`). Keep all DnD handlers + the `over` conditional bg.

- [ ] **Gates:** `npx tsc --noEmit` -> 0. `npx eslint "app/(app)/suppression/**" "app/(app)/pipeline/**"` -> clean. Field-name diff check. Live-eyeball `/wykluczenia` heading? — note the route stays `/suppression` (only the heading copy changes, not the path). Live-eyeball the suppression list+form and `/pipeline` (cards, badges, drag still works, expand button).
- [ ] **Commit:** `git add "app/(app)/suppression" "app/(app)/pipeline" && git commit -m "feat(phase7): suppression + pipeline primitives + Badges + copy (page-level-visual-pass slice 6)"`

---

## Final verification

- [ ] **Full suite:** `npx tsc --noEmit` (0), `npx vitest run` (green, includes the new labels cases), `npx eslint "app/(app)/**" "components/**" "features/enums/**"` (clean).
- [ ] **Production build:** ensure the dev server is OFF, then `npx next build` -> green.
- [ ] **No-behavior-change audit:** `git diff main --stat` should touch only `app/(app)/*`, `components/ui/badge.tsx`, and `features/enums/*`. Confirm NO change under `features/*/actions.ts`, `features/*/queries.ts`, `lib/`, or `prisma/`. Confirm the global field-name grep across the whole diff shows no renamed `name=` attributes.
- [ ] **Live eyeball pass:** walk every migrated surface once more in the running dark UI; verify every former enum leak now shows a Polish `Badge`, the four library lists are Card rows, the two data tables use the `Table` primitive, and every form still submits.
- [ ] Update `docs/superpowers/ROADMAP.md`: mark `page-level-visual-pass` DONE + verified; note `team-role-ui` is the last remaining Phase 7 piece. Then `graphify update .` (code) and, since docs changed, `graphify . --obsidian`.

---

## Self-review notes (author check vs spec)

- **Spec coverage:** Slice 1 (labels + Badge export) = Task 1; Slices 2-6 = Tasks 2-6, one-to-one with the spec's inventory. Card rows for the 4 library lists (kampanie/szablony/placeholdery/linie) covered in Tasks 3/4/5. Data tables kept tabular: `/leady` (Task 2) + `batch-view` runs (Task 4). Every enum-leak in the spec maps to a label/variant in Task 1 and is consumed in the slice that renders it. Copy fixes consolidated in Reference C and cited per file.
- **Additions beyond the spec (intentional):** `INBOUND_KIND_VARIANT` (the spec gives only the label but the inbound pill needs a Badge color) and `RESEARCH_STATUS_LABEL` typed as `Record<ResearchRunStatus | ResearchBatchStatus, string>` (the spec's `Record<string,string>` isn't totality-checkable — the union type makes tsc enforce it and the test assert it). `STAGE_LABEL` reused from `features/pipeline/types` (not duplicated). Target/FieldType labels kept local to the research-type form (not Prisma enums).
- **Risk guardrails:** every task ends with a field-name diff check + a live eyeball; the final audit asserts the diff never touches actions/queries/lib/prisma. Slices touch disjoint files, so they are independently committable (and would also fan out cleanly if run as a workflow).
