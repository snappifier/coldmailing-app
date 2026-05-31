---
source_file: "docs/superpowers/specs/2026-05-30-coldmailing-tool-design.md"
type: "rationale"
community: "Sending & architecture flows"
tags:
  - graphify/rationale
  - graphify/EXTRACTED
  - community/Sending__architecture_flows
---

# CampaignLead (membership + per-campaign send state)

## Connections
- [[Campaign (cold-mail action, status DRAFTACTIVEPAUSEDDONE)]] - `conceptually_related_to` [EXTRACTED]
- [[Lead (prospect, org-global, honorificcustomFieldsdealStage)]] - `conceptually_related_to` [EXTRACTED]
- [[Message (outboundinbound email, gmail ids, status)]] - `conceptually_related_to` [EXTRACTED]
- [[Reply detection (Gmail watchpoll - stop-on-reply)]] - `conceptually_related_to` [EXTRACTED]
- [[Sequence builder + lead assignment (Phase 3 timeline only)]] - `conceptually_related_to` [EXTRACTED]
- [[Split send status on CampaignLead, deal stage on Lead]] - `rationale_for` [EXTRACTED]

#graphify/rationale #graphify/EXTRACTED #community/Sending__architecture_flows