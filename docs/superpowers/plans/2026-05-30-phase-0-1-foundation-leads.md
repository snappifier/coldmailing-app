# Phase 0 + 1: Foundation + Leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the cold-mailing app (DB, Google-OAuth auth restricted to invited members, org-scoped data model, Inngest wired) and ship lead management: offering lines, leads CRUD, CSV/paste import with column mapping, a filterable leads table, and a suppression list. No email sending and no AI yet.

**Architecture:** Single Next.js 16 App-Router app. Prisma 7 (driver-adapter `pg`) on Neon Postgres. Auth.js v5 with the Google provider + Prisma adapter + JWT sessions; access gated by an email allowlist; every user belongs to a first-class `Organization` via `Membership`, and all domain data is scoped by `organizationId`. Pure logic (CSV parsing, normalization, mapping, suppression checks) lives in framework-free modules under `features/*` and is unit-tested with Vitest; framework/infra wiring is verified by running the app. Inngest is wired with a hello function so later phases (sending, research) can add durable jobs.

**Tech Stack:** Next.js 16.2.x, React 19, TypeScript, Tailwind v4 (minimal styling only), Prisma 7.8 + `@prisma/adapter-pg` + `pg`, Auth.js v5 (`next-auth@5 beta`) + `@auth/prisma-adapter`, `inngest`, Zod 4, Vitest 4.

---

## Conventions (match the salon project — apply to every file)

- **Tabs** for indentation, **no semicolons** in TS/TSX.
- First line of every TS/TSX file is a path comment, e.g. `// lib/auth.ts`.
- `'use client'` / `"use server"` on the very first line when needed (path comment goes on line 2 in that case, or omit the path comment on directive files — be consistent within the repo; salon puts `"use server"` first then the path comment).
- `className` is the first JSX attribute. `import {x}` with no inner spaces. No `forwardRef`. **No emoji anywhere.**
- UI is intentionally minimal/raw Tailwind — mechanics-first. Do not build a design system; that is a later phase.

## Git note

The user controls git history. Each task ends with a suggested commit, but **do not run `git push`**, and confirm with the user before committing if running unattended. Commit messages must not contain emoji.

## Prerequisites (one-time, done by the user — list them, then proceed)

1. **Neon Postgres**: create a database, copy the connection string.
2. **Google OAuth**: in Google Cloud Console create an OAuth 2.0 Client (type: Web application). Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (add the production URL later). Copy the Client ID and Secret.
3. **`.env`** at repo root (`coldmailing-app/.env`) — created in Task 1.

---

# Phase 0 — Foundation

## Task 1: Dependencies, scripts, env, Prisma config

**Files:**
- Modify: `package.json`
- Create: `prisma.config.ts`
- Create: `.env`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install runtime + dev dependencies**

Run (in `coldmailing-app/`):

```bash
npm install @prisma/client@^7.8.0 @prisma/adapter-pg@^7.8.0 pg@^8.20.0 next-auth@^5.0.0-beta.31 @auth/prisma-adapter@^2.10.0 inngest@^3.27.0 zod@^4.4.3 clsx@^2.1.1 tailwind-merge@^3.5.0
npm install -D prisma@^7.8.0 @types/pg@^8.20.0 dotenv@^17.0.0 tsx@^4.21.0 vitest@^4.1.5 @vitejs/plugin-react@^6.0.1
```

Note: `@auth/prisma-adapter` and `inngest` versions may have moved — if npm reports a newer compatible major, accept the latest and note it. Everything else mirrors the salon project's known-good versions.

- [ ] **Step 2: Set package.json scripts**

Replace the `"scripts"` block in `package.json` with:

```json
"scripts": {
	"dev": "next dev",
	"build": "prisma generate && next build",
	"start": "next start",
	"lint": "eslint",
	"postinstall": "prisma generate",
	"test": "vitest",
	"db:migrate": "prisma migrate dev",
	"db:seed": "tsx prisma/seed.ts",
	"db:studio": "prisma studio"
}
```

- [ ] **Step 3: Create `prisma.config.ts`**

```ts
// prisma.config.ts
import "dotenv/config"
import {defineConfig} from "prisma/config"

export default defineConfig({
	schema: "./prisma/schema.prisma",
	migrations: {
		path: "./prisma/migrations",
		seed: "tsx prisma/seed.ts",
	},
	datasource: {
		url: process.env["DATABASE_URL"],
	},
})
```

- [ ] **Step 4: Create `.env` and `.env.example`**

`.env` (real values, gitignored):

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
AUTH_SECRET="generate-with: npx auth secret"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
ALLOWED_EMAILS="you@example.com,sister@example.com"
OWNER_EMAIL="you@example.com"
```

`.env.example` (committed, no secrets): same keys with empty values.

Generate the auth secret with `npx auth secret` (writes/refreshes `AUTH_SECRET`) or paste a 32-byte base64 string.

- [ ] **Step 5: Ignore the generated Prisma client**

Add to `.gitignore`:

```
# prisma generated client
/generated
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json prisma.config.ts .env.example .gitignore
git commit -m "chore: add prisma, auth, inngest, vitest deps and config"
```

(`.env` stays uncommitted by `.gitignore`.)

---

## Task 2: Prisma schema (Phase 0+1 subset) + migrate

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write the schema**

```prisma
// prisma/schema.prisma
generator client {
	provider = "prisma-client"
	output   = "../generated/prisma"
}

datasource db {
	provider = "postgresql"
}

enum Role {
	OWNER
	ADMIN
	MEMBER
}

enum Honorific {
	PAN
	PANI
}

enum DealStage {
	NEW
	AUDIT
	PROPOSAL
	MEETING
	OFFER
	WON
	LOST
}

enum SuppressionReason {
	UNSUBSCRIBED
	BOUNCED
	MANUAL
}

model Organization {
	id        String   @id @default(cuid())
	name      String
	createdAt DateTime @default(now())
	updatedAt DateTime @updatedAt

	memberships   Membership[]
	offeringLines OfferingLine[]
	leads         Lead[]
	suppressions  Suppression[]
}

model User {
	id            String    @id @default(cuid())
	name          String?
	email         String    @unique
	emailVerified DateTime?
	image         String?
	createdAt     DateTime  @default(now())

	accounts    Account[]
	sessions    Session[]
	memberships Membership[]
	ownedLeads  Lead[]       @relation("LeadOwner")
}

model Account {
	id                String  @id @default(cuid())
	userId            String
	type              String
	provider          String
	providerAccountId String
	refresh_token     String?
	access_token      String?
	expires_at        Int?
	token_type        String?
	scope             String?
	id_token          String?
	session_state     String?

	user User @relation(fields: [userId], references: [id], onDelete: Cascade)

	@@unique([provider, providerAccountId])
}

model Session {
	id           String   @id @default(cuid())
	sessionToken String   @unique
	userId       String
	expires      DateTime

	user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
	identifier String
	token      String
	expires    DateTime

	@@id([identifier, token])
}

model Membership {
	id             String   @id @default(cuid())
	userId         String
	organizationId String
	role           Role     @default(MEMBER)
	createdAt      DateTime @default(now())

	user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

	@@unique([userId, organizationId])
}

model OfferingLine {
	id             String   @id @default(cuid())
	organizationId String
	name           String
	description    String?
	color          String?
	createdAt      DateTime @default(now())
	updatedAt      DateTime @updatedAt

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	leads        Lead[]

	@@unique([organizationId, name])
}

model Lead {
	id                String     @id @default(cuid())
	organizationId    String
	offeringLineId    String?
	organizationName  String
	website           String?
	contactPersonName String?
	contactRole       String?
	email             String?
	phone             String?
	city              String?
	region            String?
	schoolType        String?
	honorific         Honorific?
	siteQuality       Int?
	priority          Int?
	aiHook            String?
	aiNotes           String?
	customFields      Json?
	dealStage         DealStage  @default(NEW)
	ownerUserId       String?
	source            String?
	createdAt         DateTime   @default(now())
	updatedAt         DateTime   @updatedAt

	organization Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
	offeringLine OfferingLine? @relation(fields: [offeringLineId], references: [id], onDelete: SetNull)
	owner        User?         @relation("LeadOwner", fields: [ownerUserId], references: [id], onDelete: SetNull)

	@@unique([organizationId, email])
	@@index([organizationId, dealStage])
}

model Suppression {
	id             String            @id @default(cuid())
	organizationId String
	email          String
	reason         SuppressionReason @default(MANUAL)
	createdAt      DateTime          @default(now())

	organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

	@@unique([organizationId, email])
}
```

Note: `@@unique([organizationId, email])` on `Lead` and `Suppression` is safe with nullable `email` — Postgres treats NULLs as distinct, so leads without email are allowed.

- [ ] **Step 2: Write the seed (default organization)**

```ts
// prisma/seed.ts
import {PrismaClient} from "../generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const prisma = new PrismaClient({
	adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
})

async function main() {
	const existing = await prisma.organization.findFirst()
	if (!existing) {
		await prisma.organization.create({data: {name: "Moja agencja"}})
		console.log("Seeded default organization")
	} else {
		console.log("Organization already exists, skipping seed")
	}
}

main()
	.then(() => prisma.$disconnect())
	.catch(async (e) => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
```

- [ ] **Step 3: Generate client + create the migration**

Run:

```bash
npx prisma migrate dev --name init
```

Expected: Prisma creates `prisma/migrations/<timestamp>_init/`, applies it to Neon, and generates the client into `generated/prisma/`. If Neon rejects migration over a pooled URL (advisory-lock error), temporarily point `DATABASE_URL` at the Neon **direct** (non-pooled) connection string for migrations.

- [ ] **Step 4: Seed**

Run:

```bash
npm run db:seed
```

Expected output: `Seeded default organization`.

- [ ] **Step 5: Verify in Studio (optional)**

Run `npm run db:studio`, confirm the `Organization` row exists. Close Studio.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations
git commit -m "feat: prisma schema for org, auth, offering lines, leads, suppression"
```

---

## Task 3: Prisma client singleton + cn util

**Files:**
- Create: `lib/prisma.ts`
- Create: `lib/cn.ts`

- [ ] **Step 1: Prisma singleton**

```ts
// lib/prisma.ts
import {PrismaClient} from "@/generated/prisma/client"
import {PrismaPg} from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg({connectionString: process.env.DATABASE_URL!}),
	})

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 2: cn util**

```ts
// lib/cn.ts
import {clsx, type ClassValue} from "clsx"
import {twMerge} from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `lib/prisma.ts` or `lib/cn.ts` (the generated client resolves via `@/generated/prisma/client`).

- [ ] **Step 4: Commit**

```bash
git add lib/prisma.ts lib/cn.ts
git commit -m "feat: prisma client singleton and cn util"
```

---

## Task 4: Auth.js v5 (Google + allowlist + org membership)

**Files:**
- Create: `lib/auth-helpers.ts`
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `types/next-auth.d.ts`

- [ ] **Step 1: Membership helper**

```ts
// lib/auth-helpers.ts
import {prisma} from "@/lib/prisma"
import type {Role} from "@/generated/prisma/client"

// Returns the single org's membership for this user, creating the org
// (if none exists) and the membership (if missing). Owner role is granted
// to OWNER_EMAIL, everyone else on the allowlist is a MEMBER.
export async function ensureMembership(userId: string, email: string) {
	const org =
		(await prisma.organization.findFirst({orderBy: {createdAt: "asc"}})) ??
		(await prisma.organization.create({data: {name: "Moja agencja"}}))

	const isOwner =
		!!process.env.OWNER_EMAIL &&
		email.toLowerCase() === process.env.OWNER_EMAIL.toLowerCase()
	const role: Role = isOwner ? "OWNER" : "MEMBER"

	return prisma.membership.upsert({
		where: {userId_organizationId: {userId, organizationId: org.id}},
		update: {},
		create: {userId, organizationId: org.id, role},
	})
}

export function isEmailAllowed(email: string | null | undefined): boolean {
	if (!email) return false
	const allowed = (process.env.ALLOWED_EMAILS ?? "")
		.split(",")
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
	return allowed.includes(email.toLowerCase())
}
```

- [ ] **Step 2: Auth config**

```ts
// lib/auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import {PrismaAdapter} from "@auth/prisma-adapter"
import {prisma} from "@/lib/prisma"
import {ensureMembership, isEmailAllowed} from "@/lib/auth-helpers"
import type {Role} from "@/generated/prisma/client"

export const {handlers, signIn, signOut, auth} = NextAuth({
	adapter: PrismaAdapter(prisma),
	session: {strategy: "jwt"},
	pages: {signIn: "/logowanie"},
	providers: [Google],
	callbacks: {
		signIn({user}) {
			return isEmailAllowed(user.email)
		},
		async jwt({token, user}) {
			if (user?.id && user.email) {
				const membership = await ensureMembership(user.id, user.email)
				token.uid = user.id
				token.orgId = membership.organizationId
				token.role = membership.role
			}
			return token
		},
		session({session, token}) {
			if (session.user) {
				if (token.uid) session.user.id = token.uid as string
				session.user.orgId = token.orgId as string
				session.user.role = token.role as Role
			}
			return session
		},
	},
})
```

- [ ] **Step 3: Route handler**

```ts
// app/api/auth/[...nextauth]/route.ts
import {handlers} from "@/lib/auth"

export const {GET, POST} = handlers
```

- [ ] **Step 4: Type augmentation**

```ts
// types/next-auth.d.ts
import type {DefaultSession} from "next-auth"
import type {Role} from "@/generated/prisma/client"

declare module "next-auth" {
	interface Session {
		user: {
			id: string
			orgId: string
			role: Role
		} & DefaultSession["user"]
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		uid?: string
		orgId?: string
		role?: Role
	}
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If TS cannot find the JWT module augmentation, confirm `types/**` is covered by `tsconfig.json` `include` — the existing `**/*.ts` glob covers it.)

- [ ] **Step 6: Commit**

```bash
git add lib/auth-helpers.ts lib/auth.ts app/api/auth types/next-auth.d.ts
git commit -m "feat: auth.js v5 google login with allowlist and org membership"
```

---

## Task 5: App shell — login page, protected layout, home redirect

**Files:**
- Create: `app/logowanie/page.tsx`
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/leady/page.tsx` (placeholder, replaced in Phase 1)
- Replace: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Minimal root layout (Polish, drop the Geist boilerplate)**

```tsx
// app/layout.tsx
import type {Metadata} from "next"
import "./globals.css"

export const metadata: Metadata = {
	title: "Cold Mailing",
	description: "Wewnętrzne narzędzie do cold-mailingu",
}

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
	return (
		<html lang="pl" className="h-full antialiased">
			<body className="min-h-full bg-white text-zinc-900">{children}</body>
		</html>
	)
}
```

- [ ] **Step 2: Trim globals.css to a minimal base (no dark mode, mechanics-first)**

```css
@import "tailwindcss";

body {
	font-family: ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 3: Login page**

```tsx
// app/logowanie/page.tsx
import {signIn, auth} from "@/lib/auth"
import {redirect} from "next/navigation"

export default async function LoginPage() {
	const session = await auth()
	if (session?.user) redirect("/leady")

	return (
		<main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
			<h1 className="text-xl font-semibold">Cold Mailing</h1>
			<p className="text-sm text-zinc-600">Zaloguj się kontem Google z listy dostępu.</p>
			<form
				action={async () => {
					"use server"
					await signIn("google", {redirectTo: "/leady"})
				}}
			>
				<button className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50" type="submit">
					Zaloguj przez Google
				</button>
			</form>
		</main>
	)
}
```

- [ ] **Step 4: Protected app layout with nav + sign-out**

```tsx
// app/(app)/layout.tsx
import {auth, signOut} from "@/lib/auth"
import {redirect} from "next/navigation"
import Link from "next/link"

export default async function AppLayout({children}: {children: React.ReactNode}) {
	const session = await auth()
	if (!session?.user) redirect("/logowanie")

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
				<nav className="flex gap-4 text-sm">
					<Link href="/leady">Leady</Link>
					<Link href="/linie">Linie usług</Link>
					<Link href="/suppression">Suppression</Link>
				</nav>
				<form
					action={async () => {
						"use server"
						await signOut({redirectTo: "/logowanie"})
					}}
				>
					<button className="text-sm text-zinc-600 hover:text-zinc-900" type="submit">
						Wyloguj ({session.user.email})
					</button>
				</form>
			</header>
			<main className="flex-1 p-4">{children}</main>
		</div>
	)
}
```

- [ ] **Step 5: Placeholder leads page (replaced in Task 10)**

```tsx
// app/(app)/leady/page.tsx
export default function LeadsPage() {
	return <p className="text-sm text-zinc-600">Leady (wkrótce).</p>
}
```

- [ ] **Step 6: Home redirect**

```tsx
// app/page.tsx
import {redirect} from "next/navigation"

export default function Home() {
	redirect("/leady")
}
```

- [ ] **Step 7: Verify login end-to-end**

Ask the user to run `npm run dev` (the user controls the dev server). Then:
1. Visit `http://localhost:3000` -> redirects to `/logowanie`.
2. Click "Zaloguj przez Google", sign in with an email listed in `ALLOWED_EMAILS` -> lands on `/leady`, header shows the email.
3. Sign in with an email NOT on the allowlist -> access denied (back to login / error). 
4. In Prisma Studio confirm a `User` row and a `Membership` row (role `OWNER` for `OWNER_EMAIL`) were created.

- [ ] **Step 8: Commit**

```bash
git add app/layout.tsx app/globals.css app/logowanie app/page.tsx "app/(app)"
git commit -m "feat: login page, protected app shell, home redirect"
```

---

## Task 6: Inngest wired (hello function)

**Files:**
- Create: `lib/inngest/client.ts`
- Create: `lib/inngest/functions.ts`
- Create: `app/api/inngest/route.ts`

- [ ] **Step 1: Inngest client**

```ts
// lib/inngest/client.ts
import {Inngest} from "inngest"

export const inngest = new Inngest({id: "coldmailing-app"})
```

- [ ] **Step 2: Hello function**

```ts
// lib/inngest/functions.ts
import {inngest} from "@/lib/inngest/client"

export const helloWorld = inngest.createFunction(
	{id: "hello-world"},
	{event: "test/hello.world"},
	async ({event}) => {
		return {message: `Hello ${event.data?.name ?? "world"}`}
	},
)
```

- [ ] **Step 3: Serve route**

```ts
// app/api/inngest/route.ts
import {serve} from "inngest/next"
import {inngest} from "@/lib/inngest/client"
import {helloWorld} from "@/lib/inngest/functions"

export const {GET, POST, PUT} = serve({client: inngest, functions: [helloWorld]})
```

Note: confirm the `serve` import path and signature against the installed Inngest version (`node_modules/inngest` README) — the App-Router serve handler is the documented integration.

- [ ] **Step 4: Verify**

With `npm run dev` running, in a second terminal run the Inngest dev server:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open `http://localhost:8288`, confirm the `hello-world` function is discovered. Send a `test/hello.world` event from the dev UI and confirm a successful run returning the message.

- [ ] **Step 5: Commit**

```bash
git add lib/inngest app/api/inngest
git commit -m "feat: wire inngest with hello-world function"
```

---

# Phase 1 — Leads + structure

## Task 7: Org context helper

**Files:**
- Create: `lib/org.ts`

- [ ] **Step 1: requireOrg**

```ts
// lib/org.ts
import {auth} from "@/lib/auth"
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
```

- [ ] **Step 2: Typecheck + commit**

Run `npx tsc --noEmit` (expect no errors), then:

```bash
git add lib/org.ts
git commit -m "feat: requireOrg context helper"
```

---

## Task 8: Offering lines (validation, actions, page)

**Files:**
- Create: `features/offering-lines/schema.ts`
- Create: `features/offering-lines/schema.test.ts`
- Create: `features/offering-lines/actions.ts`
- Create: `app/(app)/linie/page.tsx`
- Create: `app/(app)/linie/offering-line-form.tsx`
- Create: `vitest.config.ts`

- [ ] **Step 1: Vitest config**

```ts
// vitest.config.ts
import {defineConfig} from "vitest/config"
import react from "@vitejs/plugin-react"
import {fileURLToPath} from "node:url"

export default defineConfig({
	plugins: [react()],
	test: {environment: "node"},
	resolve: {
		alias: {"@": fileURLToPath(new URL("./", import.meta.url))},
	},
})
```

- [ ] **Step 2: Write the failing schema test**

```ts
// features/offering-lines/schema.test.ts
import {describe, it, expect} from "vitest"
import {offeringLineSchema} from "@/features/offering-lines/schema"

describe("offeringLineSchema", () => {
	it("accepts a valid name and trims it", () => {
		const parsed = offeringLineSchema.parse({name: "  Strony dla szkół  ", description: ""})
		expect(parsed.name).toBe("Strony dla szkół")
		expect(parsed.description).toBeNull()
	})

	it("rejects an empty name", () => {
		const result = offeringLineSchema.safeParse({name: "   "})
		expect(result.success).toBe(false)
	})
})
```

- [ ] **Step 3: Run it, expect failure**

Run: `npx vitest run features/offering-lines/schema.test.ts`
Expected: FAIL — cannot import `offeringLineSchema` (module/file does not exist yet).

- [ ] **Step 4: Implement the schema**

```ts
// features/offering-lines/schema.ts
import {z} from "zod"

export const offeringLineSchema = z.object({
	name: z.string().trim().min(1, "Podaj nazwę").max(80, "Za długa nazwa"),
	description: z
		.string()
		.trim()
		.max(500)
		.optional()
		.transform((v) => (v ? v : null)),
})

export type OfferingLineInput = z.infer<typeof offeringLineSchema>
```

- [ ] **Step 5: Run it, expect pass**

Run: `npx vitest run features/offering-lines/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Implement actions**

```ts
// features/offering-lines/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {offeringLineSchema} from "@/features/offering-lines/schema"

export type ActionResult = {ok: true} | {ok: false; error: string}

export async function createOfferingLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
	const {orgId} = await requireOrg()
	const parsed = offeringLineSchema.safeParse({
		name: formData.get("name"),
		description: formData.get("description"),
	})
	if (!parsed.success) {
		return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}
	}

	try {
		await prisma.offeringLine.create({
			data: {organizationId: orgId, name: parsed.data.name, description: parsed.data.description},
		})
	} catch {
		return {ok: false, error: "Linia o tej nazwie już istnieje"}
	}

	revalidatePath("/linie")
	return {ok: true}
}

export async function deleteOfferingLine(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.offeringLine.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/linie")
}
```

- [ ] **Step 7: Implement the create form (client, useActionState)**

```tsx
// app/(app)/linie/offering-line-form.tsx
"use client"

import {useActionState} from "react"
import {createOfferingLine, type ActionResult} from "@/features/offering-lines/actions"

export function OfferingLineForm() {
	const [state, action, pending] = useActionState<ActionResult | null, FormData>(createOfferingLine, null)

	return (
		<form className="flex flex-wrap items-end gap-2" action={action}>
			<label className="flex flex-col text-sm">
				Nazwa
				<input className="rounded border border-zinc-300 px-2 py-1" name="name" required />
			</label>
			<label className="flex flex-col text-sm">
				Opis
				<input className="rounded border border-zinc-300 px-2 py-1" name="description" />
			</label>
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

- [ ] **Step 8: Implement the page (server component)**

```tsx
// app/(app)/linie/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {OfferingLineForm} from "./offering-line-form"
import {deleteOfferingLine} from "@/features/offering-lines/actions"

export default async function OfferingLinesPage() {
	const {orgId} = await requireOrg()
	const lines = await prisma.offeringLine.findMany({
		where: {organizationId: orgId},
		orderBy: {createdAt: "asc"},
		include: {_count: {select: {leads: true}}},
	})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Linie usług</h1>
			<OfferingLineForm />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{lines.map((line) => (
					<li className="flex items-center justify-between py-2" key={line.id}>
						<span className="text-sm">
							{line.name} <span className="text-zinc-400">({line._count.leads} leadów)</span>
						</span>
						<form action={deleteOfferingLine.bind(null, line.id)}>
							<button className="text-sm text-red-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{lines.length === 0 ? <li className="py-2 text-sm text-zinc-500">Brak linii usług.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 9: Verify**

With dev running and logged in, visit `/linie`: add a line, see it listed with `(0 leadów)`, add a duplicate name -> inline error, delete a line -> it disappears.

- [ ] **Step 10: Commit**

```bash
git add features/offering-lines vitest.config.ts "app/(app)/linie"
git commit -m "feat: offering lines crud with validation and tests"
```

---

## Task 9: Lead import core (pure, TDD)

This is the heart of Phase 1 — parse pasted CSV/TSV, map columns to lead fields, and normalize values. Pure functions, fully unit-tested.

**Files:**
- Create: `features/leads/import.ts`
- Create: `features/leads/import.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// features/leads/import.test.ts
import {describe, it, expect} from "vitest"
import {detectDelimiter, splitRow, parseTable, normalizeEmail, normalizeWebsite, parseHonorific, mapRowsToLeads} from "@/features/leads/import"

describe("detectDelimiter", () => {
	it("prefers tab, then semicolon, then comma", () => {
		expect(detectDelimiter("a\tb\tc")).toBe("\t")
		expect(detectDelimiter("a;b;c")).toBe(";")
		expect(detectDelimiter("a,b,c")).toBe(",")
	})
})

describe("splitRow", () => {
	it("splits plain cells", () => {
		expect(splitRow("a,b,c", ",")).toEqual(["a", "b", "c"])
	})
	it("respects double-quoted cells containing the delimiter", () => {
		expect(splitRow('"Kowalski, Jan",x', ",")).toEqual(["Kowalski, Jan", "x"])
	})
})

describe("parseTable", () => {
	it("parses rows and ignores blank lines", () => {
		expect(parseTable("a,b\n1,2\n\n3,4")).toEqual([
			["a", "b"],
			["1", "2"],
			["3", "4"],
		])
	})
})

describe("normalizeEmail", () => {
	it("lowercases and trims", () => {
		expect(normalizeEmail("  Foo@Bar.PL ")).toBe("foo@bar.pl")
	})
	it("returns null for empty/invalid", () => {
		expect(normalizeEmail("   ")).toBeNull()
		expect(normalizeEmail("not-an-email")).toBeNull()
	})
})

describe("normalizeWebsite", () => {
	it("adds https and strips trailing slash", () => {
		expect(normalizeWebsite("example.pl/")).toBe("https://example.pl")
		expect(normalizeWebsite("http://x.pl")).toBe("http://x.pl")
	})
	it("returns null for empty", () => {
		expect(normalizeWebsite("")).toBeNull()
	})
})

describe("parseHonorific", () => {
	it("maps common forms", () => {
		expect(parseHonorific("Pan")).toBe("PAN")
		expect(parseHonorific("pani")).toBe("PANI")
		expect(parseHonorific("")).toBeNull()
		expect(parseHonorific("xyz")).toBeNull()
	})
})

describe("mapRowsToLeads", () => {
	const rows = [
		["Nazwa", "Email", "WWW", "Zwrot"],
		["I LO Zamość", "Sekretariat@1lo.com.pl", "1lo.com.pl", "Pani"],
		["", "brak", "", ""],
	]
	const mapping = {organizationName: 0, email: 1, website: 2, honorific: 3}

	it("maps with header row skipped and normalizes fields", () => {
		const leads = mapRowsToLeads(rows, mapping, {hasHeader: true})
		expect(leads).toHaveLength(1) // second data row dropped: no organizationName
		expect(leads[0]).toMatchObject({
			organizationName: "I LO Zamość",
			email: "sekretariat@1lo.com.pl",
			website: "https://1lo.com.pl",
			honorific: "PANI",
		})
	})

	it("requires organizationName (drops rows without it)", () => {
		const leads = mapRowsToLeads([["", "a@b.pl"]], {organizationName: 0, email: 1}, {hasHeader: false})
		expect(leads).toHaveLength(0)
	})
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run features/leads/import.test.ts`
Expected: FAIL — module `@/features/leads/import` not found.

- [ ] **Step 3: Implement the import core**

```ts
// features/leads/import.ts
import type {Honorific} from "@/generated/prisma/client"

export type LeadFieldKey =
	| "organizationName"
	| "website"
	| "contactPersonName"
	| "contactRole"
	| "email"
	| "phone"
	| "city"
	| "region"
	| "schoolType"
	| "honorific"

export type ColumnMapping = Partial<Record<LeadFieldKey, number>>

export interface LeadImportInput {
	organizationName: string
	website: string | null
	contactPersonName: string | null
	contactRole: string | null
	email: string | null
	phone: string | null
	city: string | null
	region: string | null
	schoolType: string | null
	honorific: Honorific | null
}

export function detectDelimiter(text: string): string {
	const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
	if (firstLine.includes("\t")) return "\t"
	if (firstLine.includes(";")) return ";"
	return ","
}

export function splitRow(line: string, delimiter: string): string[] {
	const cells: string[] = []
	let current = ""
	let inQuotes = false
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"'
				i++
			} else {
				inQuotes = !inQuotes
			}
		} else if (ch === delimiter && !inQuotes) {
			cells.push(current)
			current = ""
		} else {
			current += ch
		}
	}
	cells.push(current)
	return cells.map((c) => c.trim())
}

export function parseTable(text: string): string[][] {
	const delimiter = detectDelimiter(text)
	return text
		.split(/\r?\n/)
		.filter((line) => line.trim().length > 0)
		.map((line) => splitRow(line, delimiter))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string): string | null {
	const v = value.trim().toLowerCase()
	if (!v || !EMAIL_RE.test(v)) return null
	return v
}

export function normalizeWebsite(value: string): string | null {
	let v = value.trim()
	if (!v) return null
	if (!/^https?:\/\//i.test(v)) v = `https://${v}`
	return v.replace(/\/+$/, "")
}

export function parseHonorific(value: string): Honorific | null {
	const v = value.trim().toLowerCase()
	if (v === "pan") return "PAN"
	if (v === "pani") return "PANI"
	return null
}

function cell(row: string[], index: number | undefined): string {
	if (index === undefined) return ""
	return row[index]?.trim() ?? ""
}

export function mapRowsToLeads(
	rows: string[][],
	mapping: ColumnMapping,
	opts: {hasHeader: boolean},
): LeadImportInput[] {
	const dataRows = opts.hasHeader ? rows.slice(1) : rows
	const leads: LeadImportInput[] = []
	for (const row of dataRows) {
		const organizationName = cell(row, mapping.organizationName)
		if (!organizationName) continue
		leads.push({
			organizationName,
			website: normalizeWebsite(cell(row, mapping.website)),
			contactPersonName: cell(row, mapping.contactPersonName) || null,
			contactRole: cell(row, mapping.contactRole) || null,
			email: normalizeEmail(cell(row, mapping.email)),
			phone: cell(row, mapping.phone) || null,
			city: cell(row, mapping.city) || null,
			region: cell(row, mapping.region) || null,
			schoolType: cell(row, mapping.schoolType) || null,
			honorific: parseHonorific(cell(row, mapping.honorific)),
		})
	}
	return leads
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run features/leads/import.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add features/leads/import.ts features/leads/import.test.ts
git commit -m "feat: lead import parsing, normalization and mapping with tests"
```

---

## Task 10: Lead actions (import + manual CRUD + suppression filtering)

**Files:**
- Create: `features/leads/actions.ts`
- Create: `features/leads/dedupe.ts`
- Create: `features/leads/dedupe.test.ts`

- [ ] **Step 1: Write failing dedupe test**

```ts
// features/leads/dedupe.test.ts
import {describe, it, expect} from "vitest"
import {partitionLeads} from "@/features/leads/dedupe"

describe("partitionLeads", () => {
	const base = {
		organizationName: "X",
		website: null,
		contactPersonName: null,
		contactRole: null,
		phone: null,
		city: null,
		region: null,
		schoolType: null,
		honorific: null,
	}

	it("splits into insert/duplicate/suppressed by email", () => {
		const leads = [
			{...base, email: "a@b.pl"},
			{...base, email: "dup@b.pl"},
			{...base, email: "block@b.pl"},
			{...base, email: "a@b.pl"}, // duplicate within batch
			{...base, email: null}, // no email -> always insert
		]
		const result = partitionLeads(leads, {existingEmails: new Set(["dup@b.pl"]), suppressedEmails: new Set(["block@b.pl"])})
		expect(result.toInsert.map((l) => l.email)).toEqual(["a@b.pl", null])
		expect(result.duplicateCount).toBe(2) // dup@b.pl (existing) + second a@b.pl (in-batch)
		expect(result.suppressedCount).toBe(1)
	})
})
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run features/leads/dedupe.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement dedupe**

```ts
// features/leads/dedupe.ts
import type {LeadImportInput} from "@/features/leads/import"

export interface PartitionResult {
	toInsert: LeadImportInput[]
	duplicateCount: number
	suppressedCount: number
}

export function partitionLeads(
	leads: LeadImportInput[],
	known: {existingEmails: Set<string>; suppressedEmails: Set<string>},
): PartitionResult {
	const seen = new Set<string>()
	const toInsert: LeadImportInput[] = []
	let duplicateCount = 0
	let suppressedCount = 0

	for (const lead of leads) {
		if (lead.email) {
			if (known.suppressedEmails.has(lead.email)) {
				suppressedCount++
				continue
			}
			if (known.existingEmails.has(lead.email) || seen.has(lead.email)) {
				duplicateCount++
				continue
			}
			seen.add(lead.email)
		}
		toInsert.push(lead)
	}

	return {toInsert, duplicateCount, suppressedCount}
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npx vitest run features/leads/dedupe.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement lead actions**

```ts
// features/leads/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {parseTable, mapRowsToLeads, type ColumnMapping} from "@/features/leads/import"
import {partitionLeads} from "@/features/leads/dedupe"

export type LeadActionResult = {ok: true} | {ok: false; error: string}

export type ImportResult =
	| {ok: true; created: number; duplicateCount: number; suppressedCount: number}
	| {ok: false; error: string}

const leadFormSchema = z.object({
	organizationName: z.string().trim().min(1, "Podaj nazwę placówki"),
	email: z.string().trim().toLowerCase().email("Błędny email").optional().or(z.literal("")).transform((v) => (v ? v : null)),
	website: z.string().trim().optional().transform((v) => (v ? v : null)),
	contactPersonName: z.string().trim().optional().transform((v) => (v ? v : null)),
	contactRole: z.string().trim().optional().transform((v) => (v ? v : null)),
	city: z.string().trim().optional().transform((v) => (v ? v : null)),
	offeringLineId: z.string().trim().optional().transform((v) => (v ? v : null)),
})

export async function createLead(_prev: LeadActionResult | null, formData: FormData): Promise<LeadActionResult> {
	const {orgId} = await requireOrg()
	const parsed = leadFormSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędne dane"}

	try {
		await prisma.lead.create({data: {organizationId: orgId, ...parsed.data}})
	} catch {
		return {ok: false, error: "Lead z tym emailem już istnieje"}
	}
	revalidatePath("/leady")
	return {ok: true}
}

export async function deleteLead(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.lead.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/leady")
}

export async function importLeads(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
	const {orgId} = await requireOrg()

	const text = String(formData.get("text") ?? "")
	const hasHeader = formData.get("hasHeader") === "on"
	const offeringLineId = String(formData.get("offeringLineId") ?? "") || null
	if (!text.trim()) return {ok: false, error: "Wklej dane do importu"}

	// Column mapping arrives as mapping_<field>=<columnIndex> ("" = unmapped)
	const fields = [
		"organizationName",
		"website",
		"contactPersonName",
		"contactRole",
		"email",
		"phone",
		"city",
		"region",
		"schoolType",
		"honorific",
	] as const
	const mapping: ColumnMapping = {}
	for (const field of fields) {
		const raw = formData.get(`mapping_${field}`)
		if (raw !== null && raw !== "") mapping[field] = Number(raw)
	}
	if (mapping.organizationName === undefined) {
		return {ok: false, error: "Zmapuj kolumnę z nazwą placówki"}
	}

	const rows = parseTable(text)
	const leads = mapRowsToLeads(rows, mapping, {hasHeader})
	if (leads.length === 0) return {ok: false, error: "Brak wierszy z nazwą placówki"}

	const emails = leads.map((l) => l.email).filter((e): e is string => !!e)
	const [existing, suppressed] = await Promise.all([
		prisma.lead.findMany({where: {organizationId: orgId, email: {in: emails}}, select: {email: true}}),
		prisma.suppression.findMany({where: {organizationId: orgId, email: {in: emails}}, select: {email: true}}),
	])
	const {toInsert, duplicateCount, suppressedCount} = partitionLeads(leads, {
		existingEmails: new Set(existing.map((e) => e.email!).filter(Boolean)),
		suppressedEmails: new Set(suppressed.map((s) => s.email)),
	})

	if (toInsert.length > 0) {
		await prisma.lead.createMany({
			data: toInsert.map((l) => ({...l, organizationId: orgId, offeringLineId})),
		})
	}

	revalidatePath("/leady")
	return {ok: true, created: toInsert.length, duplicateCount, suppressedCount}
}
```

- [ ] **Step 6: Typecheck + commit**

Run `npx tsc --noEmit` (expect no errors), then:

```bash
git add features/leads/actions.ts features/leads/dedupe.ts features/leads/dedupe.test.ts
git commit -m "feat: lead create/delete/import actions with dedupe and suppression filtering"
```

---

## Task 11: Leads table page + filters + create form

**Files:**
- Create: `app/(app)/leady/page.tsx` (replaces the Task 5 placeholder)
- Create: `app/(app)/leady/lead-form.tsx`

- [ ] **Step 1: Create form (client)**

```tsx
// app/(app)/leady/lead-form.tsx
"use client"

import {useActionState} from "react"
import {createLead, type LeadActionResult} from "@/features/leads/actions"

export function LeadForm({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [state, action, pending] = useActionState<LeadActionResult | null, FormData>(createLead, null)

	return (
		<form className="flex flex-wrap items-end gap-2 border-b border-zinc-200 pb-4" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="organizationName" placeholder="Nazwa placówki" required />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="email" placeholder="Email" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="website" placeholder="WWW" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="contactPersonName" placeholder="Osoba" />
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="city" placeholder="Miasto" />
			<select className="rounded border border-zinc-300 px-2 py-1 text-sm" name="offeringLineId" defaultValue="">
				<option value="">— linia usługi —</option>
				{offeringLines.map((l) => (
					<option key={l.id} value={l.id}>
						{l.name}
					</option>
				))}
			</select>
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj lead
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

- [ ] **Step 2: Leads page with search/filter/sort (server component)**

```tsx
// app/(app)/leady/page.tsx
import Link from "next/link"
import type {Prisma} from "@/generated/prisma/client"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {deleteLead} from "@/features/leads/actions"
import {LeadForm} from "./lead-form"

export default async function LeadsPage({searchParams}: {searchParams: Promise<{q?: string; line?: string; sort?: string}>}) {
	const {orgId} = await requireOrg()
	const {q, line, sort} = await searchParams

	const where: Prisma.LeadWhereInput = {organizationId: orgId}
	if (line) where.offeringLineId = line
	if (q) {
		where.OR = [
			{organizationName: {contains: q, mode: "insensitive"}},
			{email: {contains: q, mode: "insensitive"}},
			{contactPersonName: {contains: q, mode: "insensitive"}},
		]
	}

	const orderBy: Prisma.LeadOrderByWithRelationInput =
		sort === "priority" ? {priority: "desc"} : sort === "name" ? {organizationName: "asc"} : {createdAt: "desc"}

	const [leads, offeringLines] = await Promise.all([
		prisma.lead.findMany({where, orderBy, take: 500, include: {offeringLine: {select: {name: true}}}}),
		prisma.offeringLine.findMany({where: {organizationId: orgId}, orderBy: {name: "asc"}, select: {id: true, name: true}}),
	])

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h1 className="text-lg font-semibold">Leady ({leads.length})</h1>
				<Link className="text-sm text-blue-600" href="/leady/import">
					Import
				</Link>
			</div>

			<LeadForm offeringLines={offeringLines} />

			<form className="flex flex-wrap gap-2 text-sm">
				<input className="rounded border border-zinc-300 px-2 py-1" name="q" placeholder="Szukaj..." defaultValue={q ?? ""} />
				<select className="rounded border border-zinc-300 px-2 py-1" name="line" defaultValue={line ?? ""}>
					<option value="">— wszystkie linie —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
				<select className="rounded border border-zinc-300 px-2 py-1" name="sort" defaultValue={sort ?? ""}>
					<option value="">Najnowsze</option>
					<option value="name">Nazwa A-Z</option>
					<option value="priority">Priorytet</option>
				</select>
				<button className="rounded border border-zinc-300 px-3 py-1" type="submit">
					Filtruj
				</button>
			</form>

			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-zinc-300 text-left text-zinc-500">
						<th className="py-1 pr-2">Placówka</th>
						<th className="py-1 pr-2">Email</th>
						<th className="py-1 pr-2">Miasto</th>
						<th className="py-1 pr-2">Linia</th>
						<th className="py-1 pr-2">Etap</th>
						<th className="py-1 pr-2"></th>
					</tr>
				</thead>
				<tbody>
					{leads.map((lead) => (
						<tr className="border-b border-zinc-100" key={lead.id}>
							<td className="py-1 pr-2">{lead.organizationName}</td>
							<td className="py-1 pr-2">{lead.email ?? "—"}</td>
							<td className="py-1 pr-2">{lead.city ?? "—"}</td>
							<td className="py-1 pr-2">{lead.offeringLine?.name ?? "—"}</td>
							<td className="py-1 pr-2">{lead.dealStage}</td>
							<td className="py-1 pr-2 text-right">
								<form action={deleteLead.bind(null, lead.id)}>
									<button className="text-red-600" type="submit">
										Usuń
									</button>
								</form>
							</td>
						</tr>
					))}
					{leads.length === 0 ? (
						<tr>
							<td className="py-2 text-zinc-500" colSpan={6}>
								Brak leadów.
							</td>
						</tr>
					) : null}
				</tbody>
			</table>
		</section>
	)
}
```

- [ ] **Step 3: Verify**

With dev running and logged in: add a lead via the form (appears in the table), search by name/email (filters), change the line/sort selects + Filtruj (list updates via the `?q=&line=&sort=` query), delete a lead (disappears).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/leady/page.tsx" "app/(app)/leady/lead-form.tsx"
git commit -m "feat: leads table with search, filter, sort and inline create"
```

---

## Task 12: Import page (paste, map columns, preview, confirm)

**Files:**
- Create: `app/(app)/leady/import/page.tsx`
- Create: `app/(app)/leady/import/import-wizard.tsx`

- [ ] **Step 1: Import page (server — supplies offering lines)**

```tsx
// app/(app)/leady/import/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {ImportWizard} from "./import-wizard"

export default async function ImportPage() {
	const {orgId} = await requireOrg()
	const offeringLines = await prisma.offeringLine.findMany({
		where: {organizationId: orgId},
		orderBy: {name: "asc"},
		select: {id: true, name: true},
	})
	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Import leadów</h1>
			<ImportWizard offeringLines={offeringLines} />
		</section>
	)
}
```

- [ ] **Step 2: Import wizard (client — paste, parse preview, map, submit)**

```tsx
// app/(app)/leady/import/import-wizard.tsx
"use client"

import {useActionState, useMemo, useState} from "react"
import {parseTable} from "@/features/leads/import"
import {importLeads, type ImportResult} from "@/features/leads/actions"

const FIELDS: {key: string; label: string}[] = [
	{key: "organizationName", label: "Nazwa placówki *"},
	{key: "email", label: "Email"},
	{key: "website", label: "WWW"},
	{key: "contactPersonName", label: "Osoba"},
	{key: "contactRole", label: "Rola"},
	{key: "phone", label: "Telefon"},
	{key: "city", label: "Miasto"},
	{key: "region", label: "Region"},
	{key: "schoolType", label: "Typ szkoły"},
	{key: "honorific", label: "Zwrot (Pan/Pani)"},
]

export function ImportWizard({offeringLines}: {offeringLines: {id: string; name: string}[]}) {
	const [text, setText] = useState("")
	const [hasHeader, setHasHeader] = useState(true)
	const [state, action, pending] = useActionState<ImportResult | null, FormData>(importLeads, null)

	const rows = useMemo(() => (text.trim() ? parseTable(text).slice(0, 5) : []), [text])
	const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0)
	const columnOptions = Array.from({length: columnCount}, (_, i) => i)

	return (
		<form className="flex flex-col gap-4" action={action}>
			<textarea
				className="h-40 rounded border border-zinc-300 p-2 font-mono text-xs"
				name="text"
				placeholder="Wklej CSV/TSV (np. z arkusza). Pierwszy wiersz = nagłówki."
				value={text}
				onChange={(e) => setText(e.target.value)}
			/>
			<label className="flex items-center gap-2 text-sm">
				<input name="hasHeader" type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
				Pierwszy wiersz to nagłówki
			</label>

			{rows.length > 0 ? (
				<div className="overflow-x-auto">
					<table className="border-collapse text-xs">
						<tbody>
							{rows.map((r, ri) => (
								<tr key={ri} className="border-b border-zinc-100">
									{r.map((c, ci) => (
										<td className="border border-zinc-200 px-2 py-1" key={ci}>
											{c}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}

			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{FIELDS.map((field) => (
					<label className="flex flex-col text-xs" key={field.key}>
						{field.label}
						<select className="rounded border border-zinc-300 px-1 py-1" name={`mapping_${field.key}`} defaultValue="">
							<option value="">—</option>
							{columnOptions.map((i) => (
								<option key={i} value={i}>
									Kolumna {i + 1}
								</option>
							))}
						</select>
					</label>
				))}
			</div>

			<label className="flex flex-col text-sm">
				Przypisz do linii usługi
				<select className="w-64 rounded border border-zinc-300 px-2 py-1" name="offeringLineId" defaultValue="">
					<option value="">— brak —</option>
					{offeringLines.map((l) => (
						<option key={l.id} value={l.id}>
							{l.name}
						</option>
					))}
				</select>
			</label>

			<button className="w-40 rounded bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				{pending ? "Importuję..." : "Importuj"}
			</button>

			{state ? (
				state.ok ? (
					<p className="text-sm text-green-700">
						Dodano {state.created}, pominięto duplikaty: {state.duplicateCount}, na suppression: {state.suppressedCount}.
					</p>
				) : (
					<p className="text-sm text-red-600">{state.error}</p>
				)
			) : null}
		</form>
	)
}
```

Note: the live preview reuses the same `parseTable` from the tested core, so the columns the user maps match exactly what the server will parse.

- [ ] **Step 3: Verify**

With dev running and logged in, go to `/leady/import`. Paste a few rows (header + data), confirm the preview table renders, map "Kolumna N" to fields (at least Nazwa placówki), pick a line, Import. Confirm the success summary and that the leads appear on `/leady`. Re-import the same data -> all counted as duplicates.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/leady/import"
git commit -m "feat: lead import wizard with paste preview and column mapping"
```

---

## Task 13: Suppression list

**Files:**
- Create: `features/suppression/actions.ts`
- Create: `app/(app)/suppression/page.tsx`
- Create: `app/(app)/suppression/suppression-form.tsx`

- [ ] **Step 1: Actions**

```ts
// features/suppression/actions.ts
"use server"

import {revalidatePath} from "next/cache"
import {z} from "zod"
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"

export type SuppressionResult = {ok: true} | {ok: false; error: string}

const emailSchema = z.string().trim().toLowerCase().email("Błędny email")

export async function addSuppression(_prev: SuppressionResult | null, formData: FormData): Promise<SuppressionResult> {
	const {orgId} = await requireOrg()
	const parsed = emailSchema.safeParse(formData.get("email"))
	if (!parsed.success) return {ok: false, error: parsed.error.issues[0]?.message ?? "Błędny email"}

	await prisma.suppression.upsert({
		where: {organizationId_email: {organizationId: orgId, email: parsed.data}},
		update: {},
		create: {organizationId: orgId, email: parsed.data, reason: "MANUAL"},
	})
	revalidatePath("/suppression")
	return {ok: true}
}

export async function removeSuppression(id: string): Promise<void> {
	const {orgId} = await requireOrg()
	await prisma.suppression.deleteMany({where: {id, organizationId: orgId}})
	revalidatePath("/suppression")
}
```

- [ ] **Step 2: Form (client)**

```tsx
// app/(app)/suppression/suppression-form.tsx
"use client"

import {useActionState} from "react"
import {addSuppression, type SuppressionResult} from "@/features/suppression/actions"

export function SuppressionForm() {
	const [state, action, pending] = useActionState<SuppressionResult | null, FormData>(addSuppression, null)
	return (
		<form className="flex items-end gap-2" action={action}>
			<input className="rounded border border-zinc-300 px-2 py-1 text-sm" name="email" placeholder="email@do-zablokowania.pl" required />
			<button className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50" type="submit" disabled={pending}>
				Dodaj do suppression
			</button>
			{state && !state.ok ? <span className="text-sm text-red-600">{state.error}</span> : null}
		</form>
	)
}
```

- [ ] **Step 3: Page**

```tsx
// app/(app)/suppression/page.tsx
import {prisma} from "@/lib/prisma"
import {requireOrg} from "@/lib/org"
import {removeSuppression} from "@/features/suppression/actions"
import {SuppressionForm} from "./suppression-form"

export default async function SuppressionPage() {
	const {orgId} = await requireOrg()
	const entries = await prisma.suppression.findMany({where: {organizationId: orgId}, orderBy: {createdAt: "desc"}})

	return (
		<section className="flex flex-col gap-4">
			<h1 className="text-lg font-semibold">Suppression ({entries.length})</h1>
			<p className="text-sm text-zinc-600">Adresy z tej listy są pomijane przy imporcie i (później) przy wysyłce.</p>
			<SuppressionForm />
			<ul className="divide-y divide-zinc-200 border-y border-zinc-200">
				{entries.map((e) => (
					<li className="flex items-center justify-between py-2 text-sm" key={e.id}>
						<span>
							{e.email} <span className="text-zinc-400">({e.reason})</span>
						</span>
						<form action={removeSuppression.bind(null, e.id)}>
							<button className="text-blue-600" type="submit">
								Usuń
							</button>
						</form>
					</li>
				))}
				{entries.length === 0 ? <li className="py-2 text-sm text-zinc-500">Lista pusta.</li> : null}
			</ul>
		</section>
	)
}
```

- [ ] **Step 4: Verify (incl. integration with import)**

With dev running and logged in: add an email to `/suppression`. Then go to `/leady/import` and import a batch that includes that email -> the success summary reports it under "na suppression" and it is NOT created on `/leady`. Remove it from suppression.

- [ ] **Step 5: Run the whole test suite + typecheck**

Run: `npx vitest run` (expect all suites pass) and `npx tsc --noEmit` (expect no errors).

- [ ] **Step 6: Commit**

```bash
git add features/suppression "app/(app)/suppression"
git commit -m "feat: suppression list with import integration"
```

---

## Definition of done (Phase 0 + 1)

- Invited members log in with Google; non-allowlisted emails are rejected; a `User` + `Membership` (role `OWNER` for `OWNER_EMAIL`) exist.
- All data is scoped by `organizationId`; helpers `requireOrg` enforce it in every action/page.
- Offering lines: create / list / delete.
- Leads: manual create / delete; filterable, searchable, sortable table.
- Import: paste CSV/TSV, preview, map columns, assign to a line, with in-batch + existing dedupe by email and suppression filtering; summary of created/duplicate/suppressed.
- Suppression list: add / remove, honored by import.
- Inngest is wired (hello function discoverable + runnable) for later phases.
- `npx vitest run` and `npx tsc --noEmit` are green.

## Not in scope (later phases, per the design doc)

Email sending, sequences/followups, reply detection, AI research/enrichment, templates + placeholders, the sales-pipeline kanban, dashboards/analytics, and the full visual design pass.
