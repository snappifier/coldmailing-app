# Dashboard redesign (pulpit) — Design

Date: 2026-06-10. Status: spec approved (design chosen via visual mock — variant B "single canvas", full scope
incl. sparkline + replies feed). Post-Phase-7 polish. Size M. Depends on design-foundation tokens/primitives,
`features/metrics` (dashboards sub-project), and `features/enums/labels.ts`.
Visual reference: `.superpowers/brainstorm/1404-1781078715/content/dashboard-directions.html` (variant B).

## Goal

Replace the current "AI slop" pulpit (8 identical KPI tiles, two generic boxed panels, chunky funnel bars, a raw
`{c.status}` enum leak, no trend) with a Vercel/Linear-grade dashboard: ONE Card canvas with hairline-divided
sections — 4 hero numbers, a 30-day sends sparkline with a sending-health strip, a thin-bar funnel next to a
recent-replies feed, and a flat campaigns table with status Badges. All server-rendered (zero client JS), no new
tracking, no migration.

## Approved direction (user choices)

- Scope: **restyling + 30-day sends sparkline + recent-replies feed** ("command center", option 3).
- Layout: **variant B — single canvas** (one `Card`, sections divided by horizontal hairlines), over variant A
  (open hairline layout).

## 1. Data — `features/metrics` extension (no migration)

New pure functions in `features/metrics/compute.ts` (TDD):
- `bucketDaily(dates: Date[], days: number, now: Date, tz: string): DailyCount[]` — buckets timestamps into
  per-day counts over the trailing `days` window (today inclusive), keyed by the tz-local calendar day
  (`Intl.DateTimeFormat("en-CA", {timeZone: tz})`), zero-filling missing days. `DailyCount = {date: string; count: number}`.
  Known accepted edge: the window iterates in 24 h steps, so a DST shift can duplicate/skip one local-day key —
  cosmetic for an internal dashboard.
- `relativeTimePl(date: Date, now: Date): string` — "teraz" / "N min" / "N godz." / "wczoraj" / "N dni".
- `buildSparklinePath(counts: number[], width: number, height: number, pad?): {line: string; area: string}` —
  SVG `d` attributes for the stroke line and the closed gradient-fill area; max-scaled, `max(1, ...)` guard;
  empty input -> empty strings. Keeps the chart fully server-rendered and unit-testable.

New queries in `features/metrics/queries.ts` (org-scoped; verify exact Message field names against
`prisma/schema.prisma` before coding):
- `getDailySends(orgId, days = 30, now = new Date())` — `Message` where OUTBOUND + SENT + `sentAt >= now-30d`,
  select `sentAt`, bucket via `bucketDaily(..., "Europe/Warsaw")`. Scale is internal (<= a few thousand rows);
  no raw SQL.
- `getRecentReplies(orgId, limit = 6)` — `Message` INBOUND with `inboundKind IN (REPLY, OPT_OUT_SUSPECT)`,
  newest first, joined to the campaign lead -> `{campaignLeadId, campaignId, campaignName, organizationName, at}`.

## 2. UI — `app/(app)/page.tsx` rebuilt to the canvas (variant B)

Page header outside the canvas: "Pulpit" + right-aligned faint "ostatnie 30 dni". Then ONE `Card` whose sections
are divided by hairlines (`divide-y divide-border`):
1. **Hero** — `grid-cols-2 sm:grid-cols-4` with `divide-x divide-border`: Leady / Wysłane (sub "do N leadów") /
   Odpowiedzi (sub: green `formatPct(replyRate)` + "wskaźnik") / Wygrane. 26px semibold `tabular-nums`,
   10-11px uppercase faint labels. The 8-tile grid and the `Kpi` part are REMOVED.
2. **Sparkline** — header row: uppercase label "Wysłane maile · dziennie" left; right a sending-health trio
   (odbicia / rezygnacje / błędy as 5px colored dots + tabular counts + pct, replacing three of the old tiles).
   Below: full-width `<svg viewBox="0 0 600 64" preserveAspectRatio="none">` — gradient area fill
   (accent 22% -> 0), 1.5px accent line, a 2.5px dot on the last point. Paths from `buildSparklinePath`.
3. **Two columns** (`lg:grid-cols-2`) — left "Lejek sprzedaży": rows `[88px label | 3px bar | tabular count]`,
   WON bar `bg-success`, LOST `bg-danger/55`, others `bg-accent`; track `bg-surface-3`-ish (`bg-white/5` token-safe:
   use `bg-surface-3`). Right "Ostatnie odpowiedzi": rows of initials-avatar (22px circle, surface-2 + border) +
   org name (truncate) + faint campaign name + right faint `relativeTimePl`; each row links to `/kampanie/{id}`;
   empty -> faint "Brak odpowiedzi." line.
4. **Kampanie** — flat table (the existing dashboard mini-table style upgraded): hairline header, campaign name
   as `Link`, status as `<Badge variant={CAMPAIGN_STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>`
   (FIXES the raw `· {c.status}` enum leak), Skontaktowani / Odpowiedzi (count + pct + a 52px x 3px inline
   reply-rate mini-bar) / Odbicia / Rezygnacje — numeric columns right-aligned `tabular-nums`.

Below the canvas: the existing no-tracking disclaimer stays (tiny, faint). Empty state (no leads) keeps the
current early return. `app/(app)/dashboard-parts.tsx` is rebuilt: `Kpi` and `FunnelBar` are deleted, replaced by
server-only `HeroStat`, `Sparkline`, `FunnelRow`, `ReplyRow`, `HealthStat`; **`MetricStat` stays unchanged**
(consumed by `/kampanie/[id]`). A single `now = new Date()` is taken in the page and passed down (stable relative
times within one render).

## 3. Scope

**IN:** the two files above + `features/metrics/{compute,queries}.ts` extensions + tests. The enum-leak fix for
the dashboard campaign status. **OUT:** period switcher (fixed 30 d), any client-side interactivity/JS, open/click
tracking, the `/kampanie/[id]` metrics strip restyle, the `/skrzynki` status badge (stays in the spawned chip —
narrow that chip to skrzynki-only once this lands).

## 4. Testing

- TDD pure: `bucketDaily` (zero-fill, window length, tz-day bucketing, empty), `relativeTimePl` (minute/hour/
  yesterday/days + clamp at "teraz"), `buildSparklinePath` (empty -> empty, single point, peak at top pad,
  zeros -> flat bottom line, area closes). Existing metrics tests untouched.
- Gates: `tsc` 0, `vitest` green (249 + ~10), `eslint` clean; `next build` deferred while the dev server runs.
- Live eyeball by the user on :3000 (dark default) — the page is auth-gated.

## Risks / notes

- `Message.sentAt` is nullable until send — the OUTBOUND+SENT+gte filter excludes nulls; keep a TS-level filter.
- Sub-day volumes make the sparkline boxy at low data — `max(1, ...)` guard keeps it stable from day one.
- Feed includes OPT_OUT_SUSPECT (it IS a reply semantically); bounces/OOO excluded by `inboundKind` filter.
- Pure presentation + additive queries: no server action, schema, or behavior change anywhere else.
