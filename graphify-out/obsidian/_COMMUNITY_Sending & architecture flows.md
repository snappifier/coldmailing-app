---
type: community
cohesion: 0.10
members: 30
---

# Sending & architecture flows

**Cohesion:** 0.10 - loosely connected
**Members:** 30 nodes

## Members
- [[AI research fan-out (Inngest one job per lead - Anthropic web)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Anthropic SDK (AI research, web tools, prompt caching)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Campaign (cold-mail action, status DRAFTACTIVEPAUSEDDONE)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[CampaignLead (membership + per-campaign send state)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[EmailAccount (connected sending mailbox, encrypted tokens)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[EmailEvent (opensclicksbounces log)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Gmail API send + Message log]] - rationale - docs/superpowers/ROADMAP.md
- [[Inngest as durable scheduling engine]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Inngest sending engine (throttlewindowrandomized gaps)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Inngest v4 (durable background jobs)]] - rationale - docs/superpowers/ROADMAP.md
- [[Lead (prospect, org-global, honorificcustomFieldsdealStage)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Message (outboundinbound email, gmail ids, status)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[OfferingLine (what you sell)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[OfferingLine - Campaign - Leads + sales pipeline layering]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Phase 2 — AI research (PARKED on prompts)]] - rationale - docs/superpowers/ROADMAP.md
- [[Phase 4 — Mailbox + sending (NEXT)]] - rationale - docs/superpowers/ROADMAP.md
- [[Phase 5 — Sequences + replies]] - rationale - docs/superpowers/ROADMAP.md
- [[Phase 6 — Sales pipeline (kanban)]] - rationale - docs/superpowers/ROADMAP.md
- [[Pipeline kanban by dealStage + activity timeline]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Reply detection (Gmail watchpoll - stop-on-reply)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[ReplyDetector module interface]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[ResearchRun (BATCHSINGLE enrichment job)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Researcher module interface]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Send from user's own GmailWorkspace mailbox (not ESP)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Sender module interface]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Sequence builder + lead assignment (Phase 3 timeline only)]] - rationale - docs/superpowers/specs/2026-05-31-phase-3-templates-placeholders-campaigns-design.md
- [[SequenceStep (template + delayDays + condition)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Split send status on CampaignLead, deal stage on Lead]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Swappable module interfaces (SenderReplyDetectorResearcherTemplateRenderer)]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md
- [[Vercel hosting assumption]] - rationale - docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Sending__architecture_flows
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_Decisions & cross-cutting]]
- 4 edges to [[_COMMUNITY_Placeholder & import mechanics]]

## Top bridge nodes
- [[Lead (prospect, org-global, honorificcustomFieldsdealStage)]] - degree 9, connects to 2 communities
- [[Phase 4 — Mailbox + sending (NEXT)]] - degree 6, connects to 1 community
- [[Inngest sending engine (throttlewindowrandomized gaps)]] - degree 5, connects to 1 community
- [[Campaign (cold-mail action, status DRAFTACTIVEPAUSEDDONE)]] - degree 5, connects to 1 community
- [[Swappable module interfaces (SenderReplyDetectorResearcherTemplateRenderer)]] - degree 4, connects to 1 community