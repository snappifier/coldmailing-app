# Phase 6 - Sales pipeline (design)

Date: 2026-06-08. Status: approved in brainstorm, ready for the implementation plan.

## Context

ROADMAP Phase 6: Kanban board by `Lead.dealStage`, per-lead activity timeline, notes. Groundwork already exists in the schema:

- `enum DealStage { NEW AUDIT PROPOSAL MEETING OFFER WON LOST }`
- `Lead.dealStage DealStage @default(NEW)`, `Lead.ownerUserId String?`, `@@index([organizationId, dealStage])`.
- No Note/Activity models yet. Leads UI lives at `app/(app)/leady/` (list `page.tsx`, detail/edit `[id]/page.tsx` + `lead-edit-form.tsx`).

Conventions to follow: org-scoped via `requireOrg()` (`lib/org.ts` returns `{userId, orgId, role}`); pure logic in `features/*` with unit tests; server actions in `features/*/actions.ts` (`"use server"`, Zod, `revalidatePath`, discriminated `{ok}` results, org-scoped `where {id, organizationId}`); minimal raw-Tailwind UI (full visual polish is Phase 7).

## Goal

A sales pipeline the user can work daily:
1. A Kanban board to move leads between deal stages.
2. A per-lead activity timeline mixing automatic events (stage changes + email events) and manual entries (notes + typed logs).
3. Manual notes and logs (call / meeting / offer-sent).

## Decisions (locked in brainstorm)

- Timeline aggregates 4 sources: stage changes (auto), email events (auto, derived from `Message`), manual notes, manual typed logs (call / meeting / offer-sent).
- Data-model approach **A**: one `LeadActivity` table for events we author; email events are derived from the existing `Message` table at read time (not duplicated). This keeps the Phase 4/5 sending/reply pipeline untouched.
- Board interaction: native HTML5 drag-and-drop (no dnd library). Clicking a card opens the lead detail. A lightweight "move to" control is an acceptable fallback if native DnD proves fiddly.
- Board scope: all leads + offering-line filter + collapsible WON/LOST columns + a soft per-column render cap with "pokaz wiecej".
- WON/LOST are ordinary stages; no required "lost reason" field (the user adds a note if they want a reason).
- Owner-assignment UI is deferred to Phase 7 (team-role UI). `authorUserId` is stamped from the session now.

## Data model (migration `phase6_pipeline`)

```prisma
enum LeadActivityKind {
  NOTE
  CALL
  MEETING
  OFFER_SENT
  STAGE_CHANGE
}

model LeadActivity {
  id             String           @id @default(cuid())
  organizationId String
  leadId         String
  kind           LeadActivityKind
  body           String?          // text for NOTE/CALL/MEETING/OFFER_SENT; null for STAGE_CHANGE
  fromStage      DealStage?       // STAGE_CHANGE only
  toStage        DealStage?       // STAGE_CHANGE only
  authorUserId   String?          // from requireOrg().userId
  createdAt      DateTime         @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  lead         Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([leadId, createdAt])
  @@index([organizationId])
}
```

- `Lead` gains `activities LeadActivity[]`; `Organization` gains the back-relation.
- No change to `Message` or `CampaignLead`. Email events stay in `Message`.

## Pure logic (`features/pipeline/*`, unit-tested, no Prisma imports)

- `types.ts` - `TimelineItem = { id, at: Date, source: "activity" | "message", kind: string, title: string, detail?: string }`. `STAGE_ORDER: DealStage[]` (canonical NEW -> LOST).
- `group.ts` - `groupLeadsByStage(leads)` returns `{stage, leads}[]` for all 7 stages in `STAGE_ORDER`, including empty columns.
- `timeline.ts`:
  - `messageToTimelineItem(msg)` - OUTBOUND -> "Wyslano: <subject>"; INBOUND by `inboundKind`: REPLY -> "Odpowiedz", BOUNCE -> "Odbicie", OPT_OUT_SUSPECT -> "Mozliwa rezygnacja", AUTO_REPLY -> "Autoresponder". `at` = `sentAt ?? createdAt`.
  - `activityToTimelineItem(activity)` - STAGE_CHANGE -> title "Etap: <from> -> <to>"; NOTE/CALL/MEETING/OFFER_SENT -> human label + `body` as detail. `at` = `createdAt`.
  - `buildTimeline(activities, messages)` - map both, concat, sort by `at` descending.

## Data access (`features/pipeline/queries.ts`)

- `getPipelineLeads(orgId, {offeringLineId?})` - leads with the fields a card needs: `organizationName`, `city`, `dealStage`, `offeringLine.name`, the latest `CampaignLead` status (pick latest by `updatedAt`, or null if not in any campaign), and `lastActivityAt` = latest `LeadActivity.createdAt` (email events are not joined into the card to keep the list query light; the full timeline on the detail page includes them). Stable ordering within a stage (e.g. `priority desc, createdAt desc`).
- `getLeadTimeline(orgId, leadId)` - load `LeadActivity` (where `leadId`, org) + `Message` (where `campaignLead.lead.id == leadId`, org) and return `buildTimeline(...)`.

## Server actions (`features/pipeline/actions.ts`, `"use server"`, `requireOrg`)

- `moveLeadStage(leadId, toStage)` - validate `toStage` is a `DealStage`; read current `dealStage` (org-scoped); if unchanged, no-op `{ok:true}`; else `lead.updateMany({where:{id, organizationId}, data:{dealStage:toStage}})` + create `LeadActivity` STAGE_CHANGE `{fromStage, toStage, authorUserId:userId}`; `revalidatePath("/pipeline")` + `revalidatePath('/leady/'+leadId)`. Returns `{ok}|{ok:false,error}`.
- `addLeadActivity(leadId, kind, body)` - Zod: `kind in {NOTE,CALL,MEETING,OFFER_SENT}` (STAGE_CHANGE is not user-creatable), `body` non-empty trimmed; verify the lead is in the org; create the activity (`authorUserId:userId`); `revalidatePath('/leady/'+leadId)`.
- `deleteLeadActivity(id)` - org-scoped delete `where {id, organizationId}`; `revalidatePath` the lead. (Only manual entries get a delete button; STAGE_CHANGE entries are immutable history.)

## UI

**Route `/pipeline`** (`app/(app)/pipeline/page.tsx`, server component):
- `requireOrg`; read `searchParams.line`; `getPipelineLeads`; `groupLeadsByStage`; render `<PipelineBoard>`.
- Offering-line filter: GET `<form>` with a select (same pattern as `/leady`).
- WON/LOST columns collapsible (client toggle); default collapsed when empty.
- Soft cap: render the first N cards per column (e.g. 60) plus a "+X wiecej" control that expands the column from already-fetched data. (No need to paginate the DB for the expected volume; revisit if a column regularly exceeds a few hundred.)
- Add a "Pipeline" link to the app nav (alongside `/leady`, `/kampanie`, `/skrzynki`).

**`PipelineBoard`** (client component, `board.tsx`):
- 7 columns from `STAGE_ORDER`; each column is a drop target (`onDragOver` preventDefault, `onDrop`).
- `LeadCard` (`card.tsx`) is `draggable`; `onDragStart` carries `leadId`; on drop, call `moveLeadStage(leadId, stage)` then `router.refresh()`.
- Card content: `organizationName` (bold) - city - offering line - sequence-status badge - last-activity date. Click navigates to `/leady/[id]`.
- Keep it simple: `router.refresh()` after the action (optimistic update optional, deferred).

**Lead detail `/leady/[id]`** (extend the existing page):
- Keep `LeadEditForm` as a "Dane" section.
- Show current `dealStage`.
- Add a **Timeline** section: `getLeadTimeline` -> list (date - title - detail), newest first.
- Add a **"Dodaj wpis"** form: `kind` select (Notatka / Telefon / Spotkanie / Oferta wyslana) + `body` textarea -> `addLeadActivity`. Manual entries get a delete button.

## Error handling / security

- Every read and write is org-scoped via `requireOrg()` and `where {organizationId}`.
- Server actions return discriminated `{ok:true}|{ok:false,error}` (existing pattern).
- Foreign/missing lead -> `{ok:false}` or `notFound()`.
- Zod validation on activity input; `kind` whitelist excludes STAGE_CHANGE so users cannot forge stage history.

## Testing / gates

- Unit: `group.test.ts` (all 7 stages present, correct bucketing, empty columns), `timeline.test.ts` (`messageToTimelineItem` per direction + each `inboundKind`; `activityToTimelineItem` incl. STAGE_CHANGE; `buildTimeline` merge + descending sort), activity Zod schema (rejects STAGE_CHANGE and empty body).
- Gates: `tsc` 0, `vitest` green, `next build` green.
- No live e2e required (CRUD + UI). Optional manual smoke: move a card between columns, add a note, confirm the timeline shows the stage change + the note + existing email events.

## Out of scope (Phase 7+)

Drag-drop polish (touch, animation, optimistic reordering), owner-assignment UI, dashboards/metrics (sent/reply/won rates), structured lost-reason field, per-stage automations.

## Files touched

- `prisma/schema.prisma` (enum + `LeadActivity` + `Lead.activities` + `Organization` back-relation), migration `phase6_pipeline`.
- `features/pipeline/{types.ts, group.ts, group.test.ts, timeline.ts, timeline.test.ts, queries.ts, actions.ts}`.
- `app/(app)/pipeline/{page.tsx, board.tsx, card.tsx}`.
- `app/(app)/leady/[id]/{page.tsx (extend), timeline.tsx, activity-form.tsx}`.
- App nav component (add the "Pipeline" link).
