---
type: community
cohesion: 0.14
members: 21
---

# Placeholder & import mechanics

**Cohesion:** 0.14 - loosely connected
**Members:** 21 nodes

## Members
- [[Built-in placeholders (nazwaPlacowkiosobazwrotpodpisNadawcy...)]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[CSVpaste import (parse + column map)]] - rationale - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Custom placeholder resolution from lead.customFields + fallback]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Field normalization (emailwebsitehonorific)]] - rationale - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Gendered Polish token {{mascfem}} resolved by honorific]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Honorific (PANPANI) drives zwrot + gendered forms]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Lead dedupe (in-batch + existing by email)]] - rationale - docs/superpowers/plans/2026-05-30-phase-0-1-foundation-leads.md
- [[Lead edit form (honorific + keyvalue customFields)]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Live preview against a sample lead]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Missing-token collection + pre-send validation]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Per-lead placeholder resolution at mass send]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Phase 3 Design spec (templatesplaceholderscampaigns)]] - document - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Phase 3 Implementation Plan]] - document - docs/superpowers/plans/2026-05-31-phase-3-templates-placeholders-campaigns.md
- [[Phase 3 — Templates + Placeholders + Campaigns (DONE)]] - rationale - docs/superpowers/ROADMAP.md
- [[Placeholder (org-scoped custom variable, TEXTCHOICE)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Placeholder palette (buttons insert token at cursor)]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Pure, unit-tested logic in features (framework-free)]] - rationale - docs/superpowers/ROADMAP.md
- [[Reserved-key guard for custom placeholders]] - rationale - docs/superpowers/ROADMAP.md
- [[TDD for pure cores (renderTemplate, import, dedupe)]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[Template (shared team library, {{tokens}})]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[renderTemplate pure renderer]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Placeholder__import_mechanics
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_Decisions & cross-cutting]]
- 4 edges to [[_COMMUNITY_Sending & architecture flows]]

## Top bridge nodes
- [[Phase 3 — Templates + Placeholders + Campaigns (DONE)]] - degree 8, connects to 2 communities
- [[renderTemplate pure renderer]] - degree 12, connects to 1 community
- [[CSVpaste import (parse + column map)]] - degree 4, connects to 1 community
- [[Phase 3 Design spec (templatesplaceholderscampaigns)]] - degree 4, connects to 1 community
- [[Lead edit form (honorific + keyvalue customFields)]] - degree 3, connects to 1 community