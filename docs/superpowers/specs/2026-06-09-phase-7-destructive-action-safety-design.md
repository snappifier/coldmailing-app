# Phase 7 — destructive-action-safety — Design

Date: 2026-06-09. Status: spec ready (design approved). Sub-project #3 (build order) of Phase 7. Objective,
M-sized. Depends on `design-foundation` (the `ConfirmProvider`/`useConfirm` + `ToastProvider`/`useToast` +
`Button`/`Spinner` primitives + tokens all exist and the providers are mounted in `app/(app)/layout.tsx`).

## Goal

Stop 13 destructive actions from firing on a single click. Add a confirmation dialog, consistent destructive
styling, and a pending state to every delete / disconnect / pause / cancel action across the app — reusing the
existing `useConfirm` (Promise-based) + `useToast` primitives, which today are defined and mounted but **used
nowhere**. This is their first adoption.

## Scope

**IN:**
- A new client primitive `components/ui/confirm-button.tsx` (`<ConfirmButton>`).
- Adopt it at the 13 destructive sites listed below (confirm gate + pending + danger styling + success toast).
- Two of the sites are already client `onClick` handlers (`cancelBatch`, plus the `disconnect` inline closure);
  gate them appropriately rather than forcing the primitive where it does not fit.

**OUT:**
- Any change to the server actions themselves (they already org-scope + `revalidatePath`; verified).
- Broader primitive adoption / layout / copy polish (stays in `page-level-visual-pass`).
- Confirmations on non-destructive or local-only actions (see Excluded).

## The primitive — `components/ui/confirm-button.tsx`

A `"use client"` component built on `Button` + `Spinner` + `useConfirm` + `useToast`:

```tsx
interface Props {
	action: () => Promise<unknown>   // a bound server action thunk, e.g. deleteLead.bind(null, id)
	confirm: ConfirmOptions          // {title, body?, confirmLabel?, cancelLabel?, danger?}
	children: React.ReactNode        // button label, e.g. "Usuń"
	variant?: ButtonVariant          // default "danger"
	size?: "sm" | "md"               // default "sm"
	toast?: string                   // optional success toast text
	className?: string
}
```

Behavior: on click, `await useConfirm()(confirm)`; if false, return. If true, run the action inside
`useTransition` (`pending` -> the `Button` is `disabled` and shows a leading `Spinner`); after the action
resolves, fire `useToast(toast)` when `toast` is set. Renders `<Button type="button" variant size disabled>`.

Notes:
- Replaces the `<form action={X.bind(null,id)}><button>Usuń</button></form>` pattern with
  `<ConfirmButton action={X.bind(null,id)} confirm={...} toast="...">Usuń</ConfirmButton>`. A server component
  may pass a bound server action as a prop to this client component (server actions are serializable).
- Dropping the no-JS `<form>` submit (progressive enhancement) is acceptable for this internal, JS-always tool;
  the gain is one consistent confirm + pending + toast path. All target actions `revalidatePath`, so invoking
  them from a client transition still refreshes the page exactly as the form submit did (verified per action).
- The toast fires from the layout-level `ToastProvider` (stable), so it still shows even when the trigger
  button unmounts because its list row was revalidated away.

## Adoption sites (13)

`v` = ConfirmButton `variant`; `d` = `confirm.danger`. Confirm copy is Polish; bodies kept short.

| # | Action (bound args) | File | v / d | Confirm title — body | confirmLabel | toast |
|---|---|---|---|---|---|---|
| 1 | `deleteResearchType(id)` | `badania/page.tsx` | danger / true | "Usunąć typ badania?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto typ badania |
| 2 | `deletePlaceholder(id)` | `placeholdery/page.tsx` | danger / true | "Usunąć placeholder?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto placeholder |
| 3 | `deleteOfferingLine(id)` | `linie/page.tsx` | danger / true | "Usunąć linię usług?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto linię |
| 4 | `deleteTemplate(id)` | `szablony/page.tsx` | danger / true | "Usunąć szablon?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto szablon |
| 5 | `deleteCampaign(id)` | `kampanie/page.tsx` | danger / true | "Usunąć kampanię?" — "Kampania i jej powiązania zostaną usunięte. Tej operacji nie można cofnąć." | Usuń | Usunięto kampanię |
| 6 | `deleteLead(id)` | `leady/page.tsx` | danger / true | "Usunąć leada?" — "Lead i jego dane zostaną usunięte. Tej operacji nie można cofnąć." | Usuń | Usunięto leada |
| 7 | `deleteLeadActivity(id)` | `leady/[id]/timeline.tsx` | danger / true | "Usunąć wpis?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto wpis |
| 8 | `deleteSequenceStep(id, campaignId)` | `kampanie/[id]/sequence-and-leads.tsx` | danger / true | "Usunąć krok sekwencji?" — "Tej operacji nie można cofnąć." | Usuń | Usunięto krok |
| 9 | `removeSuppression(id)` | `suppression/page.tsx` | danger / true | "Usunąć z listy wykluczeń?" — "Adres będzie mógł ponownie otrzymywać wiadomości." | Usuń | Usunięto z wykluczeń |
| 10 | `disconnectEmailAccount(id)` | `skrzynki/page.tsx` | danger / true | "Odłączyć skrzynkę?" — "Odłączenie usuwa też historię wiadomości tej skrzynki i wyłącza wykrywanie odpowiedzi. Tej operacji nie można cofnąć." | Odłącz | Odłączono skrzynkę |
| 11 | `pauseCampaign(campaignId)` | `kampanie/[id]/sending-controls.tsx` | secondary / false | "Wstrzymać kampanię?" — "Wysyłka zostanie zatrzymana, a trwające sekwencje przerwane. Możesz wznowić później." | Wstrzymaj | Wstrzymano kampanię |
| 12 | `cancelBatch(batchId)` | `badania/batches/[id]/batch-view.tsx` | secondary / false | "Anulować badanie zbiorcze?" — "Oczekujące zadania zostaną anulowane." | Anuluj badanie | Anulowano badanie |
| 13 | `markDoNotContact(campaignLeadId)` | `kampanie/[id]/lead-inbox.tsx` | danger / true | "Oznaczyć: nie kontaktować?" — "Adres trafi na listę wykluczeń, a sekwencja zostanie zatrzymana." | Nie kontaktować | Oznaczono: nie kontaktować |

### Two special cases (not a plain `<form>` -> `<ConfirmButton>` swap)

- **#12 `cancelBatch`** (`batch-view.tsx`) already has a client `onClick` that needs the action's
  `BatchActionResult`. Do NOT use `ConfirmButton`. Gate the existing handler:
  `if (!(await ask({title, body, confirmLabel:"Anuluj badanie", cancelLabel:"Anuluj", danger:false}))) return`
  then keep the existing `cancelBatch(batchId)` call; add a success toast. (Both confirm-button and dialog can
  read "Anuluj" — the left/dismiss button is "Anuluj", the right/confirm is "Anuluj badanie".)
- **#10 `disconnectEmailAccount`** (`skrzynki/page.tsx`) is currently an inline `<form action={async () => {"use
  server"; ...}}>`. Replace with `<ConfirmButton action={disconnectEmailAccount.bind(null, a.id)} ...>` (drop
  the inline closure; `skrzynki/page.tsx` stays a server component passing the bound action down).

## Excluded (documented — do NOT add a confirm)

- `research-type-form.tsx` "Usuń" (`removeField(i)`) — removes an **unsaved** output-field row from local form
  state, not persisted data; reversible by re-adding. Confirming local edits would be noise.
- "Wyloguj" (sign-out, `app/(app)/layout.tsx`) — routine, not destructive.

## Wiring / conventions

- Providers already mounted (`ToastProvider` > `ConfirmProvider`) in `app/(app)/layout.tsx` — no layout change.
- Conventions: tabs, no semicolons, path comment on line 2 after `"use client"`, `className` first, no emoji.
- `confirm.danger=true` renders the dialog's confirm button in the `danger` variant; `false` -> `primary`.
- Reversible actions (#11 pause, #12 cancel) keep a neutral `secondary` trigger; everything else uses `danger`.

## Testing

- `tsc` 0, `eslint "app/(app)" components` clean, `next build` green.
- `vitest` unchanged at 207 (the existing `confirm-state` / `button-variant` / `toast-reducer` pure tests still
  pass; `ConfirmButton` is glue — no new pure logic worth a unit test).
- Manual smoke (optional, needs the dev server): each trigger opens the dialog; Cancel aborts; Confirm runs the
  action, shows the spinner, then the toast, and the list refreshes.

## Risks / notes

- **Highest-impact confirm = #10 disconnect** (cascade-deletes `Message` rows + disables reply detection) and
  #5/#6 (campaign/lead with relations). Bodies call this out.
- Toast-after-unmount: safe (provider is layout-level); if a toast is ever dropped it is non-critical feedback.
- Keep each adoption a minimal, local edit (swap the trigger element; do not restructure the surrounding markup).
