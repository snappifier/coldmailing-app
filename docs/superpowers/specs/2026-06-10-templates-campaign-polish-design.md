# Templates editor + campaign page polish (round 2) — design

Date: 2026-06-10
Status: approved by user (brainstorm with visual mocks; all forks user-picked)
Mocks: `.superpowers/brainstorm/746-1781102668/content/` — `templates-editor-layout.html` + `templates-a-vs-c.html` (picked C master-detail, with responsive fallback), `campaign-layout.html` (picked B tabs)

## Goal

Second polish round after `design-refinement`. Three parts:

1. `/szablony` rebuilt as a master-detail editor that can EDIT existing templates (new `updateTemplate` action — the editor is create-only today, and a template used by a sequence cannot even be deleted, so fixing a typo in a live template is currently impossible).
2. `/kampanie/[id]` rebuilt with tabs, and the sequence gains step EDIT (inline) and REORDER (new `updateSequenceStep` + `moveSequenceStep` actions) with engine-grounded safety semantics.
3. Five micro-fixes flagged by the design-refinement reviews.

Unlike previous polish rounds this one ADDS behavior: three new org-scoped server actions. No schema change, no migration (all columns exist). The sending engine (`lib/inngest/sending.ts`) stays untouched except one stale comment (see §2.4).

## Decisions (user-picked)

1. Templates layout: **C — master-detail on one page** (list rail | editor | preview), with a responsive fallback because the user explicitly allowed a different arrangement on smaller screens.
2. Templates editing: **yes** — `updateTemplate`, rail click loads a template, save overwrites.
3. Campaign layout: **B — tabs** (Sekwencja / Leady i wysyłka / Przychodzące).
4. Sequence scope: **layout + step edit + step reorder** (the largest offered scope).

## 1. Templates — master-detail editor (`app/(app)/szablony/`)

### 1.1 Layout

Three zones on one page, below the existing `PageHeader`:

- **Rail** (left): the template list. Each item: name + one-line mini-meta (`offeringLine.name` and/or `w sekwencji`, `text-[10px] text-fg-faint`). Active item = `bg-surface-2 text-fg` + accent kreska (`before:` 3px bar — same idiom as settings-shell). An item being edited with unsaved changes shows an amber dirty dot (`bg-warning` `size-[5px]` rounded, right-aligned). Empty rail (zero templates) renders nothing; the editor opens in "new" mode.
- **Editor** (middle): the form, §1.2.
- **Preview** (right): §1.3.

Breakpoints (content area already sits beside the app sidebar):

- `xl+`: `grid-cols-[200px_minmax(0,1.1fr)_minmax(0,1fr)]` — all three zones side by side.
- `lg..xl`: two columns `[200px_1fr]`; the preview stacks BELOW the form inside the right cell.
- `<lg`: single column; the rail collapses to horizontal wrapping pills above the editor (settings-shell `max-md` idiom).

### 1.2 Editor form

One `<form>`, same field names as today (form contract preserved; `templateId` is the ONLY net-new field, present in edit mode):

- Uppercase Field labels (lead-detail idiom): Nazwa (`Input name`), paleta (the existing ghost-button mono chips + insert-at-caret logic, unchanged), Temat (`Textarea subject`, unchanged), Treść (`Textarea body h-48`), Follow-up: the native checkbox upgrades to `Switch` + `<input type=hidden>` mirror (the proven badania pattern; submitted value contract identical), Linia (`Select offeringLineId`).
- Footer: primary submit — label „Zapisz szablon" (new mode) / „Zapisz zmiany" (edit mode) — plus, in edit mode only, `ConfirmButton` Usuń (reuses `deleteTemplate`); when the template is used by sequences (`_count.sequenceSteps > 0`) the delete button is replaced by the caption „w sekwencji" (same rule as the old list). The old standalone „Biblioteka" list section is REMOVED — the rail replaces it, delete moves here.
- Result handling: success → `useToast` („Zapisano szablon") + in new mode reset to a fresh form; error stays inline (`text-danger`). The current inline „Zapisano." paragraph goes away.

### 1.3 Preview

`Card` with an uppercase label „Podgląd · {organizationName}" (or „brak leadów"), subject line, `<hr>`, whitespace-pre-wrap body — content logic exactly as today (`renderTemplate` with the sample lead, missing-token list, the sender-signature warning Note). Sticky within its column (`lg:sticky lg:top-6 self-start`). The warning paragraph upgrades to the `Note variant="warning"` primitive.

### 1.4 Mode + dirty handling (client)

- The page stays a server component fetching the same data as today PLUS full template rows (subject/body/isFollowup/offeringLineId) for the rail/editor; a new client component owns mode state: `selectedId: string | null` (null = new mode). No URL state (YAGNI — internal tool; refresh resets to "new").
- Rail click / „+ Nowy szablon" with unsaved changes → `useConfirm` dialog („Porzucić niezapisane zmiany?", danger: false) before switching. Dirty = any field differs from the loaded snapshot (pure comparison over the 6 field values).
- The PageHeader action becomes a real `Button variant="secondary"` „+ Nowy szablon" wired to the same new-mode handler (this also resolves the "quiet CTA" review item; the `#edytor` anchor link dies).

### 1.5 `updateTemplate` action (`features/templates/actions.ts`)

Signature mirrors `createTemplate` (Zod: same field schema + `templateId`), org-scoped write (`updateMany({where: {id, organizationId}})`), `revalidatePath("/szablony")`, returns the same `TemplateResult` shape. `createTemplate` byte-unchanged. Client picks the action by mode (two `useActionState` hooks or one wrapper switching on `templateId` presence — implementation detail, but the server actions stay separate and explicit).

## 2. Campaign page — tabs + sequence editing (`app/(app)/kampanie/[id]/`)

### 2.1 Header + metrics

- Header row: back link (unchanged) then title + status `Badge` + „· N leadów" meta, with actions right-aligned: status ACTIVE → `ConfirmButton` „Pauza" (existing semantics); status DRAFT/PAUSED → `Button variant="primary"` „Aktywuj wysyłkę" (existing `activateCampaign`; disabled with a `text-fg-faint` hint when no mailbox is set). Role gating exactly as today: activate visible for ADMIN+ (`canManageSending`), Pauza visible for everyone.
- Metrics: the existing `MetricStat` row restyles into a full-width hairline strip (one `Card`, `divide-x divide-border`, stats with uppercase labels — dashboard hero idiom). Same six values, no query change.

### 2.2 Tabs

Client component `campaign-tabs.tsx` (one consumer — NO new generic primitive; settings-shell idiom: `useState` active id, `AnimatePresence mode="wait"` fade 0.24s ease-out-quart, `useReducedMotion` snap):

- Tab list: „Sekwencja" / „Leady i wysyłka" / „Przychodzące" (+ count suffix `text-fg-faint` when > 0). Active tab: `text-fg` + 2px accent underline (`border-b-2 border-accent` or `after:` bar). Inactive: `text-fg-muted hover:text-fg`. **This adds one entry to the accent allowlist** — it is literally the user's „kreska zaznaczająca aktywną zakładkę".
- Tab 1 **Sekwencja**: step cards (§2.3) + the add-step form below them (same fields/names as today).
- Tab 2 **Leady i wysyłka**: the mailbox `Select` + „Zapisz skrzynkę" form (ADMIN-gated as today, moved out of the old „Wysyłka" section; the standalone Aktywuj button moves to the header) and the „Przypisz leady" form (unchanged contract). The „Brak skrzynek → Połącz skrzynkę" note stays here.
- Tab 3 **Przychodzące**: the `LeadInbox` rows, visually aligned to Card rows (avatar-less; keep current content + `markDoNotContact`).
- Server actions revalidate the page; tab state lives in the client component so it survives refreshes of server content.

### 2.3 Step cards: edit + reorder

Read mode (one Card row per step): number chip (`#1` in a `size-[16px+] rounded-full bg-surface-3` circle), template name or „draft AI" (+ existing neutral Badge), meta „po N dniach · {CONDITION_LABEL}", actions right: ▲ ▼ (reorder), „Edytuj", existing `ConfirmButton` Usuń.

- **Edit (inline):** „Edytuj" swaps the card content for a form with the SAME fields as add-step (template Select, delayDays Input, condition Select, useLeadDraft checkbox) prefilled, + Zapisz/Anuluj. Submit → `updateSequenceStep`. Only one card edits at a time (local state).
- **Reorder:** ▲▼ call `moveSequenceStep(stepId, dir, campaignId)` (§2.4 signature) — a `$transaction` swapping the `order` values of the step and its neighbor (orders stay dense; first ▲ and last ▼ disabled).
- **Safety gating (engine-grounded):** reorder is allowed ONLY when `campaign.status !== "ACTIVE"` — arrows disabled with hint „Wstrzymaj kampanię, aby zmienić kolejność" and the server action rejects ACTIVE too (guard in the action, not just UI). Field edits are allowed in any status. Rationale, verified in `lib/inngest/sending.ts`: the handler re-reads steps + `currentStep` fresh on every Inngest replay (top-level prisma reads re-execute after each `sleepUntil`), and the cursor is gap-safe (`steps.find(s => s.order >= cursor)`); therefore content/delay/condition edits take effect at each lead's next wake-up harmlessly, but REORDERING across a lead's cursor can re-send an already-sent template or skip one — hence the not-ACTIVE gate.

### 2.4 New actions + helper (`features/campaigns/actions.ts` + pure helper)

- `updateSequenceStep` — Zod (stepId, campaignId, templateId, delayDays >= 0, condition enum, useLeadDraft boolean), org-scoped via the campaign relation, `revalidatePath`. MEMBER-allowed (same level as today's add/delete).
- `moveSequenceStep(stepId, dir, campaignId)` — org-scoped; loads the campaign (rejects `status === "ACTIVE"`), finds the neighbor by order, transactional two-row swap. No-op result (friendly error) when the step is already at the boundary.
- Pure helper `features/campaigns/reorder.ts`: `planSwap(steps: {id, order}[], stepId, dir)` → `{a: {id, order}, b: {id, order}} | null` — TDD (+~4 cases: middle swap both directions, boundary no-ops, single-step list).
- Comment touch-up: `lib/inngest/sending.ts:39` says „Steps + placeholders loaded once; mid-flight sequence edits are not picked up" — imprecise (top-level reads re-execute per replay, so edits ARE picked up at the next wake). Update the comment to the true semantics. ZERO code-path changes in this file.

## 3. Micro-fixes (from design-refinement reviews)

1. `app/(app)/pipeline/board.tsx` drag-over: `bg-surface-3` → `bg-surface-3 ring-1 ring-border-strong` (mono strengthener for the weak light-theme delta).
2. `components/ui/table.tsx`: tbody rows gain `transition-colors hover:bg-surface-2/50` (restores an interactivity cue for flat data links in /leady and batch-view; applies to all Table consumers consistently — verify the mapping-table in the import wizard tolerates it, it does: hover on a config table is harmless).
3. Quiet „Nowy szablon" CTA — resolved by §1.4 (header action becomes a Button).
4. `app/globals.css` light `--border-focus`: `rgba(9,9,11,.45)` → `rgba(9,9,11,.55)` (focus contrast at the WCAG margin; dark stays .55).
5. `app/(app)/skrzynki/mailbox-settings-form.tsx` day chips: add a visible keyboard indicator on the chip span — `peer-focus-visible:[outline:2px_solid_var(--ring)] peer-focus-visible:outline-offset-2` (accent keyboard ring = allowlisted).

## 4. Out of scope / unchanged

- Sending engine logic, activation/pause/mailbox actions, `LeadInbox` data flow, `markDoNotContact`, metrics queries, add/delete step actions, `createTemplate`, `deleteTemplate`, render logic (`features/templates/render.ts`), palette insert mechanics.
- No migration; no new dependencies; both themes stay at parity.
- Role model unchanged (new actions MEMBER-level like their add/delete siblings; activate/mailbox stay ADMIN-gated).

## 5. Verification

- TDD for `planSwap` (+~4 tests) and Zod schema edge (delayDays negative rejected) if the existing actions' schemas are tested — follow the existing test pattern in `features/`.
- Gates: `tsc` 0, `vitest` green (count grows by the new pure tests), `eslint` clean on touched dirs, `npx next build` (coordinate: dev server must be OFF).
- Guard greps: accent allowlist grows by EXACTLY two sites — the campaign tab underline (`border-accent` in `campaign-tabs.tsx`) and the templates rail active kreska (`before:bg-accent` in `templates-shell.tsx`, the §1.1 settings-shell idiom); re-run the design-refinement guards (`bg-glow`, `0_0_0_3px`, `shadow-[` all still zero).
- Form-contract diff: templates form gains only `templateId`; add-step form unchanged; new update/move actions are net-new names.
- Manual smoke list for the user (:3000, both themes): edit a template used by a sequence (the impossible-today case), switch rail items with unsaved changes (dirty dialog), create from „+ Nowy szablon", campaign tabs incl. counter, inline step edit on an ACTIVE campaign, reorder arrows disabled on ACTIVE + enabled after Pauza, table row hover on /leady, day-chip Tab focus on /skrzynki.

## 6. Implementation notes

- Slices: (1) micro-fixes (tiny, independent), (2) templates server action + page/client rebuild, (3) campaign actions + helper (TDD), (4) campaign page/tabs rebuild, (5) gates. Tokens/primitives need no changes beyond §3.
- `graphify update .` after code changes; the user pushes; Claude may commit.
