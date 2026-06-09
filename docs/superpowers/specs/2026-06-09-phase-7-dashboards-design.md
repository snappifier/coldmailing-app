# Phase 7 — dashboards — Design

Date: 2026-06-09. Status: spec ready (design approved — full scope: pulpit `/` + per-campaign; rate denominator =
**contacted leads**). Sub-project #7 (build order) of Phase 7. L-sized, objective. Depends on `design-foundation`
(tokens/primitives). No DB migration — every metric derives from existing rows. Visual references:
`docs/superpowers/design/dashboards-mock/index.html` (the pulpit) and `docs/superpowers/design/dashboards-rate-mock/index.html`
(why the denominator is "contacted").

## Goal

Give the operator an at-a-glance view of campaign performance: an org-wide pulpit at `/` and a per-campaign
metrics block on `/kampanie/[id]`. Metrics are derived from existing data only — **no open/click tracking** (the
product ships with the open-pixel off and has no tracking model), so those are deliberately omitted.

## Scope

**IN:** new pure metrics logic (`features/metrics/compute.ts`) + thin queries (`features/metrics/queries.ts`);
the pulpit page at `/` (moved into the `(app)` shell so it gets nav + auth) + a "Pulpit" nav link; a per-campaign
metrics block on the campaign detail page.

**OUT:** open-rate, click-rate, any tracking model or pixel; time-series/charts over time (counts + a static deal
funnel only); per-mailbox stats; any migration; editing from the dashboard (read-only).

## Data sources (existing, no migration)

- `Message` (`direction=OUTBOUND`, `status=SENT`) -> **emails sent**. `Message.organizationId` scopes it.
- `CampaignLead.status` (enum `PENDING|ACTIVE|REPLIED|BOUNCED|UNSUBSCRIBED|SKIPPED|FAILED|DONE`) -> the per-lead
  outcome. Org-scoped via the `campaign.organizationId` relation.
- `Lead.dealStage` (enum `NEW|AUDIT|PROPOSAL|MEETING|OFFER|WON|LOST`) -> the sales funnel. Reuse `STAGE_ORDER`
  from `features/pipeline/types`.
- `Campaign.status` + `Lead`/`Campaign` counts.

## Metric definitions

- **Contacted (denominator, approved variant A):** `total − PENDING − SKIPPED − FAILED` (leads that received at
  least one email: ACTIVE, DONE, REPLIED, BOUNCED, UNSUBSCRIBED). Stable from the start of a campaign; not diluted
  by not-yet-sent leads. (The rejected variant B = ÷ all assigned; see the rate mock for why A was chosen.)
- **Reply rate** = `REPLIED / contacted` (null when contacted = 0 -> UI shows "—"). Same shape for **bounce rate**
  (`BOUNCED / contacted`) and **unsubscribe rate** (`UNSUBSCRIBED / contacted`).
- **Emails sent** (org KPI) = count of OUTBOUND SENT `Message` (an email count; a lead can get several across
  steps). **Send failures** = `CampaignLead.status = FAILED` count.
- **Funnel** = count of `Lead` per `dealStage`, in `STAGE_ORDER`.
- Per-campaign table rows show **contacted** (leads, not emails — keeps the row self-consistent with its rate, and
  avoids an awkward Message->campaign join), plus replied (+ rate), bounced, unsubscribed.

## Pure logic — `features/metrics/compute.ts` (unit-tested)

```ts
import type {CampaignLeadStatus, DealStage} from "@/generated/prisma/client"

export interface StatusBreakdown {
	pending: number; active: number; replied: number; bounced: number
	unsubscribed: number; skipped: number; failed: number; done: number; total: number
}
export interface Rates {
	contacted: number
	replyRate: number | null
	bounceRate: number | null
	unsubRate: number | null
}
export interface CampaignRow {
	id: string; name: string; status: string
	contacted: number; replied: number; bounced: number; unsubscribed: number; replyRate: number | null
}

// groupBy rows -> a fully-populated breakdown (every status defaulted to 0)
export function summarizeStatuses(rows: {status: CampaignLeadStatus; count: number}[]): StatusBreakdown

export function contacted(b: StatusBreakdown): number          // total - pending - skipped - failed
export function rate(numerator: number, denominator: number): number | null  // null when denominator <= 0
export function computeRates(b: StatusBreakdown): Rates

export function formatPct(r: number | null): string            // 0.0703 -> "7,0%" (Polish comma); null -> "—"
export function formatInt(n: number): string                   // 1312 -> "1 312" (NBSP thousands)

// merge campaigns with their per-campaign [campaignId,status] groupBy rows, preserving the campaigns' order
export function buildCampaignRows(
	campaigns: {id: string; name: string; status: string}[],
	statusRows: {campaignId: string; status: CampaignLeadStatus; count: number}[],
): CampaignRow[]

export function orderFunnel(counts: Partial<Record<DealStage, number>>): {stage: DealStage; count: number}[]  // STAGE_ORDER, missing -> 0
```

All deterministic and pure -> unit-tested in `compute.test.ts`.

## Queries — `features/metrics/queries.ts` (thin Prisma wrappers, org-scoped)

```ts
export async function getOrgMetrics(orgId: string): Promise<{
	leadsTotal: number
	campaignsTotal: number
	campaignsActive: number
	mailsSent: number
	breakdown: StatusBreakdown          // org-wide CampaignLead status groupBy -> summarizeStatuses
	rates: Rates
	funnel: {stage: DealStage; count: number}[]
	campaigns: CampaignRow[]
}>
export async function getCampaignMetrics(campaignId: string, orgId: string): Promise<{
	breakdown: StatusBreakdown
	rates: Rates
	mailsSent: number
} | null>                                // null if the campaign is not in the org
```

`getOrgMetrics` runs (org-scoped, in parallel): `lead.count`; `campaign.groupBy(status)` (or count + active
count); `message.count({direction:OUTBOUND, status:SENT})`; `campaignLead.groupBy(['status'], where:{campaign:
{organizationId}})`; `lead.groupBy(['dealStage'])`; `campaign.findMany({select:{id,name,status}})` +
`campaignLead.groupBy(['campaignId','status'])` -> `buildCampaignRows`. Note Prisma `groupBy` returns
`_count`; map to `{status, count: r._count._all}` (or `_count.status`) before passing to the pure helpers.
`getCampaignMetrics` first verifies `campaign.findFirst({where:{id, organizationId}})`; then its status groupBy +
its OUTBOUND SENT message count (`message.count({where:{campaignLead:{campaignId}, direction, status:SENT}})`).

## UI

**Pulpit at `/`** — move it into the authenticated shell:
- Delete `app/page.tsx` (the `redirect("/leady")`). Create `app/(app)/page.tsx` (server component) -> maps to `/`
  and inherits `app/(app)/layout.tsx` (auth + nav). Calls `getOrgMetrics(orgId)` via `requireOrg()`.
- Add `["/", "Pulpit"]` as the FIRST entry in the `LINKS` array in `app/(app)/layout.tsx` (so the nav has it; the
  existing `NavLink` active-state handles `/`).
- Layout (per the mock, built with tokens): a KPI grid (Leady, Wysłane maile, Odpowiedzi + reply-rate, Wygrane
  [funnel WON], Odbicia + rate, Rezygnacje + rate, Błędy wysyłki, Aktywne kampanie); the **Lejek sprzedaży**
  (horizontal bars per `STAGE_ORDER`, max-count = 100% width, WON green / LOST danger); the **Kampanie** table
  (name + status badge, Skontaktowani, Odpowiedzi + rate, Odbicia, Rezygnacje), each name linking to
  `/kampanie/[id]`. Empty state when `leadsTotal === 0`.
- Small presentational pieces may live in `app/(app)/dashboard-parts.tsx` (e.g. `Kpi`, `Funnel`) to keep the page
  focused; all server-rendered (no client JS).

**Per-campaign block** on `app/(app)/kampanie/[id]/page.tsx`:
- Call `getCampaignMetrics(campaignId, orgId)`; render a compact strip near the top: Wysłane maile, Skontaktowani,
  Odpowiedzi (+ rate), Odbicia (+ rate), Rezygnacje (+ rate), Błędy. Reuse `formatPct`/`formatInt`. A shared
  presentational `MetricStat` may be used by both surfaces.

Copy is Polish; the "bez śledzenia otwarć/kliknięć" footnote from the mock is included on the pulpit.

## Testing

- TDD `features/metrics/compute.test.ts`: `summarizeStatuses` (defaults missing statuses to 0; sums total),
  `contacted` (excludes pending/skipped/failed), `rate` (null on 0 denominator), `computeRates`, `formatPct`
  ("7,0%", "—" on null, Polish comma), `formatInt` ("1 312" with NBSP), `buildCampaignRows` (merge + order
  preserved + missing-status defaults), `orderFunnel` (STAGE_ORDER, missing -> 0).
- `tsc` 0, `eslint "app/(app)" features components` clean, `next build` green (note: `/` moves from a redirect to
  a dynamic page in the route list), `vitest` green (+ the new compute cases).
- Manual (optional, dev server): visit `/` and a campaign page; sanity-check counts against `/leady` and the
  campaign's lead list.

## Risks / notes

- "Contacted" treats `ACTIVE` as contacted; a lead can be briefly `ACTIVE` before its first physical send, so
  contacted can momentarily lead emails-sent by a hair. Acceptable for a dashboard; documented.
- Moving `/` into `(app)` changes it from a static redirect to a server-rendered, auth-gated dynamic page — the
  build route list will show `/` as dynamic. The (app) layout's existing `redirect("/logowanie")` covers auth.
- All queries org-scoped (`organizationId` / `campaign.organizationId` in every `where`); `getCampaignMetrics`
  returns `null` for a foreign campaign id (page shows nothing / not-found rather than cross-org data).
- Prisma `groupBy` `_count` shape: confirm whether to read `_count._all` or `_count.status` when mapping (verify
  against the installed Prisma 7 client during Task 1/2; the pure helpers take a normalized `{status, count}`).
