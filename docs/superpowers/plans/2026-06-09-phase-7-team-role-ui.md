# Phase 7 — team-role-ui Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the `MEMBER < ADMIN < OWNER` role ladder in server actions and ship a team-management UI (DB invitations, role changes, member removal) as a "Zespół" section in `/ustawienia` — per the approved spec `docs/superpowers/specs/2026-06-09-phase-7-team-role-ui-design.md`.

**Architecture:** One additive migration (`Invitation`). Pure, unit-tested decision logic in `features/team/` (`roles` ladder, `guards` last-owner invariant, `join` sign-in resolution); `lib/auth-helpers.ts` and `lib/org.ts` stay thin shells over it. Enforcement is DB-fresh (`requireRole` re-reads the membership); the session/JWT role is used only for UI politeness (nav visibility, sidebar label). The gating map is exhaustive and small — 9 mutation sites + 1 route + 2 page guards.

**Tech Stack:** Next 16 App Router, Auth.js v5 (JWT strategy), Prisma 7 (`@/generated/prisma/client`, client output IS git-tracked), Zod 4 (`z.email()`), Vitest 4, `components/ui/*` primitives, `ROLE_LABEL` from `features/enums/labels.ts`.

---

## Conventions (every code step)

- Tabs, no semicolons. Path comment line 1 — or line 2 after `"use client"`/`"use server"`. `className` FIRST prop. `import {x}` no inner spaces. NO emoji.
- `prisma/schema.prisma` is indented with TABS — keep it that way (do not run `prisma format`).
- Gates per task: `npx tsc --noEmit` -> 0, `npx eslint <touched paths>` -> clean, `npx vitest run` for tasks with tests. One task = one commit. Do NOT push. Do NOT run `next build` (the user's dev server is live).
- Pure modules in `features/team/` must NOT import prisma/next-auth (that's what keeps them unit-testable).

---

### Task 1: Migration — `Invitation` model

**Files:**
- Modify: `prisma/schema.prisma` (model after `Membership` ~line 205; relations on `Organization` + `User`)
- Created by tool: `prisma/migrations/<ts>_phase7_team_role_ui/migration.sql`
- Regenerated: `generated/prisma/**` (tracked in git — commit it)

- [ ] **Step 1: Add the model + relations to `prisma/schema.prisma`** (tabs!)

After the `Membership` model add:
```prisma
model Invitation {
	id             String   @id @default(cuid())
	organizationId String
	email          String
	role           Role     @default(MEMBER)
	invitedById    String?
	createdAt      DateTime @default(now())

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	invitedBy    User?        @relation("InvitationInvitedBy", fields: [invitedById], references: [id], onDelete: SetNull)

	@@unique([organizationId, email])
}
```
In `model Organization` add to the relation list: `invitations   Invitation[]`. In `model User` add: `invitationsSent Invitation[] @relation("InvitationInvitedBy")`.

- [ ] **Step 2: Create the migration WITHOUT applying** (project memory: protect Neon — `--create-only`, then `deploy`; never plain `migrate dev`)

Run: `npx prisma migrate dev --create-only --name phase7_team_role_ui`
Expected: a new folder `prisma/migrations/*_phase7_team_role_ui/` with `migration.sql`.

- [ ] **Step 3: Inspect the SQL — must be additive only**

Read the generated `migration.sql`. Expected: one `CREATE TABLE "Invitation"`, two FK constraints, one unique index on `(organizationId, email)`. NO `DROP`/`ALTER` of existing tables. If anything else appears, STOP and report.

- [ ] **Step 4: Apply + regenerate**

Run: `npx prisma migrate deploy` -> "1 migration applied". Then `npx prisma generate` -> client regenerated into `generated/prisma`.

- [ ] **Step 5: Gate + commit**

`npx tsc --noEmit` -> 0.
```bash
git add prisma generated
git commit -m "feat(phase7): Invitation model (migration phase7_team_role_ui)"
```

---

### Task 2: Pure team logic — roles / guards / join (TDD)

**Files:**
- Create: `features/team/roles.ts`, `features/team/guards.ts`, `features/team/join.ts`
- Test: `features/team/roles.test.ts`, `features/team/guards.test.ts`, `features/team/join.test.ts`

- [ ] **Step 1: Write the failing tests (all three files)**

`features/team/roles.test.ts`:
```ts
// features/team/roles.test.ts
import {describe, it, expect} from "vitest"
import {Role} from "@/generated/prisma/client"
import {ROLE_ORDER, hasRole} from "@/features/team/roles"

describe("hasRole", () => {
	it("ROLE_ORDER is total over Role", () => {
		for (const r of Object.values(Role)) expect(typeof ROLE_ORDER[r]).toBe("number")
	})
	it("ladder: every role passes its own minimum", () => {
		for (const r of Object.values(Role)) expect(hasRole(r, r)).toBe(true)
	})
	it("OWNER >= ADMIN >= MEMBER", () => {
		expect(hasRole("OWNER", "ADMIN")).toBe(true)
		expect(hasRole("OWNER", "MEMBER")).toBe(true)
		expect(hasRole("ADMIN", "MEMBER")).toBe(true)
		expect(hasRole("ADMIN", "OWNER")).toBe(false)
		expect(hasRole("MEMBER", "ADMIN")).toBe(false)
		expect(hasRole("MEMBER", "OWNER")).toBe(false)
	})
})
```

`features/team/guards.test.ts`:
```ts
// features/team/guards.test.ts
import {describe, it, expect} from "vitest"
import {ownerCount, canChangeRole, canRemoveMember} from "@/features/team/guards"

const team = [
	{membershipId: "m1", role: "OWNER" as const},
	{membershipId: "m2", role: "ADMIN" as const},
	{membershipId: "m3", role: "MEMBER" as const},
]
const twoOwners = [...team, {membershipId: "m4", role: "OWNER" as const}]

describe("team guards", () => {
	it("ownerCount counts owners", () => {
		expect(ownerCount(team)).toBe(1)
		expect(ownerCount(twoOwners)).toBe(2)
	})
	it("cannot demote the last owner", () => {
		expect(canChangeRole(team, "m1", "ADMIN")).toBe(false)
		expect(canChangeRole(team, "m1", "OWNER")).toBe(true)
	})
	it("can demote an owner when another remains", () => {
		expect(canChangeRole(twoOwners, "m1", "MEMBER")).toBe(true)
	})
	it("non-owner role changes are free", () => {
		expect(canChangeRole(team, "m2", "MEMBER")).toBe(true)
		expect(canChangeRole(team, "m3", "OWNER")).toBe(true)
	})
	it("cannot remove the last owner; others removable", () => {
		expect(canRemoveMember(team, "m1")).toBe(false)
		expect(canRemoveMember(twoOwners, "m1")).toBe(true)
		expect(canRemoveMember(team, "m2")).toBe(true)
		expect(canRemoveMember(team, "m3")).toBe(true)
	})
	it("unknown target is rejected", () => {
		expect(canChangeRole(team, "nope", "ADMIN")).toBe(false)
		expect(canRemoveMember(team, "nope")).toBe(false)
	})
})
```

`features/team/join.test.ts`:
```ts
// features/team/join.test.ts
import {describe, it, expect} from "vitest"
import {resolveJoin} from "@/features/team/join"

describe("resolveJoin", () => {
	it("existing membership wins over everything", () => {
		expect(resolveJoin({hasMembership: true, invitation: {organizationId: "o1", role: "ADMIN"}, isOwnerEmail: true})).toEqual({kind: "existing"})
	})
	it("invitation is consumed when no membership", () => {
		expect(resolveJoin({hasMembership: false, invitation: {organizationId: "o1", role: "ADMIN"}, isOwnerEmail: false})).toEqual({kind: "consume", organizationId: "o1", role: "ADMIN"})
	})
	it("invitation wins over owner-email (explicit role beats bootstrap)", () => {
		expect(resolveJoin({hasMembership: false, invitation: {organizationId: "o1", role: "MEMBER"}, isOwnerEmail: true})).toEqual({kind: "consume", organizationId: "o1", role: "MEMBER"})
	})
	it("owner-email bootstraps when nothing else matches", () => {
		expect(resolveJoin({hasMembership: false, invitation: null, isOwnerEmail: true})).toEqual({kind: "bootstrap"})
	})
	it("otherwise rejected", () => {
		expect(resolveJoin({hasMembership: false, invitation: null, isOwnerEmail: false})).toEqual({kind: "reject"})
	})
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run features/team` — expect 3 files FAIL (modules not found).

- [ ] **Step 3: Implement the three modules**

`features/team/roles.ts`:
```ts
// features/team/roles.ts
import type {Role} from "@/generated/prisma/client"

export const ROLE_ORDER: Record<Role, number> = {MEMBER: 0, ADMIN: 1, OWNER: 2}

export function hasRole(actual: Role, min: Role): boolean {
	return ROLE_ORDER[actual] >= ROLE_ORDER[min]
}
```

`features/team/guards.ts`:
```ts
// features/team/guards.ts
import type {Role} from "@/generated/prisma/client"

export interface TeamMemberLite {
	membershipId: string
	role: Role
}

export function ownerCount(members: TeamMemberLite[]): number {
	return members.filter((m) => m.role === "OWNER").length
}

// False when the target does not exist or the change would leave the org with no OWNER.
export function canChangeRole(members: TeamMemberLite[], targetId: string, newRole: Role): boolean {
	const target = members.find((m) => m.membershipId === targetId)
	if (!target) return false
	if (target.role === "OWNER" && newRole !== "OWNER" && ownerCount(members) <= 1) return false
	return true
}

export function canRemoveMember(members: TeamMemberLite[], targetId: string): boolean {
	const target = members.find((m) => m.membershipId === targetId)
	if (!target) return false
	if (target.role === "OWNER" && ownerCount(members) <= 1) return false
	return true
}
```

`features/team/join.ts`:
```ts
// features/team/join.ts
import type {Role} from "@/generated/prisma/client"

export interface JoinInput {
	hasMembership: boolean
	invitation: {organizationId: string; role: Role} | null
	isOwnerEmail: boolean
}

export type JoinDecision =
	| {kind: "existing"}
	| {kind: "consume"; organizationId: string; role: Role}
	| {kind: "bootstrap"}
	| {kind: "reject"}

// Sign-in resolution order: existing membership > pending invitation > OWNER_EMAIL bootstrap > reject.
export function resolveJoin({hasMembership, invitation, isOwnerEmail}: JoinInput): JoinDecision {
	if (hasMembership) return {kind: "existing"}
	if (invitation) return {kind: "consume", organizationId: invitation.organizationId, role: invitation.role}
	if (isOwnerEmail) return {kind: "bootstrap"}
	return {kind: "reject"}
}
```

- [ ] **Step 4: Run to verify they pass**

`npx vitest run features/team` -> 3 files, all green. Then full `npx vitest run` -> 235 + new all green.

- [ ] **Step 5: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint features/team` -> clean.
```bash
git add features/team
git commit -m "feat(phase7): pure team logic - role ladder, last-owner guards, join resolution (TDD)"
```

---

### Task 3: Sign-in rework — invitations replace the env allowlist

**Files:**
- Rewrite: `lib/auth-helpers.ts`
- Modify: `lib/auth.ts` (one callback line)
- Modify: `.env.example` (deprecate `ALLOWED_EMAILS`)

- [ ] **Step 1: Rewrite `lib/auth-helpers.ts`**

```ts
// lib/auth-helpers.ts
import {prisma} from "@/lib/prisma"
import {resolveJoin} from "@/features/team/join"

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function isOwnerEmail(normalized: string): boolean {
	return !!process.env.OWNER_EMAIL && normalized === process.env.OWNER_EMAIL.trim().toLowerCase()
}

// Sign-in is allowed for existing members, invited e-mails, and the OWNER_EMAIL bootstrap.
// (ALLOWED_EMAILS is retired - membership is managed in-app via invitations.)
export async function isSignInAllowed(email: string | null | undefined): Promise<boolean> {
	if (!email) return false
	const normalized = normalizeEmail(email)
	const user = await prisma.user.findFirst({
		where: {email: {equals: normalized, mode: "insensitive"}},
		select: {memberships: {select: {id: true}, take: 1}},
	})
	if (user && user.memberships.length > 0) return true
	const invitation = await prisma.invitation.findFirst({where: {email: normalized}, select: {id: true}})
	if (invitation) return true
	return isOwnerEmail(normalized)
}

// Returns the user's membership, creating it on first sign-in: a pending invitation is consumed
// (membership gets the invited role, the invitation row is deleted), or OWNER_EMAIL bootstraps
// the org + an OWNER membership. Decision logic is pure (features/team/join.ts).
export async function ensureMembership(userId: string, email: string) {
	const normalized = normalizeEmail(email)
	const existing = await prisma.membership.findFirst({where: {userId}})
	const invitation = existing ? null : await prisma.invitation.findFirst({where: {email: normalized}})
	const decision = resolveJoin({
		hasMembership: !!existing,
		invitation: invitation ? {organizationId: invitation.organizationId, role: invitation.role} : null,
		isOwnerEmail: isOwnerEmail(normalized),
	})

	if (decision.kind === "existing") return existing!
	if (decision.kind === "consume") {
		const [membership] = await prisma.$transaction([
			prisma.membership.create({data: {userId, organizationId: decision.organizationId, role: decision.role}}),
			prisma.invitation.delete({where: {id: invitation!.id}}),
		])
		return membership
	}
	if (decision.kind === "bootstrap") {
		const org =
			(await prisma.organization.findFirst({orderBy: {createdAt: "asc"}})) ??
			(await prisma.organization.create({data: {name: "Moja agencja"}}))
		return prisma.membership.upsert({
			where: {userId_organizationId: {userId, organizationId: org.id}},
			update: {},
			create: {userId, organizationId: org.id, role: "OWNER"},
		})
	}
	throw new Error("Sign-in not allowed: no membership or invitation")
}
```
(The old `isEmailAllowed` is deleted; the `Role` type import is no longer needed.)

- [ ] **Step 2: Update `lib/auth.ts`**

Change the import and the `signIn` callback (everything else stays):
```ts
import {ensureMembership, isSignInAllowed} from "@/lib/auth-helpers"
```
```ts
		async signIn({user}) {
			return isSignInAllowed(user.email)
		},
```

- [ ] **Step 3: Deprecate the env var in `.env.example`**

Replace the `ALLOWED_EMAILS=""` line with:
```
# DEPRECATED since team-role-ui: sign-in is governed by memberships + in-app invitations; only OWNER_EMAIL is read.
ALLOWED_EMAILS=""
```

- [ ] **Step 4: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint lib/auth-helpers.ts lib/auth.ts` -> clean. `npx vitest run` -> green (no test imports these modules).
```bash
git add lib/auth-helpers.ts lib/auth.ts .env.example
git commit -m "feat(phase7): sign-in via memberships + invitations; retire ALLOWED_EMAILS"
```

---

### Task 4: Enforcement helpers — `currentRole` + `requireRole` in `lib/org.ts`

**Files:**
- Modify: `lib/org.ts`

- [ ] **Step 1: Extend `lib/org.ts`** (full new content)

```ts
// lib/org.ts
import {auth} from "@/lib/auth"
import {prisma} from "@/lib/prisma"
import {hasRole} from "@/features/team/roles"
import type {Role} from "@/generated/prisma/client"

export interface OrgContext {
	userId: string
	orgId: string
	role: Role
}

export async function requireOrg(): Promise<OrgContext> {
	const session = await auth()
	if (!session?.user?.id || !session.user.orgId) {
		throw new Error("Unauthorized")
	}
	return {
		userId: session.user.id,
		orgId: session.user.orgId,
		role: session.user.role,
	}
}

// Re-reads the role from the DB so role changes/removal apply immediately (the session JWT
// only refreshes at sign-in and is used for UI politeness, never for enforcement).
export async function currentRole(ctx: OrgContext): Promise<Role> {
	const membership = await prisma.membership.findUnique({
		where: {userId_organizationId: {userId: ctx.userId, organizationId: ctx.orgId}},
		select: {role: true},
	})
	if (!membership) throw new Error("Unauthorized")
	return membership.role
}

export async function requireRole(min: Role): Promise<OrgContext> {
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, min)) throw new Error("Forbidden")
	return {...ctx, role}
}
```

- [ ] **Step 2: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint lib/org.ts` -> clean.
```bash
git add lib/org.ts
git commit -m "feat(phase7): requireRole/currentRole - DB-fresh role enforcement helpers"
```

---

### Task 5: Apply the gating map

**Files:**
- Modify: `features/campaigns/sending-actions.ts`, `features/email-accounts/actions.ts`, `features/suppression/actions.ts`, `features/org/settings.ts`, `app/api/mailbox/google/connect/route.ts`, `app/(app)/ustawienia/page.tsx`, `app/(app)/skrzynki/page.tsx`

The edit in each action is ONE line: swap `const {orgId} = await requireOrg()` for `const {orgId} = await requireRole("ADMIN")` (+ the import). Touch NOTHING else in the function bodies.

- [ ] **Step 1: `features/campaigns/sending-actions.ts`** — add `requireRole` to the `@/lib/org` import; gate `activateCampaign` + `setSendingMailbox` with `requireRole("ADMIN")`. **`pauseCampaign` stays `requireOrg`** (safety action, MEMBER-allowed — per spec).
- [ ] **Step 2: `features/email-accounts/actions.ts`** — gate `disconnectEmailAccount` + `updateEmailAccountSettings` with `requireRole("ADMIN")`.
- [ ] **Step 3: `features/suppression/actions.ts`** — gate `removeSuppression` ONLY. `addSuppression` + `markDoNotContact` stay `requireOrg` (protective ops).
- [ ] **Step 4: `features/org/settings.ts`** — gate `setOrgName`, `setSenderSignature`, `setOrgInboundSettings`. `getOrgSettings` stays `requireOrg` (read; the page is gated below).
- [ ] **Step 5: `app/api/mailbox/google/connect/route.ts`** — swap `requireOrg` for `requireRole("ADMIN")`:
```ts
// app/api/mailbox/google/connect/route.ts
import {NextResponse} from "next/server"
import {requireRole} from "@/lib/org"
import {buildConsentUrl, signState} from "@/features/email-accounts/google-oauth"

export async function GET() {
	const {orgId} = await requireRole("ADMIN")
	const url = buildConsentUrl(signState(orgId))
	return NextResponse.redirect(url)
}
```
- [ ] **Step 6: page guards.** In `app/(app)/skrzynki/page.tsx`, replace the `requireOrg` line with a fresh-role guard (and add imports `currentRole` from `@/lib/org`, `hasRole` from `@/features/team/roles`, `redirect` from `next/navigation`):
```ts
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, "ADMIN")) redirect("/")
	const orgId = ctx.orgId
```
Same guard at the top of `app/(app)/ustawienia/page.tsx` (it currently calls only `getOrgSettings()` — add the guard BEFORE it; keep `getOrgSettings()` as-is). The `role` value is reused in Task 7.
- [ ] **Step 7: Verify the map by grep**

`grep -n "requireRole" features lib app -r` must list EXACTLY: sending-actions (2: activate, setSendingMailbox), email-accounts/actions (2), suppression/actions (1: removeSuppression), org/settings (3), connect route (1), org.ts (definition). And `grep -n "requireOrg()" features/campaigns/sending-actions.ts features/suppression/actions.ts` still shows `pauseCampaign`, `addSuppression`, `markDoNotContact`.

- [ ] **Step 8: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint <the 7 files>` -> clean. `npx vitest run` -> green (activation tests mock `requireOrg`? If a test imports these actions and fails on the new import, mock `requireRole` the same way the file already mocks `requireOrg` — report if anything else breaks).
```bash
git add features/campaigns/sending-actions.ts features/email-accounts/actions.ts features/suppression/actions.ts features/org/settings.ts "app/api/mailbox/google/connect/route.ts" "app/(app)/ustawienia/page.tsx" "app/(app)/skrzynki/page.tsx"
git commit -m "feat(phase7): apply role gating map - ADMIN for sending/mailboxes/org-config, page guards"
```

---

### Task 6: Team module — queries + actions

**Files:**
- Create: `features/team/queries.ts`, `features/team/actions.ts`

- [ ] **Step 1: `features/team/queries.ts`**

```ts
// features/team/queries.ts
import {prisma} from "@/lib/prisma"
import type {Role} from "@/generated/prisma/client"

export interface TeamMember {
	membershipId: string
	name: string | null
	email: string
	role: Role
	since: Date
}

export interface PendingInvitation {
	id: string
	email: string
	role: Role
	createdAt: Date
}

const ORDER: Record<Role, number> = {OWNER: 0, ADMIN: 1, MEMBER: 2}

export async function listTeam(orgId: string): Promise<{members: TeamMember[]; invitations: PendingInvitation[]}> {
	const [memberships, invitations] = await Promise.all([
		prisma.membership.findMany({
			where: {organizationId: orgId},
			include: {user: {select: {name: true, email: true}}},
			orderBy: {createdAt: "asc"},
		}),
		prisma.invitation.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "asc"}}),
	])
	const members = memberships
		.map((m) => ({membershipId: m.id, name: m.user.name, email: m.user.email, role: m.role, since: m.createdAt}))
		.sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.since.getTime() - b.since.getTime())
	return {
		members,
		invitations: invitations.map((i) => ({id: i.id, email: i.email, role: i.role, createdAt: i.createdAt})),
	}
}
```

- [ ] **Step 2: `features/team/actions.ts`** (all four OWNER-gated)

```ts
"use server"
// features/team/actions.ts

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireRole} from "@/lib/org"
import {canChangeRole, canRemoveMember} from "@/features/team/guards"
import type {Role} from "@/generated/prisma/client"

export type TeamActionResult = {ok: true} | {ok: false; error: string}

const inviteSchema = z.object({
	email: z.string().trim().toLowerCase().pipe(z.email("Błędny e-mail")),
	role: z.enum(["MEMBER", "ADMIN", "OWNER"]),
})

export async function inviteMember(_prev: TeamActionResult | null, formData: FormData): Promise<TeamActionResult> {
	const {orgId, userId} = await requireRole("OWNER")
	const parsed = inviteSchema.safeParse({email: formData.get("email"), role: formData.get("role")})
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	const {email, role} = parsed.data

	const member = await prisma.membership.findFirst({
		where: {organizationId: orgId, user: {email: {equals: email, mode: "insensitive"}}},
		select: {id: true},
	})
	if (member) return {ok: false, error: "Ta osoba jest już członkiem zespołu"}

	try {
		await prisma.invitation.create({data: {organizationId: orgId, email, role, invitedById: userId}})
	} catch {
		return {ok: false, error: "Ten e-mail jest już zaproszony"}
	}
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function cancelInvitation(id: string): Promise<void> {
	const {orgId} = await requireRole("OWNER")
	await prisma.invitation.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/ustawienia")
}

const ROLES: Role[] = ["MEMBER", "ADMIN", "OWNER"]

export async function changeMemberRole(membershipId: string, formData: FormData): Promise<TeamActionResult> {
	const {orgId} = await requireRole("OWNER")
	const role = String(formData.get("role")) as Role
	if (!ROLES.includes(role)) return {ok: false, error: "Błędna rola"}
	const members = await prisma.membership.findMany({where: {organizationId: orgId}, select: {id: true, role: true}})
	const lite = members.map((m) => ({membershipId: m.id, role: m.role}))
	if (!canChangeRole(lite, membershipId, role)) return {ok: false, error: "Nie można odebrać roli ostatniemu właścicielowi"}
	await prisma.membership.updateMany({where: {id: membershipId, organizationId: orgId}, data: {role}})
	revalidatePath("/ustawienia")
	return {ok: true}
}

export async function removeMember(membershipId: string): Promise<void> {
	const {orgId} = await requireRole("OWNER")
	const members = await prisma.membership.findMany({where: {organizationId: orgId}, select: {id: true, role: true}})
	const lite = members.map((m) => ({membershipId: m.id, role: m.role}))
	if (!canRemoveMember(lite, membershipId)) return
	await prisma.membership.deleteMany({where: {id: membershipId, organizationId: orgId}})
	revalidatePath("/ustawienia")
}
```

- [ ] **Step 3: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint features/team` -> clean.
```bash
git add features/team/queries.ts features/team/actions.ts
git commit -m "feat(phase7): team queries + OWNER-gated invite/role/remove actions"
```

---

### Task 7: "Zespół" settings section (UI)

**Files:**
- Modify: `app/(app)/ustawienia/page.tsx` (guard from Task 5 + conditional section)
- Create: `app/(app)/ustawienia/team-section.tsx` (server glue), `app/(app)/ustawienia/invite-form.tsx` (client), `app/(app)/ustawienia/team-table.tsx` (client)

Before coding, READ `components/ui/confirm-button.tsx` and `components/ui/toast-provider.tsx` to mirror the exact `useToast()` API used elsewhere.

- [ ] **Step 1: `app/(app)/ustawienia/page.tsx`** — full new content:

```tsx
// app/(app)/ustawienia/page.tsx
import {redirect} from "next/navigation"
import {requireOrg, currentRole} from "@/lib/org"
import {hasRole} from "@/features/team/roles"
import {getOrgSettings} from "@/features/org/settings"
import {listTeam} from "@/features/team/queries"
import {SettingsShell, type SettingsSection} from "./settings-shell"
import {GeneralForm} from "./general-form"
import {SenderSignatureForm} from "./sender-signature-form"
import {SettingsForm} from "./settings-form"
import {TeamSection} from "./team-section"

export default async function SettingsPage() {
	const ctx = await requireOrg()
	const role = await currentRole(ctx)
	if (!hasRole(role, "ADMIN")) redirect("/")

	const s = await getOrgSettings()
	const sections: SettingsSection[] = [
		{id: "ogolne", label: "Ogólne", content: <GeneralForm name={s.name} />},
		{id: "podpis", label: "Podpis nadawcy", content: <SenderSignatureForm signature={s.senderSignature} />},
		{id: "optout", label: "Wykrywanie rezygnacji", content: <SettingsForm optOutMode={s.optOutMode} optOutDetector={s.optOutDetector} />},
	]
	if (hasRole(role, "OWNER")) {
		const team = await listTeam(ctx.orgId)
		sections.push({id: "zespol", label: "Zespół", content: <TeamSection members={team.members} invitations={team.invitations} />})
	}
	return (
		<section className="flex flex-col gap-6">
			<div>
				<h1 className="text-[21px] font-semibold tracking-[-0.025em]">Ustawienia</h1>
				<p className="mt-0.5 text-[13px] text-fg-muted">Konfiguracja organizacji, wysyłki i zespołu.</p>
			</div>
			<SettingsShell sections={sections} />
		</section>
	)
}
```

- [ ] **Step 2: `app/(app)/ustawienia/team-section.tsx`**

```tsx
// app/(app)/ustawienia/team-section.tsx
import type {TeamMember, PendingInvitation} from "@/features/team/queries"
import {InviteForm} from "./invite-form"
import {TeamTable} from "./team-table"

export function TeamSection({members, invitations}: {members: TeamMember[]; invitations: PendingInvitation[]}) {
	return (
		<div className="flex flex-col gap-4">
			<InviteForm />
			<TeamTable members={members} invitations={invitations} />
		</div>
	)
}
```

- [ ] **Step 3: `app/(app)/ustawienia/invite-form.tsx`** (mirror the repo's `useActionState` form idiom — e.g. `suppression-form.tsx`)

```tsx
"use client"
// app/(app)/ustawienia/invite-form.tsx

import {useActionState} from "react"
import {inviteMember, type TeamActionResult} from "@/features/team/actions"
import {ROLE_LABEL} from "@/features/enums/labels"
import {Input} from "@/components/ui/input"
import {Select} from "@/components/ui/select"
import {Button} from "@/components/ui/button"

export function InviteForm() {
	const [state, action, pending] = useActionState<TeamActionResult | null, FormData>(inviteMember, null)
	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<Input className="max-w-72" name="email" type="email" placeholder="adres@email.pl" required />
			<Select className="w-44" name="role" defaultValue="MEMBER">
				<option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
				<option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
				<option value="OWNER">{ROLE_LABEL.OWNER}</option>
			</Select>
			<Button variant="primary" type="submit" disabled={pending}>Zaproś</Button>
			{state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}
			{state && state.ok ? <p className="text-sm text-success">Zaproszono. Ta osoba może się już zalogować kontem Google.</p> : null}
		</form>
	)
}
```

- [ ] **Step 4: `app/(app)/ustawienia/team-table.tsx`**

Member rows: name + faint e-mail | role control | join date (`toLocaleDateString("pl-PL")`) | remove. The LAST owner (i.e. `row.role === "OWNER" && ownerCount(members as lite) === 1`) renders a `Badge` + an em-dash instead of the Select/remove. Role changes submit instantly via a per-row form whose Select `onChange` calls `requestSubmit()`; the bound `changeMemberRole` returns `TeamActionResult` — toast success/error via `useToast`. Invitation rows are dimmed: e-mail | role `Badge` | `Badge variant="warn"` "Oczekuje" | `ConfirmButton` "Anuluj". Removal via `ConfirmButton`.

```tsx
"use client"
// app/(app)/ustawienia/team-table.tsx

import {useTransition} from "react"
import type {TeamMember, PendingInvitation} from "@/features/team/queries"
import type {Role} from "@/generated/prisma/client"
import {changeMemberRole, removeMember, cancelInvitation} from "@/features/team/actions"
import {ownerCount} from "@/features/team/guards"
import {ROLE_LABEL} from "@/features/enums/labels"
import {Table, Th, Td} from "@/components/ui/table"
import {Badge} from "@/components/ui/badge"
import {Select} from "@/components/ui/select"
import {ConfirmButton} from "@/components/ui/confirm-button"
import {useToast} from "@/components/ui/toast-provider"

function RoleSelect({membershipId, role}: {membershipId: string; role: Role}) {
	const toast = useToast()
	const [pending, startTransition] = useTransition()
	return (
		<form
			action={(formData) =>
				startTransition(async () => {
					const res = await changeMemberRole(membershipId, formData)
					toast(res.ok ? "Zmieniono rolę" : res.error)
				})
			}
		>
			<Select className="w-44" name="role" defaultValue={role} disabled={pending} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="MEMBER">{ROLE_LABEL.MEMBER}</option>
				<option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
				<option value="OWNER">{ROLE_LABEL.OWNER}</option>
			</Select>
		</form>
	)
}

export function TeamTable({members, invitations}: {members: TeamMember[]; invitations: PendingInvitation[]}) {
	const owners = ownerCount(members.map((m) => ({membershipId: m.membershipId, role: m.role})))
	return (
		<Table>
			<thead>
				<tr>
					<Th>Osoba</Th>
					<Th>Rola</Th>
					<Th>Od</Th>
					<Th>{""}</Th>
				</tr>
			</thead>
			<tbody>
				{members.map((m) => {
					const lastOwner = m.role === "OWNER" && owners <= 1
					return (
						<tr key={m.membershipId}>
							<Td>
								<span className="text-sm font-semibold text-fg">{m.name ?? m.email}</span>
								<div className="text-[11px] text-fg-faint">{m.email}</div>
							</Td>
							<Td>{lastOwner ? <Badge variant="info">{ROLE_LABEL.OWNER}</Badge> : <RoleSelect membershipId={m.membershipId} role={m.role} />}</Td>
							<Td className="text-fg-muted">{m.since.toLocaleDateString("pl-PL")}</Td>
							<Td className="text-right">
								{lastOwner ? (
									<span className="text-fg-faint">—</span>
								) : (
									<ConfirmButton action={removeMember.bind(null, m.membershipId)} confirm={{title: "Usunąć członka?", body: "Ta osoba straci dostęp do aplikacji i nie zaloguje się ponownie.", confirmLabel: "Usuń", danger: true}} toast="Usunięto członka">
										Usuń
									</ConfirmButton>
								)}
							</Td>
						</tr>
					)
				})}
				{invitations.map((i) => (
					<tr className="opacity-75" key={i.id}>
						<Td>
							<span className="text-sm text-fg-muted">{i.email}</span>
							<div className="text-[11px] text-fg-faint">zaproszenie · {i.createdAt.toLocaleDateString("pl-PL")}</div>
						</Td>
						<Td><Badge>{ROLE_LABEL[i.role]}</Badge></Td>
						<Td><Badge variant="warn">Oczekuje</Badge></Td>
						<Td className="text-right">
							<ConfirmButton action={cancelInvitation.bind(null, i.id)} confirm={{title: "Anulować zaproszenie?", body: "Ten e-mail nie będzie mógł się zalogować.", confirmLabel: "Anuluj zaproszenie", cancelLabel: "Wróć", danger: true}} toast="Anulowano zaproszenie">
								Anuluj
							</ConfirmButton>
						</Td>
					</tr>
				))}
			</tbody>
		</Table>
	)
}
```
Adjust the `useToast`/`ConfirmButton` call shapes to the REAL APIs after reading the two component files (e.g. `useToast()` may return an object or a function; `confirm` prop fields may differ — `cancelLabel` exists per the batch-view usage).

- [ ] **Step 5: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint "app/(app)/ustawienia/**" features/team` -> clean. `npx vitest run` -> green.
```bash
git add "app/(app)/ustawienia" 
git commit -m "feat(phase7): Zespol settings section - invite form + team table (OWNER-only)"
```

---

### Task 8: Visibility politeness — nav, sidebar label, campaign sending controls

**Files:**
- Modify: `app/(app)/nav-items.tsx`, `app/(app)/sidebar.tsx`, `app/(app)/kampanie/[id]/page.tsx`, `app/(app)/kampanie/[id]/sending-controls.tsx`

- [ ] **Step 1: `nav-items.tsx`** — add `minRole` to the two gated items:

```ts
import type {Role} from "@/generated/prisma/client"
```
```ts
export interface NavItem {href: string; label: string; Icon: ({className}: {className?: string}) => React.ReactNode; minRole?: Role}
```
`Skrzynki` item gets `minRole: "ADMIN"`; `SETTINGS_ITEM` gets `minRole: "ADMIN"`. Nothing else changes.

- [ ] **Step 2: `sidebar.tsx`** — filter + Polish role label. Add imports:
```ts
import {hasRole} from "@/features/team/roles"
import {ROLE_LABEL} from "@/features/enums/labels"
import type {Role} from "@/generated/prisma/client"
```
Inside `Sidebar`, before the return:
```ts
	const canSee = (item: NavItem) => !item.minRole || hasRole(user.role as Role, item.minRole)
	const roleLabel = ROLE_LABEL[user.role as Role] ?? user.role
```
- In the nav loop use `g.items.filter(canSee)` (compute per group; skip rendering a group whose filtered list is empty).
- Render the settings link only when `canSee(SETTINGS_ITEM)`.
- Line 99: `{user.orgName} · {user.role}` -> `{user.orgName} · {roleLabel}`. Line 109 badge: `{user.role}` -> `{roleLabel}`.
(If `user.role` is `""` — no session role — `hasRole` sees `undefined >= n` -> `false`, so gated items hide; the `?? user.role` fallback keeps the label safe. This is politeness only; enforcement is server-side.)

- [ ] **Step 3: `kampanie/[id]/page.tsx`** — pass the flag (session role = politeness):
```ts
import {hasRole} from "@/features/team/roles"
```
The page already destructures `const {orgId} = await requireOrg()` — change to `const {orgId, role} = await requireOrg()`, then:
```tsx
				<SendingControls
					campaignId={campaign.id}
					mailboxes={mailboxes.map((m) => ({id: m.id, email: m.email}))}
					currentMailboxId={campaign.sendingEmailAccountId}
					canManageSending={hasRole(role, "ADMIN")}
				/>
```

- [ ] **Step 4: `sending-controls.tsx`** — add `canManageSending: boolean` to `Props`; wrap the mailbox `<form>` AND the activate `<form>` in `{canManageSending ? (...) : null}` (one fragment). The pause `ConfirmButton`, the activate result `<p>`s, and the "Brak skrzynek" hint stay outside (visible to everyone). Pure prop-gating — no action/logic changes.

- [ ] **Step 5: Gate + commit**

`npx tsc --noEmit` -> 0. `npx eslint "app/(app)/nav-items.tsx" "app/(app)/sidebar.tsx" "app/(app)/kampanie/**"` -> clean. `npx vitest run` -> green.
```bash
git add "app/(app)/nav-items.tsx" "app/(app)/sidebar.tsx" "app/(app)/kampanie/[id]/page.tsx" "app/(app)/kampanie/[id]/sending-controls.tsx"
git commit -m "feat(phase7): role-aware nav/sidebar + ADMIN-only sending controls (UI politeness)"
```

---

### Task 9: Final verification + docs

- [ ] **Step 1: Full gates.** `npx tsc --noEmit` (0), `npx vitest run` (all green — expect 235 + ~14 new), `npx eslint "app/(app)/**" "features/team/**" "features/org/**" lib` (clean). `next build` ONLY if the dev server is off — otherwise note it as deferred.
- [ ] **Step 2: Enforcement audit.** Re-run the Task 5 Step 7 grep; additionally `grep -rn "requireRole(\"OWNER\")" features/team/actions.ts` -> 4 hits. Confirm `features/team/{roles,guards,join}.ts` import NOTHING from `lib/` or prisma.
- [ ] **Step 3: Spec amendment.** Append one risk line to `docs/superpowers/specs/2026-06-09-phase-7-team-role-ui-design.md`: a REMOVED member's existing JWT session keeps MEMBER-level (ungated) access until the token expires (Auth.js default 30 d) — sign-in is blocked immediately, gated actions are blocked immediately; accepted for an internal tool (mitigation if ever needed: shorter `session.maxAge` or a membership check in `requireOrg`).
- [ ] **Step 4: ROADMAP.** Update `docs/superpowers/ROADMAP.md`: `team-role-ui` DONE + verified -> **Phase 7 fully DONE**; the only remaining launch blockers are the funded `ANTHROPIC_API_KEY` live runs + Inngest Cloud cron verification + the deferred `next build`s. Note the live smoke the user should run (invite -> sign in on a second account -> promote -> verify gating without re-login).
- [ ] **Step 5: graphify.** `graphify update .` (AST refresh; code changed). Commit docs + graph refresh:
```bash
git add docs graphify-out
git commit -m "docs(phase7): team-role-ui DONE - Phase 7 complete + refresh graph"
```

---

## Self-review notes (author check vs spec)

- **Spec coverage:** model+migration = Task 1; pure logic (roles/guards/join incl. the spec's §3 pure module + §4 guards) = Task 2; §2 sign-in flow (3 allow rules, consumption tx, ALLOWED_EMAILS retirement, OWNER_EMAIL bootstrap) = Task 3; §3 helpers = Task 4; §3 gating map (all 9 actions + route + 2 page guards, pause/add/markDoNotContact exemptions) = Task 5; §4 module = Task 6; §5 UI (OWNER-only section, invite form, single table with dimmed invitation rows + Oczekuje badge, last-owner "—", ROLE_LABEL everywhere) = Tasks 7-8; §6 testing + the live-smoke note = Task 9.
- **Type consistency:** `TeamMemberLite {membershipId, role}` is the shared guard input; actions map Prisma rows to it explicitly. `resolveJoin` consumes `{organizationId, role}` — matches the `Invitation` columns. `changeMemberRole` returns `TeamActionResult` (toast needs the error); `removeMember`/`cancelInvitation` return `void` (ConfirmButton fires its own toast).
- **Known divergence from spec wording:** the spec's §4 says all four team actions use `useActionState`-style results; the plan gives results only where the UI consumes them (`inviteMember`, `changeMemberRole`) — ConfirmButton-driven actions are void, matching every existing destructive action in the repo.
- **Risk handled in-plan:** Task 7 instructs reading the real `useToast`/`ConfirmButton` APIs before coding (the snippets show intent, the implementer mirrors the actual signatures); Task 5 warns about test files that may need a `requireRole` mock next to the existing `requireOrg` mock.
