# Analytics page — design

Date: 2026-08-20. Status: user-approved (variant A — with the per-campaign table; pulpit keeps ONE 30-day chart, depth lives here).

## Goal

`/analytics`: one large time series with a metric switch and a time-range switch, range stats with a delta vs the previous period, and a per-campaign breakdown. State lives in the URL — server-rendered, shareable, back/forward-friendly.

## Navigation & state

- New nav item **„Analityka"** in the Sprzedaż group (new line-chart icon in `components/ui/icons.tsx`, 1.8px stroke vocabulary).
- URL params: `m` (metric) ∈ `wyslane | odpowiedzi | odbicia | rezygnacje | leady`, `r` (range) ∈ `7d | 30d | 90d | 12m`. Defaults `m=wyslane&r=30d`; unknown values fall back to defaults. Switchers are segmented LINK groups (the /leady filter idiom — zero client state).

## Granularity (automatic)

- `7d`/`30d` → daily buckets (`bucketDaily`).
- `90d` → Monday weeks (`groupWeekly`, already shipped with tests).
- `12m` → calendar months: new pure **`groupMonthly(daily)`** keyed by the ISO month prefix; the leading partial month is dropped, the trailing (current) partial month stays — same convention as `groupWeekly` (TDD).

## View

1. **Chart** — the existing `Sparkline` component at `h-40`, `mode` extended with `"month"` (tooltip label „sie 2026"); hover/wipe/morph come for free. Tooltip series label = the selected metric's Polish name.
2. **Stats strip** — pure **`computeRangeStats(series, previous)`** (TDD): suma, średnia per bucket, szczyt (with its date), and **delta vs the previous equal-length period** rendered green/red — the one legitimate home for trend colors (real period-over-period comparison). Data comes from ONE fetch of a 2× window split in half.
3. **Campaign table** — per campaign within the range: Wysłane (outbound SENT in range), Odpowiedzi (inbound REPLY in range), and **„odp./mail"** = odpowiedzi ÷ wysłane in range. Explicitly labeled `odp./mail` because it is a per-message rate — DIFFERENT from the pulpit's per-contacted-lead „wskaźnik"; the label prevents the two being read as the same number. Sorted by Wysłane desc; campaigns with zero activity in range are omitted.

## Data

`features/metrics/analytics.ts` (thin org-scoped queries) + pure helpers in `compute.ts`:

| metric | source | timestamp |
|---|---|---|
| wyslane | Message OUTBOUND status SENT | sentAt |
| odpowiedzi | Message INBOUND kind REPLY | createdAt |
| odbicia | Message INBOUND kind BOUNCE | createdAt |
| rezygnacje | Suppression reason UNSUBSCRIBED | createdAt |
| leady | Lead | createdAt |

Known demo caveat: the simulator generates sends/replies/leads but few bounces and no unsubscribe suppressions — odbicia/rezygnacje charts may be near-flat on demo data; that is data, not a bug.

## Loading & dev tooling

- `app/(app)/analytics/loading.tsx` skeleton (switchers + chart + table geometry) and a mapping entry in the dev skeleton-preview gate.

## Testing & gates

- Vitest: `groupMonthly`, `computeRangeStats` (sums, averages, peak, delta incl. null/zero previous), metric param fallback.
- `tsc`, `eslint`, `next build` (dev OFF).

## Out of scope

CSV export, multi-series comparison on one chart, custom date-range picker, per-campaign filtering of the chart itself.
