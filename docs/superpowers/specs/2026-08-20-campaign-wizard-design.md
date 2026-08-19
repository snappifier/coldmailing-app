# Campaign wizard — design

Date: 2026-08-20. Status: user-approved direction (brainstormed live: modal over page, campaign-private templates, filter-based lead selection, activate-or-draft finale).

## Goal

One flow from zero to a sending campaign: **„+ Nowa kampania" opens a 4-step modal wizard** that writes messages, picks leads and (optionally) activates — replacing today's 5-stop journey (/szablony editor → campaign modal → sequence tab → mailbox+leads tab → activate). The existing campaign detail tabs remain the EDITING surface; the wizard is the creation fast path. The old small create-campaign modal is removed.

## UX

- **Container:** a WIDE modal — `components/ui/modal.tsx` gains an optional size variant (~`w-[640px] max-w-[calc(100vw-32px)]`); existing consumers keep the current width. Message writing needs room; this was weighed against a full page and the user picked the modal.
- **Wizard language = the proven lead-wizard/import idiom:** ONE `<form>`, all steps MOUNTED with `hidden` (uncontrolled values survive back/forward, FormData stays flat), imperative `animate()` slide x±12, „Krok X z 4" + 2px spring progress bar, `useReducedMotion` snaps. Per-step `reportValidity` before advancing.
- **Dirty-close guard:** closing with any non-empty field asks `useConfirm` („Odrzucić szkic kampanii?").

### Steps

1. **Podstawy** — nazwa kampanii (required) + linia ofertowa (`Select`, optional).
2. **Wiadomości** — message 1 (temat + treść, placeholder palette with insert-at-caret, same as /szablony editor); „+ dodaj follow-up" adds up to 3 follow-ups, each with temat/treść + „po N dniach" (`NumberInput`, default 4, min 1) and a remove button. Conditions are implicit and NOT asked: step 1 `ALWAYS`, follow-ups `SEND_IF_NO_REPLY`. `useLeadDraft` is not exposed (edit later in tabs).
3. **Leady** — filter trio matching /leady: linia (defaults to step 1 choice), min. score, szukaj. A debounced (300ms) read-only server action returns `{count, sample}` rendered as „**Obejmie N leadów**" + up to 4 sample names. Selection semantics = the existing assign-leads logic: org-scoped, requires email, excludes suppression, skips leads already in the campaign.
4. **Start** — summary (X wiadomości, N leadów, linia) + mailbox `Select` (ADMIN only; preselects the org's single mailbox) and the finale: **„Zapisz jako szkic"** (always available) or **„Aktywuj teraz"** (enabled only when ADMIN ∧ mailbox chosen ∧ count > 0). MEMBER sees only the szkic path. Success: toast + navigate to `/kampanie/[id]`.

## Data model & template privacy

- **No migration.** Wizard-created templates use existing fields: name `"«campaign» — krok N"`, `visibility: TEAM`, **`folder: WIZARD_FOLDER`** (a sentinel constant, e.g. `"__kreator__"`).
- **/szablony library and the sequence-step template dropdown EXCLUDE `folder = WIZARD_FOLDER`** — the library stays a curated set of reusable patterns; wizard templates remain fully functional for their campaign (steps render/edit them via the campaign tabs as today).

## Server

- `features/campaigns/actions.ts` → **`createCampaignFromWizard(prev, formData)`**, one `$transaction` (all-or-nothing): create templates → campaign (`DRAFT`) → sequence steps → resolve leads by criteria → `createMany` campaignLeads. When `mode=activate`: validate `requireRole("ADMIN")` + org-owned mailbox, set `sendingEmailAccountId` + `status: ACTIVE` inside the tx, and **emit `campaign/lead.start` events AFTER the tx commits** (mirror of `activateCampaign` — no events on rollback). Returns `{ok: true, campaignId}` or a friendly error (e.g. duplicate name — `@@unique([organizationId, name])`).
- **`countWizardLeads(criteria)`** — read-only org-scoped action for step 3's live count.

## Pure logic (TDD)

- `features/campaigns/wizard.ts`: `parseWizardMessages(fields)` → validated message list from flat names; rules: 1–4 messages, trimmed non-empty subject/body, follow-up delay 1–30. `buildWizardTemplateName(campaignName, index)`.
- **Form field contract (frozen):** `name`, `offeringLineId`, `subject_0..3`, `body_0..3`, `delay_1..3`, `filter_line`, `filter_minScore`, `filter_q`, `mailboxId`, `mode` (`draft`|`activate`).

## Invariants

- Sending engine untouched. `activateCampaign`, campaign tabs, reorder gating — unchanged.
- Wizard creates only; editing lives in the existing tabs.
- Suppression/dedupe handled by the assignment query, not the UI.

## Testing & gates

- Vitest: `parseWizardMessages` cases (counts, trims, delay bounds, missing fields).
- Form-contract set-diff over the change; guard grep: no `<form>` inside the modal besides the wizard's one.
- `tsc`, `eslint`, `next build` (dev OFF).

## Out of scope

Editing existing campaigns via the wizard; per-lead exclusions (variant C was declined); exposing `useLeadDraft`/conditions in the wizard; template library management changes beyond the folder filter.
