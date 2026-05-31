---
type: community
cohesion: 0.08
members: 40
---

# Decisions & cross-cutting

**Cohesion:** 0.08 - loosely connected
**Members:** 40 nodes

## Members
- [[AGENTS.md (agent rules + knowledge persistence)]] - document - AGENTS.md
- [[Auth.js v5 (Google OAuth + Prisma adapter, JWT)]] - rationale - docs/superpowers/ROADMAP.md
- [[CLAUDE.md (project state pointer)]] - document - CLAUDE.md
- [[Code conventions (tabs, no semicolons, path comment, className first, no emoji)]] - rationale - docs/superpowers/ROADMAP.md
- [[Cold Mailing Tool (product)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Cold Mailing Tool Design v1 (spec)]] - document - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Deliverability (SPFDKIMDMARC, warmup, send window)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Email allowlist + org membership gate]] - rationale - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Eventual SaaS ambition (internal-first)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[GDPRRODO (sender identity, opt-out, suppression, B2B basis)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Git work on master, Claude may commit, USER pushes (never git push)]] - rationale - docs/superpowers/ROADMAP.md
- [[Mechanics-first build philosophy]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Membership (user-org role OWNERADMINMEMBER)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Multi-tenant-ready, org-scoped data model]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Next.js 16 (App Router)]] - rationale - docs/superpowers/ROADMAP.md
- [[Next.js version has breaking changes vs training data]] - rationale - AGENTS.md
- [[No emoji anywhere (incl. commit messages)]] - rationale - docs/superpowers/ROADMAP.md
- [[Organization (tenant)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Persist knowledge to graphify + Obsidian vault]] - rationale - AGENTS.md
- [[Phase 0 — Foundation (DONE)]] - rationale - docs/superpowers/ROADMAP.md
- [[Phase 0+1 Implementation Plan]] - document - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Phase 1 — Leads + structure (DONE)]] - rationale - docs/superpowers/ROADMAP.md
- [[Phase 7 — Visual design  polish]] - rationale - docs/superpowers/ROADMAP.md
- [[Prisma 7.8 + @prismaadapter-pg on Neon Postgres]] - rationale - docs/superpowers/ROADMAP.md
- [[ROADMAP.md (state & roadmap)]] - document - docs/superpowers/ROADMAP.md
- [[React 19 (useActionState, ref-as-prop)]] - rationale - docs/superpowers/ROADMAP.md
- [[Security (OAuth tokens encrypted, minimal Gmail scopes, allowlist)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Suppression (global do-not-contact list)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Suppression filtering on import (and later send)]] - rationale - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Tailwind CSS v4 (minimal styling in v1)]] - rationale - docs/superpowers/ROADMAP.md
- [[Tracking policy (reply ON, open OFF, click optional)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[TypeScript 6]] - rationale - docs/superpowers/ROADMAP.md
- [[USER runs dev server; coordinate build (OFF) vs live verify (ON)]] - rationale - docs/superpowers/ROADMAP.md
- [[User (team member via Google OAuth)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Verify current library versionsbest practices in docs]] - rationale - AGENTS.md
- [[Vitest 4 (unit testing)]] - rationale - docs/superpowers/ROADMAP.md
- [[Web-agency cold outreach to schoolsinstitutions]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Zod 4 (validation)]] - rationale - docs/superpowers/ROADMAP.md
- [[Zod 4 idioms (z.email() not z.string().email())]] - rationale - docs/superpowers/ROADMAP.md
- [[requireOrg() org-scoping helper]] - rationale - docs/superpowers/ROADMAP.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Decisions__cross-cutting
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_Sending & architecture flows]]
- 4 edges to [[_COMMUNITY_Placeholder & import mechanics]]

## Top bridge nodes
- [[ROADMAP.md (state & roadmap)]] - degree 22, connects to 2 communities
- [[Cold Mailing Tool Design v1 (spec)]] - degree 10, connects to 2 communities
- [[Phase 1 — Leads + structure (DONE)]] - degree 7, connects to 2 communities
- [[Deliverability (SPFDKIMDMARC, warmup, send window)]] - degree 4, connects to 1 community
- [[Security (OAuth tokens encrypted, minimal Gmail scopes, allowlist)]] - degree 3, connects to 1 community