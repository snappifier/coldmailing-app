# Phase 7 — team-role-ui — Design

Date: 2026-06-09. Status: spec approved (user approved the full design incl. the three flagged decisions).
Sub-project #10 of Phase 7 — the FINAL piece. Size M. Depends on `design-foundation` (primitives),
`page-level-visual-pass` (`ROLE_LABEL` already exists in `features/enums/labels.ts`), and the settings shell.
Direction chosen via brainstorm (3 questions) + a visual mock (`.superpowers/brainstorm/1208-*/content/zespol-layout.html`,
user picked **variant B: table**).

## Goal

Make the `Role` ladder real: `MEMBER < ADMIN < OWNER` enforced in server actions (today `requireOrg()` returns
`role` but nothing checks it), plus a team-management UI — invite by e-mail (DB invitation, no e-mail sending),
change roles, remove members — as a new "Zespół" section in `/ustawienia`.

## Approved decisions (user choices)

- **Joining = DB invitations** (option 1, with an optional future path to full e-mail invitations): OWNER adds an
  e-mail + role in the UI; that person signs in with Google and gets the invited role. No invitation e-mails sent.
- **Role semantics = operational ladder** (option 1, with an optional future path to a per-feature matrix):
  MEMBER does all daily work; ADMIN adds sending/mailbox/org-config powers; OWNER adds team management.
- **Team UI layout = table** (mock variant B): members + pending invitations in ONE `Table`, invite form on top.
- Flagged + approved: (1) `ALLOWED_EMAILS` stops working — `OWNER_EMAIL` + invitations replace it;
  (2) `pauseCampaign` stays MEMBER (safety action), activation is ADMIN+; (3) `/ustawienia` and `/skrzynki`
  pages are ADMIN+, the Zespół section is OWNER-only.

## Scope

**IN:** `Invitation` model + migration; sign-in flow rework (invitation consumption, env allowlist retired);
`requireRole`/`currentRole` helpers + pure `hasRole`; gating the ADMIN/OWNER action set (exact map below);
`features/team/` module (queries + 4 actions + pure guards); the Zespół settings section (invite form + team
table); nav/page visibility for MEMBER; sidebar role display via `ROLE_LABEL`.

**OUT (future-friendly):** sending invitation e-mails (model stays forward-compatible — add `token`/`expiresAt`
additively); per-feature permission matrix (would replace the inside of `hasRole`/`requireRole`); audit log;
multi-org; invitation history (consumed invitation rows are deleted, not archived).

## 1. Data model — migration `phase7_team_role_ui` (additive)

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

`Organization` += `invitations Invitation[]`; `User` += `invitationsSent Invitation[] @relation("InvitationInvitedBy")`.
E-mail is normalized to lowercase at write time (action) and lookup time (auth). A pending invitation = a row
exists; consumption (first sign-in) creates the `Membership` with `invitation.role` and DELETES the row, in one
transaction.

## 2. Sign-in flow (`lib/auth-helpers.ts` + `lib/auth.ts`)

Sign-in is allowed iff ANY of:
1. the e-mail's `User` already has a `Membership` (existing member),
2. a pending `Invitation` exists for the lowercased e-mail,
3. the lowercased e-mail equals `OWNER_EMAIL` (bootstrap escape hatch — also first-org creation).

`isEmailAllowed` (sync, env-only) becomes an async DB check (`signIn` callback supports async). `ensureMembership(userId, email)` becomes:
1. membership exists for `userId` -> return it;
2. pending invitation for the e-mail -> transaction: create `Membership {userId, organizationId, role: invitation.role}` + delete the invitation -> return it;
3. e-mail == `OWNER_EMAIL` -> `Organization.findFirst() ?? create("Moja agencja")`, create OWNER membership -> return it;
4. else throw (defensive — the `signIn` callback should have blocked).

**`ALLOWED_EMAILS` is retired** (no longer read; remove from the allow check, mark deprecated in `.env.example`).
Rationale: with a DB-managed team, an env allowlist would re-admit a removed member — removal must stick.
Today the org has a single member (the user), so retiring it cuts nobody off. `OWNER_EMAIL` stays (bootstrap +
recovery), and the last-OWNER guard (below) prevents a zero-owner org.

## 3. Role enforcement

- **Pure** `features/team/roles.ts` (unit-tested): `ROLE_ORDER: Record<Role, number> = {MEMBER: 0, ADMIN: 1, OWNER: 2}`
  and `hasRole(actual: Role, min: Role): boolean`. (Pure module so it tests without the `next-auth` import chain.)
- `lib/org.ts` adds two helpers (`requireOrg` itself unchanged — MEMBER-level actions keep their zero-extra-query path):
  - `currentRole(ctx: OrgContext): Promise<Role>` — re-reads the membership role from the DB
    (`membership.findUnique({where: {userId_organizationId}})`); throws Unauthorized if the membership is gone.
  - `requireRole(min: Role): Promise<OrgContext>` — `requireOrg()` + `currentRole()` + `hasRole` check; throws
    `Forbidden` otherwise; returns the ctx with the FRESH role.
- **Freshness model:** enforcement always reads the DB (a role change or removal takes effect immediately in
  gated actions). The JWT/session role is used only for UI politeness (nav visibility, sidebar label) and may lag
  until the next sign-in — accepted for an internal tool; pages additionally do a fresh check (below).

### Gating map (exhaustive)

**ADMIN+ (`requireRole("ADMIN")`):**
- `features/campaigns/sending-actions.ts`: `activateCampaign`, `setSendingMailbox` (NOT `pauseCampaign` — stays MEMBER).
- `features/email-accounts/actions.ts`: `disconnectEmailAccount`, `updateEmailAccountSettings`.
- `app/api/mailbox/google/connect` route (OAuth initiation; the callback keeps its signed-state validation).
- `features/suppression/actions.ts`: `removeSuppression` ONLY (`addSuppression` + `markDoNotContact` stay MEMBER — protective ops).
- `features/org/settings.ts`: `setOrgName`, `setSenderSignature`, `setOrgInboundSettings` (the read-only `getOrgSettings` stays as-is — the page itself is ADMIN-gated).
- Pages: `/ustawienia` and `/skrzynki` do a fresh role check server-side (`currentRole` + `hasRole`) and `redirect("/")` below ADMIN.

**OWNER (`requireRole("OWNER")`):** all four `features/team/actions.ts` actions.

**Unchanged (MEMBER, `requireOrg` only):** everything else — leads CRUD/import, research types/runs/batches,
drafts, templates, placeholders, offering lines, campaigns create/delete/steps/assign, `pauseCampaign`,
`addSuppression`, `markDoNotContact`, pipeline moves, activities.

## 4. `features/team/` module

- `queries.ts` — `listTeam(orgId)`: members (`membershipId`, user `name`/`email`, `role`, `createdAt`) +
  pending invitations (`id`, `email`, `role`, `createdAt`), both org-scoped, stable order (role desc, then createdAt asc).
- `guards.ts` — **pure, unit-tested** over a `{membershipId, role}[]` array: `ownerCount`,
  `canChangeRole(members, targetId, newRole)` (false when it would demote the LAST owner),
  `canRemoveMember(members, targetId)` (false for the last owner). Self-demotion/self-removal allowed when
  another OWNER remains (fresh checks make it take effect immediately; the actor's sidebar lags until re-login).
- `actions.ts` (`"use server"`, ALL `requireRole("OWNER")`, org-scoped writes, `revalidatePath("/ustawienia")`):
  - `inviteMember` (useActionState result): Zod 4 `z.email()`, lowercase; friendly errors when the e-mail is
    already a member or already invited (pre-check + unique-constraint catch).
  - `cancelInvitation(id)` — org-scoped `deleteMany`.
  - `changeMemberRole(membershipId, role)` — loads org members, `canChangeRole` guard, org-scoped update.
  - `removeMember(membershipId)` — `canRemoveMember` guard, deletes the membership (the User row and their
    created content remain; the person just loses access — and can no longer sign in, per section 2 rule 1 failing).

## 5. UI

- **`/ustawienia` section "Zespół"** (sections array entry; rendered ONLY for OWNER — sections gain an optional
  `minRole` filtered against the page's fresh role): server `team-section.tsx` (fetch `listTeam`) renders the
  invite form + team table.
  - Invite form (client, `useActionState`): `Input` e-mail + `Select` role (via `ROLE_LABEL`) + `Button variant="primary"` "Zaproś"; error as token `<p>`; toast on success.
  - Team table (client): `Table` primitive — Osoba (name + faint e-mail) | Rola | Od | actions. Member rows: role
    as a per-row `Select` (`ROLE_LABEL` options) submitting immediately via transition + toast; `ConfirmButton`
    "Usuń". The last OWNER renders a `Badge` "Właściciel" + "—" (no select, no remove). Invitation rows (same
    table, dimmed): e-mail | role `Badge` | `Badge variant="warn"` "Oczekuje" | `ConfirmButton` "Anuluj".
- **Visibility (politeness; session role):** nav hides "Ustawienia" + "Skrzynki" below ADMIN (`nav-items.tsx`
  gains optional `minRole`; sidebar filters with `hasRole`). On the campaign page, MEMBER does not see the
  mailbox select + activate controls (pause stays visible). Server actions remain the real gate.
- **Sidebar role label:** display via `ROLE_LABEL` ("Właściciel"/"Administrator"/"Członek") instead of the raw
  enum — closes the last role-enum leak.

## 6. Testing

- Pure: `roles.test.ts` (ladder totality over `Role` + ordering cases), `guards.test.ts` (last-owner matrix:
  demote last owner / remove last owner / two owners OK / self-cases), invitation e-mail normalization if extracted.
- Existing 235 tests stay green; `tsc` 0; `eslint` clean; `next build` when the dev server is off.
- Migration per the project memory: `prisma migrate dev --create-only` then `migrate deploy` (Neon).
- Live smoke (user): invite an e-mail, sign in with it on a second Google account, see MEMBER nav (no Ustawienia/
  Skrzynki), promote to ADMIN, verify a gated action works without re-login (fresh check).

## Risks / notes

- **JWT staleness is deliberate:** enforcement is DB-fresh; only UI visibility lags until re-login. Document in code.
- The `signIn` callback becomes async + DB-touching (runs once per sign-in — negligible).
- `OWNER_EMAIL` must remain set in env (bootstrap + recovery); the last-owner guard prevents a zero-owner org.
  Corner case, by design: a removed member whose e-mail equals `OWNER_EMAIL` can sign back in and is re-created
  as OWNER (rule 3) — that IS the recovery hatch; to fully expel that person, change `OWNER_EMAIL` too.
- Single-org assumptions unchanged (invitation lookup may scope by e-mail alone at sign-in; writes stay org-scoped).
- No behavior change for MEMBER-level actions — they keep `requireOrg` (no extra query per action).
- Deploy: existing sessions keep working (the token shape is unchanged); `.env.example` updated (ALLOWED_EMAILS deprecated).
