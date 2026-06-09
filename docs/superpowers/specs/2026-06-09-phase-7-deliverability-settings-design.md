# Phase 7 — deliverability-settings — Design

Date: 2026-06-09. Status: spec ready (design approved — **Config only**, curated timezone). Sub-project #6 (build
order) of Phase 7. Objective, M-sized. Depends on `design-foundation` (Field/Input/Select/Button/Note primitives +
tokens). No DB migration — every field already exists on `EmailAccount`. Visual reference:
`docs/superpowers/design/deliverability-mock/index.html` (the "Wysyłka i pacing" section is what we build; the
mock's health + SPF/DKIM/DMARC sections are OUT of scope per the scope decision).

## Goal

Give each connected mailbox an editable UI for the send-pacing config that the sending engine already reads but
that today has no editor (`/skrzynki` shows only a read-only `dailyLimit`). Expose: daily limit, send window,
send days, randomized gap, and timezone — saved via a new `updateEmailAccountSettings` action.

## Scope

**IN:** an editable per-mailbox send-config form on `/skrzynki` (daily limit, send window start/end, send days,
min/max gap, timezone) + the `updateEmailAccountSettings` server action + pure conversion/validation helpers.

**OUT (deferred per the scope decision):** the dedicated mailbox-health section and the SPF/DKIM/DMARC
deliverability guidance panel. (The existing minimal status + reply-detection indicators stay in the card header —
not a new health section.) Also out: warmup ramp (no `warmupState` field exists), any migration.

## Data model

No migration. The seven engine-used fields already on `EmailAccount` (`prisma/schema.prisma:509`):
`dailyLimit` (Int, def 40), `sendWindowStartMin` (def 480 = 08:00), `sendWindowEndMin` (def 960 = 16:00),
`sendDays` (Int bitmask, def 31 = Mon-Fri; **bit0=Mon .. bit6=Sun**), `minGapSec` (def 180), `maxGapSec` (def 600),
`timezone` (String, def "Europe/Warsaw"). These map 1:1 to the engine's `PacingAccount`
(`features/sending/schedule.ts`).

## Pure logic — `features/email-accounts/settings.ts` (unit-tested)

```ts
export const TIMEZONES: string[]   // curated: Europe/Warsaw, Europe/London, Europe/Berlin, Europe/Paris,
                                   // Europe/Kyiv, UTC, America/New_York, America/Los_Angeles

export function parseTime(hhmm: string): number | null   // "HH:MM" -> minutes 0..1439, else null
export function formatTime(min: number): string          // 480 -> "08:00" (zero-padded)
export function maskToDays(mask: number): boolean[]       // 31 -> [T,T,T,T,T,F,F]  (Mon..Sun, length 7)
export function daysToMask(days: boolean[]): number       // [T,T,T,T,T,F,F] -> 31
export function isValidTimezone(tz: string): boolean      // try `new Intl.DateTimeFormat(undefined,{timeZone:tz})`

export interface SettingsInput {
	dailyLimit: number
	windowStartMin: number | null
	windowEndMin: number | null
	sendDays: number
	minGapSec: number
	maxGapSec: number
	timezone: string
}
export interface SettingsFields {
	dailyLimit: number; sendWindowStartMin: number; sendWindowEndMin: number
	sendDays: number; minGapSec: number; maxGapSec: number; timezone: string
}
export function validateEmailAccountSettings(input: SettingsInput):
	| {ok: true; value: SettingsFields}
	| {ok: false; error: string}
```

`validateEmailAccountSettings` rules (first failing rule wins; messages are Polish, surfaced in the form):
- `dailyLimit`: integer in `1..1000`, else "Dzienny limit musi być z zakresu 1-1000".
- window: both parsed (non-null), `0 <= start < end <= 1440`, else "Okno wysyłki: podaj poprawny początek wcześniejszy niż koniec".
- gap: integers, `0 <= minGapSec <= maxGapSec <= 86400`, else "Odstęp: 0 ≤ min ≤ maks ≤ 86400 s".
- `sendDays`: integer in `1..127` (mask non-zero — at least one day), else "Wybierz co najmniej jeden dzień wysyłki".
- `timezone`: `isValidTimezone`, else "Nieprawidłowa strefa czasowa".
- on success `value` is the exact `EmailAccount` update payload.

## Action — `features/email-accounts/actions.ts` (add to the existing `use server` module)

```ts
export type EmailAccountSettingsResult = {ok: true} | {ok: false; error: string}

export async function updateEmailAccountSettings(
	_prev: EmailAccountSettingsResult | null,
	formData: FormData,
): Promise<EmailAccountSettingsResult>
```
- `id = String(formData.get("id"))`.
- Build `SettingsInput`: `dailyLimit = Number(...)`; `windowStartMin = parseTime(String(formData.get("windowStart")))`,
  same for `windowEnd`; `sendDays = daysToMask([0..6].map(i => formData.get(\`day_${i}\`) === "on"))`;
  `minGapSec = Number(gapMin)`, `maxGapSec = Number(gapMax)`; `timezone = String(formData.get("timezone"))`.
- `validateEmailAccountSettings(input)` -> on failure return `{ok:false, error}`.
- `const res = await prisma.emailAccount.updateMany({where: {id, organizationId: orgId}, data: value})`;
  `if (res.count === 0) return {ok:false, error:"Nie znaleziono skrzynki"}`.
- `revalidatePath("/skrzynki")`; return `{ok:true}`. Org-scoped via `requireOrg()` (same as `disconnectEmailAccount`).

## Query — `features/email-accounts/queries.ts`

Extend `listEmailAccounts`'s `select` to add `sendWindowStartMin, sendWindowEndMin, sendDays, minGapSec, maxGapSec,
timezone` (it already returns `id, email, displayName, status, dailyLimit, scope, createdAt`).

## UI

`/skrzynki` (`app/(app)/skrzynki/page.tsx`): each mailbox becomes a card. The header keeps the existing info
(email, status, reply-detection indicator, `ConfirmButton` Odłącz). Below it, render a new client component
`<MailboxSettingsForm account={a} timezones={TIMEZONES} />`.

`app/(app)/skrzynki/mailbox-settings-form.tsx` (new, `"use client"`): a `<form action={action}>` driven by
`useActionState(updateEmailAccountSettings, null)`, mostly uncontrolled (defaults from `account`):
- hidden `id`.
- `Field "Dzienny limit"` -> `<Input type="number" name="dailyLimit" defaultValue min={1} max={1000}>`.
- `Field "Okno wysyłki"` -> two `<input type="time" name="windowStart"|"windowEnd" defaultValue={formatTime(...)}>`
  (native HH:MM picker).
- `Field "Dni wysyłki"` -> seven checkbox chips `day_0..day_6` (Pn Wt Śr Cz Pt Sb Nd), `defaultChecked` from
  `maskToDays(account.sendDays)`, styled with the `peer` pattern (checked = accent chip).
- `Field "Odstęp między mailami"` -> two `<Input type="number" name="gapMin"|"gapMax">` (seconds) + hint "losowy".
- `Field "Strefa czasowa"` -> `<Select name="timezone" defaultValue={account.timezone}>` over `timezones`; if
  `account.timezone` is not in `TIMEZONES`, prepend it as an option so the saved value is preserved.
- `<Button type="submit" variant="primary" disabled={pending}>Zapisz ustawienia</Button>`.
- `useEffect` -> on `state.ok` `toast("Zapisano ustawienia skrzynki")`; on `state.ok === false` show
  `<Note variant="danger">{state.error}</Note>` (or inline `text-danger`).

## Testing

- TDD `features/email-accounts/settings.test.ts` (new): `parseTime` (valid/invalid/edge "00:00"/"23:59"/"24:00"->null),
  `formatTime` (480 -> "08:00"), `maskToDays`/`daysToMask` round-trip (31 <-> Mon-Fri; 127 <-> all; 0 <-> none),
  `isValidTimezone` ("Europe/Warsaw" true, "Mars/Phobos" false), and `validateEmailAccountSettings` (happy path +
  each failing rule: bad limit, start>=end, maxGap<minGap, zero days, bad tz).
- `tsc` 0, `eslint "app/(app)" features components` clean, `next build` green, `vitest` green (+ the new cases).
- Manual (optional, dev server): edit a mailbox's window/days/limit, save, confirm the toast and that the values
  persist on reload.

## Risks / notes

- The pacing fields directly govern real sending; bad values could stop sends. The validation bounds (non-zero
  days, start<end, sane gap) prevent the worst footguns; the engine already tolerates an empty window by deferring.
- `<input type="time">` yields "HH:MM" exactly matching `parseTime`; no locale parsing needed.
- Timezone is validated by `isValidTimezone` (any real IANA zone passes), so a pre-existing custom value survives a
  save even though the curated select only lists common zones.
- All writes org-scoped through `updateMany({where:{id, organizationId}})` — no cross-org edit.
