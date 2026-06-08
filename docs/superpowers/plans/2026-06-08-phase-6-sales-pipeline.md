# Phase 6 - Sales Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Kanban sales-pipeline board (`/pipeline`) to move leads between deal stages, plus a per-lead activity timeline and manual notes/logs on the lead detail page.

**Architecture:** New `LeadActivity` table stores events we author (notes, calls, meetings, offer-sent, stage-changes). Email events are NOT duplicated - they are read live from the existing `Message` table and merged with activities at read time. Pure logic (`groupLeadsByStage`, timeline mappers, validation) lives in `features/pipeline/*` and is unit-tested; queries/actions/UI are verified by `tsc` + `next build`. The board uses native HTML5 drag-and-drop (no library). Phase 4/5 sending/reply code is untouched.

**Tech Stack:** Next 16 (App Router, server components + server actions), React 19 (`useActionState`), Prisma 7 (`@/generated/prisma/client`), Zod 4, Vitest 4, Tailwind v4 (minimal raw utility classes - visual polish is Phase 7).

**Spec:** `docs/superpowers/specs/2026-06-08-phase-6-sales-pipeline-design.md`

**Conventions (match existing code):** tabs, no semicolons, path comment on line 1 (or line 2 after a `"use client"`/`"use server"` directive), `className` first, `import {x}` (no inner spaces), NO emoji in code. Org-scope every read/write via `requireOrg()` and `where {organizationId}`. Work on `master`/`main`; commit per task; the USER pushes (never `git push`).

**Note vs spec:** `CampaignLead` has no `updatedAt` column, so "latest campaign status" orders by `createdAt desc` (spec said `updatedAt`).

---

## File Structure

- `prisma/schema.prisma` - add `LeadActivityKind` enum + `LeadActivity` model + `Lead.activities` + `Organization.leadActivities` back-relation. Migration `phase6_pipeline`.
- `features/pipeline/types.ts` - `STAGE_ORDER`, `STAGE_LABEL`, `TimelineItem`, `PipelineLead` (client-safe: type-only imports from the generated client).
- `features/pipeline/group.ts` (+ `group.test.ts`) - `groupLeadsByStage`.
- `features/pipeline/timeline.ts` (+ `timeline.test.ts`) - `messageToTimelineItem`, `activityToTimelineItem`, `buildTimeline`.
- `features/pipeline/validation.ts` (+ `validation.test.ts`) - `addActivitySchema` (pure Zod; kept out of the `"use server"` module so it is unit-testable).
- `features/pipeline/queries.ts` - `getPipelineLeads`, `getLeadTimeline`.
- `features/pipeline/actions.ts` - `moveLeadStage`, `addLeadActivity`, `deleteLeadActivity` (`"use server"`).
- `app/(app)/pipeline/page.tsx`, `board.tsx`, `card.tsx` - board UI.
- `app/(app)/leady/[id]/page.tsx` (modify), `timeline.tsx`, `activity-form.tsx` - lead detail timeline + add-entry.
- `app/(app)/layout.tsx` (modify) - add the "Pipeline" nav link.

---

## Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the enum and model.** Append after the `Lead` model (or anywhere among the models) in `prisma/schema.prisma`:

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
	body           String?
	fromStage      DealStage?
	toStage        DealStage?
	authorUserId   String?
	createdAt      DateTime         @default(now())

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	lead         Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)

	@@index([leadId, createdAt])
	@@index([organizationId])
}
```

- [ ] **Step 2: Add the back-relations.** In `model Lead`, add to its relation list: `activities LeadActivity[]`. In `model Organization`, add: `leadActivities LeadActivity[]`. (Prisma requires both sides; `migrate` errors otherwise.)

- [ ] **Step 3: Create and apply the migration.**

Run: `npx prisma migrate dev --name phase6_pipeline`
Expected: migration `phase6_pipeline` created and applied; Prisma client regenerated; no errors.

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit`
Expected: exit 0 (the new model is available on `prisma.leadActivity`).

- [ ] **Step 5: Commit.**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(pipeline): add LeadActivity model + migration phase6_pipeline"
```

---

## Task 2: Pure types

**Files:**
- Create: `features/pipeline/types.ts`

- [ ] **Step 1: Write the file.**

```ts
// features/pipeline/types.ts
import type {CampaignLeadStatus, DealStage} from "@/generated/prisma/client"

export const STAGE_ORDER: DealStage[] = ["NEW", "AUDIT", "PROPOSAL", "MEETING", "OFFER", "WON", "LOST"]

export const STAGE_LABEL: Record<DealStage, string> = {
	NEW: "Nowy",
	AUDIT: "Audyt",
	PROPOSAL: "Propozycja",
	MEETING: "Spotkanie",
	OFFER: "Oferta",
	WON: "Wygrany",
	LOST: "Przegrany",
}

export interface TimelineItem {
	id: string
	at: Date
	source: "activity" | "message"
	kind: string
	title: string
	detail?: string
}

export interface PipelineLead {
	id: string
	organizationName: string
	city: string | null
	dealStage: DealStage
	lineName: string | null
	sequenceStatus: CampaignLeadStatus | null
	lastActivityAt: Date | null
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` -> exit 0.

- [ ] **Step 3: Commit.**

```bash
git add features/pipeline/types.ts
git commit -m "feat(pipeline): stage order/labels and shared types"
```

---

## Task 3: groupLeadsByStage (TDD)

**Files:**
- Create: `features/pipeline/group.ts`
- Test: `features/pipeline/group.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// features/pipeline/group.test.ts
import {describe, it, expect} from "vitest"
import type {DealStage} from "@/generated/prisma/client"
import {groupLeadsByStage} from "./group"

const lead = (id: string, dealStage: DealStage) => ({id, dealStage})

describe("groupLeadsByStage", () => {
	it("returns all 7 stages in canonical order, even when empty", () => {
		const cols = groupLeadsByStage([])
		expect(cols.map((c) => c.stage)).toEqual(["NEW", "AUDIT", "PROPOSAL", "MEETING", "OFFER", "WON", "LOST"])
		expect(cols.every((c) => c.leads.length === 0)).toBe(true)
	})
	it("buckets leads into their stage, preserving order", () => {
		const cols = groupLeadsByStage([lead("a", "NEW"), lead("b", "WON"), lead("c", "NEW")])
		const byStage = Object.fromEntries(cols.map((c) => [c.stage, c.leads.map((l) => l.id)]))
		expect(byStage.NEW).toEqual(["a", "c"])
		expect(byStage.WON).toEqual(["b"])
		expect(byStage.AUDIT).toEqual([])
	})
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run features/pipeline/group.test.ts`
Expected: FAIL ("Cannot find module './group'" or "groupLeadsByStage is not a function").

- [ ] **Step 3: Write the implementation.**

```ts
// features/pipeline/group.ts
import type {DealStage} from "@/generated/prisma/client"
import {STAGE_ORDER} from "./types"

export interface StageColumn<T> {
	stage: DealStage
	leads: T[]
}

export function groupLeadsByStage<T extends {dealStage: DealStage}>(leads: T[]): StageColumn<T>[] {
	const buckets: Record<DealStage, T[]> = {NEW: [], AUDIT: [], PROPOSAL: [], MEETING: [], OFFER: [], WON: [], LOST: []}
	for (const lead of leads) buckets[lead.dealStage].push(lead)
	return STAGE_ORDER.map((stage) => ({stage, leads: buckets[stage]}))
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run features/pipeline/group.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit.**

```bash
git add features/pipeline/group.ts features/pipeline/group.test.ts
git commit -m "feat(pipeline): groupLeadsByStage with unit tests"
```

---

## Task 4: Timeline mappers (TDD)

**Files:**
- Create: `features/pipeline/timeline.ts`
- Test: `features/pipeline/timeline.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// features/pipeline/timeline.test.ts
import {describe, it, expect} from "vitest"
import {activityToTimelineItem, buildTimeline, messageToTimelineItem} from "./timeline"

const d = (s: string) => new Date(s)

describe("messageToTimelineItem", () => {
	it("maps OUTBOUND to 'Wyslano: <subject>'", () => {
		const item = messageToTimelineItem({id: "m1", direction: "OUTBOUND", inboundKind: null, subject: "Krok 0", sentAt: d("2026-06-01"), createdAt: d("2026-06-01")})
		expect(item.title).toBe("Wysłano: Krok 0")
		expect(item.source).toBe("message")
	})
	it("maps each inbound kind to a title", () => {
		const mk = (k: "REPLY" | "BOUNCE" | "AUTO_REPLY" | "OPT_OUT_SUSPECT") =>
			messageToTimelineItem({id: "x", direction: "INBOUND", inboundKind: k, subject: "Re", sentAt: null, createdAt: d("2026-06-02")}).title
		expect(mk("REPLY")).toBe("Odpowiedź")
		expect(mk("BOUNCE")).toBe("Odbicie")
		expect(mk("AUTO_REPLY")).toBe("Autoresponder")
		expect(mk("OPT_OUT_SUSPECT")).toBe("Możliwa rezygnacja")
	})
})

describe("activityToTimelineItem", () => {
	it("maps STAGE_CHANGE with Polish stage labels", () => {
		const item = activityToTimelineItem({id: "a1", kind: "STAGE_CHANGE", body: null, fromStage: "NEW", toStage: "AUDIT", createdAt: d("2026-06-03")})
		expect(item.title).toBe("Etap: Nowy -> Audyt")
	})
	it("maps NOTE with body as detail", () => {
		const item = activityToTimelineItem({id: "a2", kind: "NOTE", body: "rozmowa ok", fromStage: null, toStage: null, createdAt: d("2026-06-03")})
		expect(item.title).toBe("Notatka")
		expect(item.detail).toBe("rozmowa ok")
	})
})

describe("buildTimeline", () => {
	it("merges activities + messages and sorts by time descending", () => {
		const acts = [{id: "a", kind: "NOTE" as const, body: "x", fromStage: null, toStage: null, createdAt: d("2026-06-01")}]
		const msgs = [{id: "m", direction: "OUTBOUND" as const, inboundKind: null, subject: "s", sentAt: d("2026-06-05"), createdAt: d("2026-06-05")}]
		expect(buildTimeline(acts, msgs).map((i) => i.id)).toEqual(["m", "a"])
	})
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run features/pipeline/timeline.test.ts`
Expected: FAIL ("Cannot find module './timeline'").

- [ ] **Step 3: Write the implementation.** (Use proper Polish diacritics; ensure the test strings match exactly.)

```ts
// features/pipeline/timeline.ts
import type {DealStage, InboundKind, LeadActivityKind, MessageDirection} from "@/generated/prisma/client"
import type {TimelineItem} from "./types"
import {STAGE_LABEL} from "./types"

export interface MessageLike {
	id: string
	direction: MessageDirection
	inboundKind: InboundKind | null
	subject: string
	sentAt: Date | null
	createdAt: Date
}

export interface ActivityLike {
	id: string
	kind: LeadActivityKind
	body: string | null
	fromStage: DealStage | null
	toStage: DealStage | null
	createdAt: Date
}

const INBOUND_TITLE: Record<InboundKind, string> = {
	REPLY: "Odpowiedź",
	BOUNCE: "Odbicie",
	AUTO_REPLY: "Autoresponder",
	OPT_OUT_SUSPECT: "Możliwa rezygnacja",
}

const MANUAL_LABEL: Record<Exclude<LeadActivityKind, "STAGE_CHANGE">, string> = {
	NOTE: "Notatka",
	CALL: "Telefon",
	MEETING: "Spotkanie",
	OFFER_SENT: "Oferta wysłana",
}

export function messageToTimelineItem(m: MessageLike): TimelineItem {
	if (m.direction === "OUTBOUND") {
		return {id: m.id, at: m.sentAt ?? m.createdAt, source: "message", kind: "EMAIL_OUT", title: `Wysłano: ${m.subject}`}
	}
	const title = m.inboundKind ? INBOUND_TITLE[m.inboundKind] : "Wiadomość przychodząca"
	return {id: m.id, at: m.sentAt ?? m.createdAt, source: "message", kind: "EMAIL_IN", title, detail: m.subject}
}

export function activityToTimelineItem(a: ActivityLike): TimelineItem {
	if (a.kind === "STAGE_CHANGE") {
		const from = a.fromStage ? STAGE_LABEL[a.fromStage] : "—"
		const to = a.toStage ? STAGE_LABEL[a.toStage] : "—"
		return {id: a.id, at: a.createdAt, source: "activity", kind: "STAGE_CHANGE", title: `Etap: ${from} -> ${to}`}
	}
	return {id: a.id, at: a.createdAt, source: "activity", kind: a.kind, title: MANUAL_LABEL[a.kind], detail: a.body ?? undefined}
}

export function buildTimeline(activities: ActivityLike[], messages: MessageLike[]): TimelineItem[] {
	return [...activities.map(activityToTimelineItem), ...messages.map(messageToTimelineItem)].sort((a, b) => b.at.getTime() - a.at.getTime())
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run features/pipeline/timeline.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Commit.**

```bash
git add features/pipeline/timeline.ts features/pipeline/timeline.test.ts
git commit -m "feat(pipeline): timeline mappers (message/activity merge) with tests"
```

---

## Task 5: Activity validation (TDD)

**Files:**
- Create: `features/pipeline/validation.ts`
- Test: `features/pipeline/validation.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// features/pipeline/validation.test.ts
import {describe, it, expect} from "vitest"
import {addActivitySchema} from "./validation"

describe("addActivitySchema", () => {
	it("accepts a NOTE with a body", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "NOTE", body: "hej"}).success).toBe(true)
	})
	it("rejects STAGE_CHANGE (not user-creatable)", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "STAGE_CHANGE", body: "x"}).success).toBe(false)
	})
	it("rejects an empty/whitespace body", () => {
		expect(addActivitySchema.safeParse({leadId: "l1", kind: "NOTE", body: "   "}).success).toBe(false)
	})
})
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `npx vitest run features/pipeline/validation.test.ts`
Expected: FAIL ("Cannot find module './validation'").

- [ ] **Step 3: Write the implementation.**

```ts
// features/pipeline/validation.ts
import {z} from "zod"

export const MANUAL_ACTIVITY_KINDS = ["NOTE", "CALL", "MEETING", "OFFER_SENT"] as const

export const addActivitySchema = z.object({
	leadId: z.string().min(1),
	kind: z.enum(MANUAL_ACTIVITY_KINDS),
	body: z.string().trim().min(1, "Wpisz treść wpisu"),
})

export type AddActivityInput = z.infer<typeof addActivitySchema>
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `npx vitest run features/pipeline/validation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit.**

```bash
git add features/pipeline/validation.ts features/pipeline/validation.test.ts
git commit -m "feat(pipeline): activity input schema with tests"
```

---

## Task 6: Queries

**Files:**
- Create: `features/pipeline/queries.ts`

- [ ] **Step 1: Write the file.**

```ts
// features/pipeline/queries.ts
import {prisma} from "@/lib/prisma"
import type {PipelineLead, TimelineItem} from "./types"
import {buildTimeline} from "./timeline"

export async function getPipelineLeads(organizationId: string, opts: {offeringLineId?: string | null} = {}): Promise<PipelineLead[]> {
	const leads = await prisma.lead.findMany({
		where: {organizationId, ...(opts.offeringLineId ? {offeringLineId: opts.offeringLineId} : {})},
		orderBy: [{priority: "desc"}, {createdAt: "desc"}],
		select: {
			id: true,
			organizationName: true,
			city: true,
			dealStage: true,
			offeringLine: {select: {name: true}},
			campaignLeads: {orderBy: {createdAt: "desc"}, take: 1, select: {status: true}},
			activities: {orderBy: {createdAt: "desc"}, take: 1, select: {createdAt: true}},
		},
	})
	return leads.map((l) => ({
		id: l.id,
		organizationName: l.organizationName,
		city: l.city,
		dealStage: l.dealStage,
		lineName: l.offeringLine?.name ?? null,
		sequenceStatus: l.campaignLeads[0]?.status ?? null,
		lastActivityAt: l.activities[0]?.createdAt ?? null,
	}))
}

export async function getLeadTimeline(organizationId: string, leadId: string): Promise<TimelineItem[]> {
	const [activities, messages] = await Promise.all([
		prisma.leadActivity.findMany({
			where: {organizationId, leadId},
			orderBy: {createdAt: "desc"},
			select: {id: true, kind: true, body: true, fromStage: true, toStage: true, createdAt: true},
		}),
		prisma.message.findMany({
			where: {organizationId, campaignLead: {leadId}},
			orderBy: {createdAt: "desc"},
			select: {id: true, direction: true, inboundKind: true, subject: true, sentAt: true, createdAt: true},
		}),
	])
	return buildTimeline(activities, messages)
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` -> exit 0. (Confirms `prisma.lead` has the `activities` relation and the select shape matches `PipelineLead`.)

- [ ] **Step 3: Commit.**

```bash
git add features/pipeline/queries.ts
git commit -m "feat(pipeline): pipeline + timeline queries"
```

---

## Task 7: Server actions

**Files:**
- Create: `features/pipeline/actions.ts`

- [ ] **Step 1: Write the file.**

```ts
"use server"
// features/pipeline/actions.ts

import {revalidatePath} from "next/cache"
import type {DealStage} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {STAGE_ORDER} from "./types"
import {addActivitySchema} from "./validation"

export type PipelineActionResult = {ok: true} | {ok: false; error: string}

export async function moveLeadStage(leadId: string, toStage: DealStage): Promise<PipelineActionResult> {
	const {orgId, userId} = await requireOrg()
	if (!STAGE_ORDER.includes(toStage)) return {ok: false, error: "Nieznany etap"}
	const lead = await prisma.lead.findFirst({where: {id: leadId, organizationId: orgId}, select: {dealStage: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	if (lead.dealStage === toStage) return {ok: true}
	await prisma.$transaction([
		prisma.lead.update({where: {id: leadId}, data: {dealStage: toStage}}),
		prisma.leadActivity.create({
			data: {organizationId: orgId, leadId, kind: "STAGE_CHANGE", fromStage: lead.dealStage, toStage, authorUserId: userId},
		}),
	])
	revalidatePath("/pipeline")
	revalidatePath(`/leady/${leadId}`)
	return {ok: true}
}

export async function addLeadActivity(_prev: PipelineActionResult | null, formData: FormData): Promise<PipelineActionResult> {
	const {orgId, userId} = await requireOrg()
	const parsed = addActivitySchema.safeParse({
		leadId: formData.get("leadId"),
		kind: formData.get("kind"),
		body: formData.get("body"),
	})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	const lead = await prisma.lead.findFirst({where: {id: parsed.data.leadId, organizationId: orgId}, select: {id: true}})
	if (!lead) return {ok: false, error: "Nie znaleziono leada"}
	await prisma.leadActivity.create({
		data: {organizationId: orgId, leadId: parsed.data.leadId, kind: parsed.data.kind, body: parsed.data.body, authorUserId: userId},
	})
	revalidatePath(`/leady/${parsed.data.leadId}`)
	return {ok: true}
}

export async function deleteLeadActivity(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	const activity = await prisma.leadActivity.findFirst({where: {id, organizationId: orgId}, select: {leadId: true, kind: true}})
	if (!activity || activity.kind === "STAGE_CHANGE") return
	await prisma.leadActivity.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath(`/leady/${activity.leadId}`)
}
```

- [ ] **Step 2: Typecheck.** Run: `npx tsc --noEmit` -> exit 0.

- [ ] **Step 3: Commit.**

```bash
git add features/pipeline/actions.ts
git commit -m "feat(pipeline): moveLeadStage / addLeadActivity / deleteLeadActivity"
```

---

## Task 8: Board UI (/pipeline)

**Files:**
- Create: `app/(app)/pipeline/page.tsx`
- Create: `app/(app)/pipeline/board.tsx`
- Create: `app/(app)/pipeline/card.tsx`

- [ ] **Step 1: Write the card.**

```tsx
"use client"
// app/(app)/pipeline/card.tsx

import {useRouter} from "next/navigation"
import type {PipelineLead} from "@/features/pipeline/types"

export function LeadCard({lead}: {lead: PipelineLead}) {
	const router = useRouter()
	const sub = [lead.city, lead.lineName].filter(Boolean).join(" · ")
	return (
		<div
			draggable
			onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
			onClick={() => router.push(`/leady/${lead.id}`)}
			className="cursor-pointer rounded border border-zinc-200 bg-white p-2 text-xs shadow-sm hover:border-zinc-300"
		>
			<div className="font-semibold">{lead.organizationName}</div>
			<div className="text-zinc-500">{sub || "—"}</div>
			<div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
				<span>{lead.sequenceStatus ?? ""}</span>
				<span>{lead.lastActivityAt ? new Date(lead.lastActivityAt).toLocaleDateString("pl-PL") : ""}</span>
			</div>
		</div>
	)
}
```

- [ ] **Step 2: Write the board.**

```tsx
"use client"
// app/(app)/pipeline/board.tsx

import {useRouter} from "next/navigation"
import {useState} from "react"
import type {DealStage} from "@/generated/prisma/client"
import {STAGE_LABEL, type PipelineLead} from "@/features/pipeline/types"
import {moveLeadStage} from "@/features/pipeline/actions"
import {LeadCard} from "./card"

const CAP = 60

export function PipelineBoard({columns}: {columns: {stage: DealStage; leads: PipelineLead[]}[]}) {
	const router = useRouter()

	async function move(stage: DealStage, leadId: string) {
		const res = await moveLeadStage(leadId, stage)
		if (res.ok) router.refresh()
		else alert(res.error)
	}

	return (
		<div className="flex gap-2 overflow-x-auto pb-2">
			{columns.map((col) => (
				<Column key={col.stage} stage={col.stage} leads={col.leads} onDropLead={move} />
			))}
		</div>
	)
}

function Column({stage, leads, onDropLead}: {stage: DealStage; leads: PipelineLead[]; onDropLead: (s: DealStage, id: string) => void}) {
	const [over, setOver] = useState(false)
	const [expanded, setExpanded] = useState(false)
	const collapsible = stage === "WON" || stage === "LOST"
	const [open, setOpen] = useState(!collapsible)
	const shown = expanded ? leads : leads.slice(0, CAP)

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setOver(true)
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault()
				setOver(false)
				const id = e.dataTransfer.getData("text/plain")
				if (id) onDropLead(stage, id)
			}}
			className={`flex w-56 shrink-0 flex-col gap-2 rounded-lg p-2 ${over ? "bg-blue-50" : "bg-zinc-100"}`}
		>
			<button
				type="button"
				onClick={() => collapsible && setOpen(!open)}
				className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-500"
			>
				<span>
					{STAGE_LABEL[stage]} · {leads.length}
				</span>
				{collapsible ? <span>{open ? "−" : "+"}</span> : null}
			</button>
			{open ? (
				<>
					{shown.map((lead) => (
						<LeadCard key={lead.id} lead={lead} />
					))}
					{!expanded && leads.length > CAP ? (
						<button type="button" onClick={() => setExpanded(true)} className="text-xs text-blue-600">
							+ {leads.length - CAP} więcej
						</button>
					) : null}
					{leads.length === 0 ? <div className="text-xs text-zinc-400">—</div> : null}
				</>
			) : null}
		</div>
	)
}
```

- [ ] **Step 3: Write the page.**

```tsx
// app/(app)/pipeline/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getPipelineLeads} from "@/features/pipeline/queries"
import {groupLeadsByStage} from "@/features/pipeline/group"
import {PipelineBoard} from "./board"

export default async function PipelinePage({searchParams}: {searchParams: Promise<{line?: string}>}) {
	const {orgId} = await requireOrg()
	const {line} = await searchParams
	const [leads, offeringLines] = await Promise.all([
		getPipelineLeads(orgId, {offeringLineId: line || null}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])
	const columns = groupLeadsByStage(leads)

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Pipeline ({leads.length})</h1>
			<form className="flex gap-2 text-sm">
				<select className="rounded border border-zinc-300 px-2 py-1" name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<button className="rounded border border-zinc-300 px-3 py-1" type="submit">
					Filtruj
				</button>
			</form>
			<PipelineBoard columns={columns} />
		</section>
	)
}
```

- [ ] **Step 4: Typecheck.** Run: `npx tsc --noEmit` -> exit 0.

- [ ] **Step 5: Commit.**

```bash
git add app/(app)/pipeline
git commit -m "feat(pipeline): /pipeline kanban board with native drag-and-drop"
```

---

## Task 9: Lead detail timeline + add-entry

**Files:**
- Create: `app/(app)/leady/[id]/timeline.tsx`
- Create: `app/(app)/leady/[id]/activity-form.tsx`
- Modify: `app/(app)/leady/[id]/page.tsx`

- [ ] **Step 1: Write the timeline component.**

```tsx
// app/(app)/leady/[id]/timeline.tsx
import type {TimelineItem} from "@/features/pipeline/types"
import {deleteLeadActivity} from "@/features/pipeline/actions"

const MANUAL = new Set(["NOTE", "CALL", "MEETING", "OFFER_SENT"])

export function LeadTimeline({items}: {items: TimelineItem[]}) {
	if (items.length === 0) return <p className="text-sm text-zinc-400">Brak aktywności.</p>
	return (
		<ul className="flex flex-col gap-2">
			{items.map((it) => (
				<li className="rounded border border-zinc-100 p-2 text-sm" key={`${it.source}-${it.id}`}>
					<div className="flex items-center justify-between">
						<span className="font-medium">{it.title}</span>
						<span className="text-xs text-zinc-400">{new Date(it.at).toLocaleString("pl-PL")}</span>
					</div>
					{it.detail ? <div className="text-zinc-600">{it.detail}</div> : null}
					{it.source === "activity" && MANUAL.has(it.kind) ? (
						<form action={deleteLeadActivity.bind(null, it.id)}>
							<button className="text-xs text-red-600" type="submit">
								Usuń
							</button>
						</form>
					) : null}
				</li>
			))}
		</ul>
	)
}
```

- [ ] **Step 2: Write the add-entry form.**

```tsx
"use client"
// app/(app)/leady/[id]/activity-form.tsx

import {useActionState} from "react"
import {addLeadActivity, type PipelineActionResult} from "@/features/pipeline/actions"

export function ActivityForm({leadId}: {leadId: string}) {
	const [state, action, pending] = useActionState<PipelineActionResult | null, FormData>(addLeadActivity, null)
	return (
		<form className="flex flex-col gap-2 rounded border border-zinc-200 p-2" action={action}>
			<input type="hidden" name="leadId" value={leadId} />
			<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="kind" defaultValue="NOTE">
				<option value="NOTE">Notatka</option>
				<option value="CALL">Telefon</option>
				<option value="MEETING">Spotkanie</option>
				<option value="OFFER_SENT">Oferta wysłana</option>
			</select>
			<textarea className="rounded border border-zinc-300 px-2 py-1 text-sm" name="body" rows={2} placeholder="Treść wpisu" />
			<button className="self-start rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj wpis
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

- [ ] **Step 3: Replace `app/(app)/leady/[id]/page.tsx` with the extended version.**

```tsx
// app/(app)/leady/[id]/page.tsx
import Link from "next/link"
import {notFound} from "next/navigation"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {getLeadTimeline} from "@/features/pipeline/queries"
import {STAGE_LABEL} from "@/features/pipeline/types"
import {LeadEditForm} from "./lead-edit-form"
import {LeadTimeline} from "./timeline"
import {ActivityForm} from "./activity-form"

export default async function LeadEditPage({params}: {params: Promise<{id: string}>}) {
	const {orgId} = await requireOrg()
	const {id} = await params
	const lead = await prisma.lead.findFirst({where: {id, organizationId: orgId}})
	if (!lead) notFound()

	const cf = (lead.customFields as Record<string, unknown> | null) ?? {}
	const customFields = Object.entries(cf).map(([key, value]) => ({key, value: String(value ?? "")}))
	const timeline = await getLeadTimeline(orgId, id)

	return (
		<section className="flex flex-col gap-6">
			<Link className="text-sm text-blue-600" href="/leady">
				← Leady
			</Link>
			<div className="flex items-center gap-3">
				<h1 className="text-lg font-semibold">{lead.organizationName}</h1>
				<span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">Etap: {STAGE_LABEL[lead.dealStage]}</span>
			</div>

			<div className="grid gap-8 md:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-zinc-500">Dane</h2>
					<LeadEditForm
						lead={{
							id: lead.id,
							organizationName: lead.organizationName,
							email: lead.email,
							website: lead.website,
							contactPersonName: lead.contactPersonName,
							contactRole: lead.contactRole,
							city: lead.city,
							honorific: lead.honorific,
						}}
						customFields={customFields}
					/>
				</div>
				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-zinc-500">Oś czasu</h2>
					<ActivityForm leadId={lead.id} />
					<LeadTimeline items={timeline} />
				</div>
			</div>
		</section>
	)
}
```

- [ ] **Step 4: Typecheck.** Run: `npx tsc --noEmit` -> exit 0.

- [ ] **Step 5: Commit.**

```bash
git add app/(app)/leady/[id]
git commit -m "feat(pipeline): lead detail timeline + add-entry form"
```

---

## Task 10: Nav link + final gates

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Add the nav link.** In `app/(app)/layout.tsx`, inside `<nav>`, add a `Pipeline` link right after the `Leady` link:

```tsx
<Link href="/leady">Leady</Link>
<Link href="/pipeline">Pipeline</Link>
```

- [ ] **Step 2: Run the full unit suite.**

Run: `npx vitest run`
Expected: PASS, all prior tests plus the new pipeline tests green.

- [ ] **Step 3: Typecheck.**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Production build.** (Coordinate: stop the dev server first - `next build` needs the port free.)

Run: `npm run build`
Expected: build succeeds; `/pipeline` and `/leady/[id]` compile.

- [ ] **Step 5: Commit.**

```bash
git add app/(app)/layout.tsx
git commit -m "feat(pipeline): nav link; phase 6 gates green (tsc/vitest/build)"
```

- [ ] **Step 6 (optional manual smoke, dev server on):** Open `/pipeline`, drag a card to another column (verify it moves + persists on refresh), open a lead, add a Notatka, confirm the timeline shows the note + the stage change + any existing email events. Move mailbox/test-mode are irrelevant here.

---

## Post-implementation

- Run `graphify update .` (AST-only) after code lands; re-run `graphify . --obsidian` since docs (this plan + spec) changed.
- Update `docs/superpowers/ROADMAP.md`: mark Phase 6 DONE (code/test/build), note Phase 7 (visual polish) next, and that drag-drop polish + owner UI were deferred to Phase 7 per the spec.
