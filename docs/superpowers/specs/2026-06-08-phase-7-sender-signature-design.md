# Phase 7 — Per-org sender signature ({{podpisNadawcy}}) — Design

Date: 2026-06-08. Status: brainstorm approved (pending spec review). Sub-project 1 of Phase 7 (visual
design / polish), and the recommended AFK-safe first step (objective, no design dependency). Builds on
Phase 3 (`renderTemplate`), Phase 4 (sending worker), Phase 5c (org settings page).

## Problem (verified)

`{{podpisNadawcy}}` ("sender signature") is a documented built-in placeholder (`features/templates/render.ts:39`,
resolves from `ctx.senderName`). But `senderName` is fed from **two different sources**:

- **Send path** (`lib/inngest/sending.ts:111`): `senderName: account.displayName ?? ""` -> the sending
  mailbox's display name.
- **Editor preview** (`app/(app)/szablony/page.tsx:40`): `senderName={session?.user?.name ?? "Zespol"}` ->
  the logged-in user's name.

So the same token renders differently in the editor preview than in the email recipients actually receive.
There is also **no per-org signature field** anywhere in the schema or UI (the roadmap, line 86, explicitly
defers "per-org sender signature (replaces `{{podpisNadawcy}}` = user name)" to Phase 7).

## Goal

One per-org sender signature, edited in `/ustawienia`, used as the single source for `{{podpisNadawcy}}`
in **both** the preview and the live send. When the signature is unset, fall back to the sending mailbox's
display name (preserving today's working send behavior) **and surface a visible flag** so the fallback is
never silent.

## Key decisions (from the brainstorm)

- **Scope = per-org** (`Organization.senderSignature`). Matches the roadmap, and is the only source the
  editor preview can read reliably (a template is not tied to a campaign/mailbox), so it makes preview
  match send exactly when set. Per-mailbox override is explicitly deferred (YAGNI).
- **Empty-signature fallback = mailbox display name, flagged** (the user's "option 2 + flag"). Empty
  signature -> `account.displayName` in send (unchanged from today) / the org's first connected mailbox
  name in preview, with a flag in the settings field and the editor preview noting the signature is unset.
- **Plain multi-line text, no recursion.** The signature value is substituted verbatim; a signature that
  itself contains `{{...}}` is NOT re-rendered (`renderTemplate` does a single replace pass). YAGNI.
- **`render.ts` is unchanged.** `{{podpisNadawcy}}` already reads `ctx.senderName`; the fix is purely about
  feeding `senderName` from one place.

## Data model (migration `phase7_sender_signature`)

Additive: `Organization += senderSignature String @default("")`. No other change.

## Single source of truth (pure)

`features/templates/sender.ts` (new, unit-tested):

- `resolveSenderName(opts: {signature: string | null; fallback: string | null}): string`
  -> `(opts.signature ?? "").trim() || (opts.fallback ?? "").trim() || ""`.
  Used by BOTH the send path and the preview, so the value is computed in exactly one place.
- `sanitizeSignature(input: string): string` -> `input.trim().slice(0, MAX_SIGNATURE_LEN)`
  (`MAX_SIGNATURE_LEN = 2000`). Used by the save action.

`renderTemplate` then maps `{{podpisNadawcy}}` -> `senderName || null` (existing behavior): a non-empty
resolved value renders verbatim; an empty one renders the standard `[brak: podpisNadawcy]` missing marker
(only possible when both the signature AND the fallback mailbox name are empty).

## Send path (`lib/inngest/sending.ts`)

- Load the org signature once near the existing placeholder load (`runLeadSequenceHandler`):
  `const org = await prisma.organization.findUnique({where: {id: base.campaign.organizationId}, select: {senderSignature: true}})`.
- In the per-step render context, replace `senderName: account.displayName ?? ""` with
  `senderName: resolveSenderName({signature: org?.senderSignature ?? "", fallback: account.displayName ?? ""})`.
- `account` is loaded per iteration (as today); `org` is loaded once. No other change. The draft-send path
  (2d-4) bypasses `renderTemplate` entirely, so it is unaffected.

## Editor preview (`app/(app)/szablony/page.tsx`)

- Fetch the org signature and the org's first connected mailbox display name:
  - add `prisma.organization.findUnique({where: {id: orgId}, select: {senderSignature: true}})` and
    `prisma.emailAccount.findFirst({where: {organizationId: orgId, status: "CONNECTED"}, orderBy: {createdAt: "asc"}, select: {displayName: true}})`
    to the existing `Promise.all`.
- Pass `senderName={resolveSenderName({signature: org.senderSignature, fallback: previewMailboxName})}` to
  `TemplateEditor`, plus `signatureSet={Boolean(org.senderSignature.trim())}` and
  `previewMailboxName` (string | null) for the flag.
- Remove the now-unused `auth()` / `session` lookup (it was only used to feed `senderName`).

## Editor flag (`app/(app)/szablony/template-editor.tsx`)

- New props `signatureSet: boolean`, `previewMailboxName: string | null`.
- When `!signatureSet`, render a small amber note near the live preview:
  "Podpis nadawcy nieustawiony w Ustawieniach - podglad i wysylka uzyja nazwy skrzynki
  (`{previewMailboxName ?? "-"}`). Ustaw podpis, aby byl spojny." When `signatureSet`, no note.
- No change to how the preview renders otherwise.

## Settings UI (`/ustawienia`)

- New pure-ish server action `setSenderSignature(_prev, formData)` in `features/org/settings.ts`
  (org-scoped via `requireOrg`): `senderSignature: sanitizeSignature(String(formData.get("senderSignature") ?? ""))`,
  `revalidatePath("/ustawienia")`, returns `{ok: boolean}`. Separate from `setOrgInboundSettings`
  (different concern: sending identity vs inbound opt-out).
- Extend `getOrgSettings` to also return `senderSignature` (select it).
- New client `SenderSignatureForm` (own file `app/(app)/ustawienia/sender-signature-form.tsx`) with a
  multi-line `<textarea name="senderSignature">` (defaultValue = current signature), a save button with
  pending state, and a "Zapisano." confirmation. When the trimmed value is empty, show the inline flag
  "Nieustawiony - przy wysylce zostanie uzyta nazwa skrzynki."
- `app/(app)/ustawienia/page.tsx` renders the new form below the existing opt-out `SettingsForm`, under a
  "Podpis nadawcy" heading.

## Modules / files

- `prisma/schema.prisma` - `Organization.senderSignature`.
- `features/templates/sender.ts` (new, pure) + `features/templates/sender.test.ts`.
- `features/templates/render.test.ts` - add `{{podpisNadawcy}}` cases (resolve + empty -> `[brak]`).
- `lib/inngest/sending.ts` - load org signature, feed `senderName` via `resolveSenderName`.
- `app/(app)/szablony/page.tsx` - feed `senderName` from org signature + mailbox fallback; pass flag props;
  drop `auth()`.
- `app/(app)/szablony/template-editor.tsx` - flag note + new props.
- `features/org/settings.ts` - `getOrgSettings` += `senderSignature`; new `setSenderSignature`.
- `app/(app)/ustawienia/page.tsx` - render the new form.
- `app/(app)/ustawienia/sender-signature-form.tsx` (new client component).

## Testing

- `sender.test.ts`: `resolveSenderName` - signature wins (trimmed); empty signature -> fallback (trimmed);
  both empty -> `""`; whitespace-only signature -> fallback. `sanitizeSignature` - trims; caps at 2000.
- `render.test.ts`: `{{podpisNadawcy}}` with a non-empty `senderName` -> that value; with `senderName: ""`
  -> `[brak: podpisNadawcy]` + listed in `missing`.
- The `sending.test.ts` integration test mocks `renderTemplate` to identity, so `senderName` is not
  observable there; the send-side change (one assignment + one org read) is covered by `tsc` + the
  `sender.test.ts` chokepoint. Add an `organization.findUnique` stub to the prisma mock so the new read
  does not break the existing cases.
- Gates: `tsc` 0, `vitest` green (190 + new), `next build` green; production code eslint-clean.

## Risks / notes

- **Behavior change (intended):** existing templates using `{{podpisNadawcy}}` previously previewed the
  logged-in user's name; now, until the org signature is set, the preview shows the connected mailbox name
  (with a flag) and send shows the mailbox name (unchanged). After the user sets the signature once,
  preview == send exactly.
- **Preview with multiple mailboxes:** the preview fallback uses the first connected mailbox; if a campaign
  sends through a different mailbox while the signature is unset, the names differ - the flag says exactly
  this, and setting the signature removes the ambiguity entirely.
- **No live run needed:** this is pure code/data + UI; verified by tsc/vitest/build (no `ANTHROPIC_API_KEY`,
  no Inngest run). A manual smoke test (set a signature, check the editor preview + a send) is optional.
- Not a visual-design task - it uses the existing raw-Tailwind style; the broader visual pass
  (design-foundation, etc.) comes later in Phase 7.
