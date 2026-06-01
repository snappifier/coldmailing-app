# Graph Report - coldmailing-app  (2026-06-01)

## Corpus Check
- 132 files · ~168,509 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2908 nodes · 3262 edges · 91 communities (84 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0839dc59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]

## God Nodes (most connected - your core abstractions)
1. `requireOrg()` - 52 edges
2. `ROADMAP.md (state & roadmap)` - 22 edges
3. `Phase 4: Mailbox + Sending Implementation Plan` - 17 edges
4. `compilerOptions` - 16 edges
5. `Cold Mailing Tool — Phase 5b: Followups / multi-step sequences (Design)` - 14 edges
6. `Cold Mailing Tool — Phase 4: Mailbox + Sending (Design)` - 13 edges
7. `Cold Mailing Tool — Phase 5a: Reply detection + stop-on-reply (Design)` - 13 edges
8. `Phase 5a: Reply detection + stop-on-reply Implementation Plan` - 12 edges
9. `Cold Mailing Tool — Design (v1)` - 12 edges
10. `renderTemplate pure renderer` - 12 edges

## Surprising Connections (you probably didn't know these)
- `CampaignsPage()` --calls--> `requireOrg()`  [EXTRACTED]
  app/(app)/kampanie/page.tsx → lib/org.ts
- `LeadsPage()` --calls--> `requireOrg()`  [EXTRACTED]
  app/(app)/leady/page.tsx → lib/org.ts
- `LeadEditPage()` --calls--> `requireOrg()`  [EXTRACTED]
  app/(app)/leady/[id]/page.tsx → lib/org.ts
- `PlaceholdersPage()` --calls--> `requireOrg()`  [EXTRACTED]
  app/(app)/placeholdery/page.tsx → lib/org.ts
- `TemplatesPage()` --calls--> `requireOrg()`  [EXTRACTED]
  app/(app)/szablony/page.tsx → lib/org.ts

## Hyperedges (group relationships)
- **All roadmap phases (0-7)** — phase_0_foundation, phase_1_leads, phase_2_research_ai, phase_3_templates, phase_4_mailbox_sending, phase_5_sequences_replies, phase_6_pipeline, phase_7_visual_design [INFERRED 0.85]
- **Sending pipeline participants** — model_email_account, model_campaign_lead, flow_sending_engine, flow_gmail_send, model_message [INFERRED 0.85]
- **Placeholder-resolution participants** — concept_render_template, concept_builtin_placeholders, concept_custom_placeholder_resolution, concept_gendered_token, concept_honorific [INFERRED 0.85]

## Communities (91 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (15): ImportWizard(), ImportPage(), OrgContext, requireOrg(), OfferingLineForm(), OfferingLinesPage(), ActionResult, createOfferingLine() (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (20): Code conventions (tabs, no semicolons, path comment, className first, no emoji), No emoji anywhere (incl. commit messages), Zod 4 idioms (z.email() not z.string().email()), Mechanics-first build philosophy, Next.js version has breaking changes vs training data, Verify current library versions/best practices in docs, AGENTS.md (agent rules + knowledge persistence), CLAUDE.md (project state pointer) (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (20): FIELDS, importLeads(), partitionLeads(), PartitionResult, base, leads, result, cell() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (10): Split: send status on CampaignLead, deal stage on Lead, OfferingLine -> Campaign -> Leads + sales pipeline layering, Pipeline kanban by dealStage + activity timeline, Campaign (cold-mail action, status DRAFT/ACTIVE/PAUSED/DONE), CampaignLead (membership + per-campaign send state), Lead (prospect, org-global, honorific/customFields/dealStage), OfferingLine (what you sell), ResearchRun (BATCH/SINGLE enrichment job) (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (43): dependencies, @auth/prisma-adapter, clsx, googleapis, inngest, next, next-auth, pg (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (19): TemplatesPage(), BUILTIN, Props, TemplateEditor(), createTemplate(), deleteTemplate(), TemplateResult, BUILTIN_KEYS (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (21): Built-in placeholders (nazwaPlacowki/osoba/zwrot/podpisNadawcy...), Custom placeholder resolution from lead.customFields + fallback, Lead dedupe (in-batch + existing by email), Gendered Polish token {{masc|fem}} resolved by honorific, Honorific (PAN/PANI) drives zwrot + gendered forms, Lead edit form (honorific + key/value customFields), Live preview against a sample lead, Missing-token collection + pre-send validation (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (15): addSequenceStep(), assertCampaignInOrg(), assignLeads(), CampaignResult, createCampaign(), deleteCampaign(), deleteSequenceStep(), StepResult (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.01
Nodes (162): AggregateOrganization, DateTimeFieldUpdateOperationsInput, GetOrganizationAggregateType, GetOrganizationGroupByPayload, Organization$campaignsArgs, Organization$emailAccountsArgs, Organization$leadsArgs, Organization$membershipsArgs (+154 more)

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (4): OfferingLineInput, offeringLineSchema, parsed, result

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (19): isSendDay(), isWithinWindow(), localDayKey(), LocalParts, nextWindowOpen(), PacingAccount, PlanInput, PlannedSend (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (9): createPlaceholder(), deletePlaceholder(), PlaceholderResult, PlaceholderInput, placeholderSchema, RESERVED_KEYS, p, PlaceholdersPage() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (33): Account, Campaign, CampaignLead, EmailAccount, Lead, Membership, Message, OfferingLine (+25 more)

### Community 15 - "Community 15"
Cohesion: 0.01
Nodes (151): AggregateCampaign, Campaign$campaignLeadsArgs, Campaign$createdByArgs, Campaign$offeringLineArgs, Campaign$sendingEmailAccountArgs, Campaign$stepsArgs, CampaignAggregateArgs, CampaignCountAggregateInputType (+143 more)

### Community 24 - "Community 24"
Cohesion: 0.01
Nodes (145): AccountScalarFieldEnum, Args, At, AtLeast, AtLoose, AtStrict, BatchPayload, BooleanFieldRefInput (+137 more)

### Community 25 - "Community 25"
Cohesion: 0.01
Nodes (141): AggregateUser, GetUserAggregateType, GetUserGroupByPayload, NullableDateTimeFieldUpdateOperationsInput, NullableStringFieldUpdateOperationsInput, Prisma__UserClient, User$accountsArgs, User$campaignsArgs (+133 more)

### Community 26 - "Community 26"
Cohesion: 0.02
Nodes (131): AggregateLead, EnumDealStageFieldUpdateOperationsInput, GetLeadAggregateType, GetLeadGroupByPayload, Lead$campaignLeadsArgs, Lead$offeringLineArgs, Lead$ownerArgs, LeadAggregateArgs (+123 more)

### Community 27 - "Community 27"
Cohesion: 0.02
Nodes (124): AggregateTemplate, BoolFieldUpdateOperationsInput, EnumTemplateVisibilityFieldUpdateOperationsInput, GetTemplateAggregateType, GetTemplateGroupByPayload, Prisma__TemplateClient, Template$createdByArgs, Template$offeringLineArgs (+116 more)

### Community 28 - "Community 28"
Cohesion: 0.02
Nodes (113): AggregateCampaignLead, CampaignLead$messagesArgs, CampaignLeadAggregateArgs, CampaignLeadAvgAggregateInputType, CampaignLeadAvgAggregateOutputType, CampaignLeadAvgOrderByAggregateInput, CampaignLeadCampaignIdLeadIdCompoundUniqueInput, CampaignLeadCountAggregateInputType (+105 more)

### Community 29 - "Community 29"
Cohesion: 0.02
Nodes (113): AggregateOfferingLine, GetOfferingLineAggregateType, GetOfferingLineGroupByPayload, OfferingLine$campaignsArgs, OfferingLine$leadsArgs, OfferingLine$templatesArgs, OfferingLineAggregateArgs, OfferingLineCountAggregateInputType (+105 more)

### Community 30 - "Community 30"
Cohesion: 0.02
Nodes (111): AggregateEmailAccount, EmailAccount$campaignsArgs, EmailAccount$messagesArgs, EmailAccountAggregateArgs, EmailAccountAvgAggregateInputType, EmailAccountAvgAggregateOutputType, EmailAccountAvgOrderByAggregateInput, EmailAccountCountAggregateInputType (+103 more)

### Community 31 - "Community 31"
Cohesion: 0.02
Nodes (107): AggregateMessage, EnumMessageDirectionFieldUpdateOperationsInput, EnumMessageStatusFieldUpdateOperationsInput, GetMessageAggregateType, GetMessageGroupByPayload, MessageAggregateArgs, MessageCountAggregateInputType, MessageCountAggregateOutputType (+99 more)

### Community 32 - "Community 32"
Cohesion: 0.02
Nodes (99): AggregateSequenceStep, EnumSequenceConditionFieldUpdateOperationsInput, GetSequenceStepAggregateType, GetSequenceStepGroupByPayload, IntFieldUpdateOperationsInput, Prisma__SequenceStepClient, SequenceStepAggregateArgs, SequenceStepAvgAggregateInputType (+91 more)

### Community 33 - "Community 33"
Cohesion: 0.02
Nodes (93): AggregatePlaceholder, EnumPlaceholderTypeFieldUpdateOperationsInput, GetPlaceholderAggregateType, GetPlaceholderGroupByPayload, Placeholder$createdByArgs, PlaceholderAggregateArgs, PlaceholderCountAggregateInputType, PlaceholderCountAggregateOutputType (+85 more)

### Community 34 - "Community 34"
Cohesion: 0.02
Nodes (92): AggregateMembership, EnumRoleFieldUpdateOperationsInput, GetMembershipAggregateType, GetMembershipGroupByPayload, MembershipAggregateArgs, MembershipCountAggregateInputType, MembershipCountAggregateOutputType, MembershipCountArgs (+84 more)

### Community 35 - "Community 35"
Cohesion: 0.02
Nodes (89): BoolFilter, BoolWithAggregatesFilter, DateTimeFilter, DateTimeNullableFilter, DateTimeNullableWithAggregatesFilter, DateTimeWithAggregatesFilter, EnumCampaignLeadStatusFilter, EnumCampaignLeadStatusWithAggregatesFilter (+81 more)

### Community 36 - "Community 36"
Cohesion: 0.02
Nodes (83): AccountAggregateArgs, AccountAvgAggregateInputType, AccountAvgAggregateOutputType, AccountAvgOrderByAggregateInput, AccountCountAggregateInputType, AccountCountAggregateOutputType, AccountCountArgs, AccountCountOrderByAggregateInput (+75 more)

### Community 37 - "Community 37"
Cohesion: 0.03
Nodes (77): AggregateSuppression, EnumSuppressionReasonFieldUpdateOperationsInput, GetSuppressionAggregateType, GetSuppressionGroupByPayload, Prisma__SuppressionClient, SuppressionAggregateArgs, SuppressionCountAggregateInputType, SuppressionCountAggregateOutputType (+69 more)

### Community 38 - "Community 38"
Cohesion: 0.03
Nodes (75): AggregateSession, GetSessionAggregateType, GetSessionGroupByPayload, Prisma__SessionClient, SessionAggregateArgs, SessionCountAggregateInputType, SessionCountAggregateOutputType, SessionCountArgs (+67 more)

### Community 39 - "Community 39"
Cohesion: 0.04
Nodes (55): AggregateVerificationToken, GetVerificationTokenAggregateType, GetVerificationTokenGroupByPayload, Prisma__VerificationTokenClient, VerificationTokenAggregateArgs, VerificationTokenCountAggregateInputType, VerificationTokenCountAggregateOutputType, VerificationTokenCountArgs (+47 more)

### Community 40 - "Community 40"
Cohesion: 0.04
Nodes (45): code:prisma (enum TemplateVisibility {), code:bash (git add features/templates/render.ts features/templates/rend), code:ts (// features/placeholders/schema.test.ts), code:ts (// features/placeholders/schema.ts), code:ts (// features/placeholders/actions.ts), code:tsx (// app/(app)/placeholdery/placeholder-form.tsx), code:tsx (// app/(app)/placeholdery/page.tsx), code:bash (git add features/placeholders "app/(app)/placeholdery") (+37 more)

### Community 41 - "Community 41"
Cohesion: 0.05
Nodes (40): AccountScalarFieldEnum, CampaignLeadScalarFieldEnum, CampaignScalarFieldEnum, EmailAccountScalarFieldEnum, JsonNullValueFilter, LeadScalarFieldEnum, MembershipScalarFieldEnum, MessageScalarFieldEnum (+32 more)

### Community 42 - "Community 42"
Cohesion: 0.07
Nodes (38): GET(), GET(), buildConsentUrl(), client(), exchangeCodeToMailbox(), ExchangedMailbox, hmac(), signState() (+30 more)

### Community 43 - "Community 43"
Cohesion: 0.08
Nodes (24): 10. First milestone: Phase 0 + Phase 1, 11. Open questions / deferred, 1. Purpose, 2. Build philosophy: mechanics-first, 3. Decisions locked (from brainstorm), 4. Tech stack, 5. Domain model, 6. Architecture & key flows (+16 more)

### Community 44 - "Community 44"
Cohesion: 0.11
Nodes (18): 10. New / changed files (proposed), 11. Verification gates (read official docs before coding — standing rule), 12. Out of scope (explicit), 1. Purpose & scope, 2. Decisions locked (from brainstorm), 3. Schema changes (`prisma/schema.prisma`), 4. Mailbox connect (OAuth, dedicated flow), 5. Sending one email (+10 more)

### Community 45 - "Community 45"
Cohesion: 0.18
Nodes (12): LeadEditForm(), Props, LeadEditPage(), createLead(), deleteLead(), ImportResult, LeadActionResult, leadFormSchema (+4 more)

### Community 46 - "Community 46"
Cohesion: 0.13
Nodes (14): 1. Purpose & scope, 2. Data model additions (new Prisma migration), 3. Placeholder system, 4. Modules / boundaries, 5. Templates / campaigns UI behavior, 6. Testing, 7. Out of scope (Phase 4-5+), 8. Open questions / deferred (+6 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (16): Cold Mailing Tool — State & Roadmap, Cross-cutting before launch, How to resume, Local dev gotchas (this machine), Next steps (detailed), Phase 2 — Research AI (when prompts exist), Phase 4 — Mailbox + sending (CODE COMPLETE — live e2e pending), Phase 4 — Mailbox + sending (DONE + verified) (+8 more)

### Community 48 - "Community 48"
Cohesion: 0.26
Nodes (12): Eventual SaaS ambition (internal-first), Security (OAuth tokens encrypted, minimal Gmail scopes, allowlist), Email allowlist + org membership gate, requireOrg() org-scoping helper, Multi-tenant-ready, org-scoped data model, Web-agency cold outreach to schools/institutions, Membership (user-org role OWNER/ADMIN/MEMBER), Organization (tenant) (+4 more)

### Community 49 - "Community 49"
Cohesion: 0.14
Nodes (9): disconnectEmailAccount(), listEmailAccounts(), CampaignDetailPage(), SequenceAndLeads(), {handlers, signIn, signOut, auth}, ensureMembership(), isEmailAllowed(), globalForPrisma (+1 more)

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (11): Inngest as durable scheduling engine, Send from user's own Gmail/Workspace mailbox (not ESP), Gmail API send + Message log, Inngest sending engine (throttle/window/randomized gaps), Vercel hosting assumption, EmailAccount (connected sending mailbox, encrypted tokens), EmailEvent (opens/clicks/bounces log), Message (outbound/inbound email, gmail ids, status) (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.24
Nodes (10): Deliverability (SPF/DKIM/DMARC, warmup, send window), Tracking policy (reply ON, open OFF, click optional), Swappable module interfaces (Sender/ReplyDetector/Researcher/TemplateRenderer), Cold Mailing Tool Design v1 (spec), Reply detection (Gmail watch/poll -> stop-on-reply), AI research fan-out (Inngest one job per lead -> Anthropic web), ReplyDetector module interface, Researcher module interface (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.20
Nodes (9): code:ts (// lib/prisma.ts), code:ts (// lib/cn.ts), code:bash (git add lib/prisma.ts lib/cn.ts), Conventions (match the salon project — apply to every file), Git note, Phase 0 + 1: Foundation + Leads — Implementation Plan, Phase 0 — Foundation, Prerequisites (one-time, done by the user — list them, then proceed) (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.14
Nodes (14): code:ts (// lib/org.ts), code:bash (git add lib/org.ts), code:ts (// features/leads/import.test.ts), code:ts (// features/leads/import.ts), code:bash (git add features/leads/import.ts features/leads/import.test.), code:tsx (// app/(app)/leady/import/page.tsx), code:tsx (// app/(app)/leady/import/import-wizard.tsx), code:bash (git add "app/(app)/leady/import") (+6 more)

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (8): code:block1 (prisma/schema.prisma                              # MODIFY: ), code:bash (npx tsc --noEmit), code:bash (git add docs/superpowers/ROADMAP.md graphify-out), File structure, Phase 4: Mailbox + Sending Implementation Plan, Self-review, Task 12: Full verification + manual end-to-end, Verified facts (checked against installed packages / official docs on 2026-05-31)

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (9): code:prisma (lastError String?), code:bash (npx prisma migrate dev --name phase4_mailbox_sending), code:bash (git add prisma/schema.prisma prisma/migrations), code:prisma (enum EmailProvider {), code:prisma (enum CampaignLeadStatus {), code:prisma (model EmailAccount {), code:prisma (emailAccounts EmailAccount[]), code:prisma (sendingEmailAccountId String?) (+1 more)

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (8): code:tsx (// app/layout.tsx), code:css (@import "tailwindcss";), code:tsx (// app/logowanie/page.tsx), code:tsx (// app/(app)/layout.tsx), code:tsx (// app/(app)/leady/page.tsx), code:tsx (// app/page.tsx), code:bash (git add app/layout.tsx app/globals.css app/logowanie app/pag), Task 5: App shell — login page, protected layout, home redirect

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (8): code:ts (// vitest.config.ts), code:ts (// features/offering-lines/schema.test.ts), code:ts (// features/offering-lines/schema.ts), code:ts (// features/offering-lines/actions.ts), code:tsx (// app/(app)/linie/offering-line-form.tsx), code:tsx (// app/(app)/linie/page.tsx), code:bash (git add features/offering-lines vitest.config.ts "app/(app)/), Task 8: Offering lines (validation, actions, page)

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (7): GDPR/RODO (sender identity, opt-out, suppression, B2B basis), CSV/paste import (parse + column map), Field normalization (email/website/honorific), Suppression filtering on import (and later send), Phase 0+1 Implementation Plan, Suppression (global do-not-contact list), Phase 1 — Leads + structure (DONE)

### Community 59 - "Community 59"
Cohesion: 0.29
Nodes (6): account, OAuth2, on, SendArg, sendMock, setCredentials

### Community 60 - "Community 60"
Cohesion: 0.29
Nodes (4): config, LogOptions, PrismaClient, PrismaClientConstructor

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (7): code:bash (npm install @prisma/client@^7.8.0 @prisma/adapter-pg@^7.8.0 ), code:json ("scripts": {), code:ts (// prisma.config.ts), code:block4 (DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=req), code:block5 (# prisma generated client), code:bash (git add package.json package-lock.json prisma.config.ts .env), Task 1: Dependencies, scripts, env, Prisma config

### Community 62 - "Community 62"
Cohesion: 0.06
Nodes (35): code:block1 (prisma/schema.prisma                       # MODIFY: EmailAc), code:ts (// features/replies/match.ts), code:bash (git add features/replies/match.ts features/replies/match.tes), code:ts (// features/replies/gmail-history.test.ts), code:ts (// features/replies/gmail-history.ts), code:bash (git add features/replies/gmail-history.ts features/replies/g), code:ts (// features/replies/queries.ts), code:bash (git add features/replies/queries.ts) (+27 more)

### Community 63 - "Community 63"
Cohesion: 0.33
Nodes (6): code:bash (npm run db:seed), code:bash (git add prisma/schema.prisma prisma/seed.ts prisma/migration), code:prisma (// prisma/schema.prisma), code:ts (// prisma/seed.ts), code:bash (npx prisma migrate dev --name init), Task 2: Prisma schema (Phase 0+1 subset) + migrate

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (6): code:ts (// lib/auth-helpers.ts), code:ts (// lib/auth.ts), code:ts (// app/api/auth/[...nextauth]/route.ts), code:ts (// types/next-auth.d.ts), code:bash (git add lib/auth-helpers.ts lib/auth.ts app/api/auth types/n), Task 4: Auth.js v5 (Google + allowlist + org membership)

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (6): code:ts (// lib/inngest/client.ts), code:ts (// lib/inngest/functions.ts), code:ts (// app/api/inngest/route.ts), code:bash (npx inngest-cli@latest dev -u http://localhost:3000/api/inng), code:bash (git add lib/inngest app/api/inngest), Task 6: Inngest wired (hello function)

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (6): code:ts (// features/email-accounts/google-oauth.test.ts), code:ts (// features/email-accounts/google-oauth.ts), code:ts (// features/email-accounts/queries.ts), code:ts ("use server"), code:bash (git add features/email-accounts), Task 7: `features/email-accounts/*` — OAuth helpers, queries, actions

### Community 67 - "Community 67"
Cohesion: 0.40
Nodes (4): code:bash (npm run dev), Deploy on Vercel, Getting Started, Learn More

### Community 68 - "Community 68"
Cohesion: 0.40
Nodes (5): code:ts (// features/leads/dedupe.test.ts), code:ts (// features/leads/dedupe.ts), code:ts (// features/leads/actions.ts), code:bash (git add features/leads/actions.ts features/leads/dedupe.ts f), Task 10: Lead actions (import + manual CRUD + suppression filtering)

### Community 69 - "Community 69"
Cohesion: 0.40
Nodes (5): code:ts (// features/suppression/actions.ts), code:tsx (// app/(app)/suppression/suppression-form.tsx), code:tsx (// app/(app)/suppression/page.tsx), code:bash (git add features/suppression "app/(app)/suppression"), Task 13: Suppression list

### Community 70 - "Community 70"
Cohesion: 0.12
Nodes (15): 0. Phase 5 decomposition (decided in brainstorm), 10. New / changed files (proposed), 11. Out of scope (explicit), 1. Purpose & scope, 2. Decisions locked (from brainstorm), 3. Schema changes (`prisma/schema.prisma`), 4. OAuth scope change (`features/email-accounts/google-oauth.ts`), 5. Detection flow (Inngest) (+7 more)

### Community 71 - "Community 71"
Cohesion: 0.22
Nodes (8): acc, account, getProfile, historyList, messagesGet, OAuth2, on, setCredentials

### Community 72 - "Community 72"
Cohesion: 0.50
Nodes (4): code:ts (// lib/crypto.test.ts), code:ts (// lib/crypto.ts), code:bash (git add lib/crypto.ts lib/crypto.test.ts), Task 2: `lib/crypto.ts` — token encryption (TDD)

### Community 73 - "Community 73"
Cohesion: 0.50
Nodes (4): code:ts (// features/sending/recipient.test.ts), code:ts (// features/sending/recipient.ts), code:bash (git add features/sending/recipient.ts features/sending/recip), Task 3: `features/sending/recipient.ts` — override guard (TDD)

### Community 74 - "Community 74"
Cohesion: 0.50
Nodes (4): code:ts (// features/sending/mime.test.ts), code:ts (// features/sending/mime.ts), code:bash (git add features/sending/mime.ts features/sending/mime.test.), Task 4: `features/sending/mime.ts` — base64url RFC 2822 builder (TDD)

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (4): code:bash (npm install googleapis@^173), code:block3 (# Mailbox OAuth (Gmail send). Create a GCP OAuth client (Web), code:bash (git add package.json package-lock.json .env.example), Task 0: Dependencies + env scaffolding

### Community 76 - "Community 76"
Cohesion: 0.50
Nodes (4): code:ts (// features/sending/schedule.test.ts), code:ts (// features/sending/schedule.ts), code:bash (git add features/sending/schedule.ts features/sending/schedu), Task 5: `features/sending/schedule.ts` — pure pacing + window helpers (TDD)

### Community 77 - "Community 77"
Cohesion: 0.50
Nodes (4): code:ts (// features/sending/gmail.test.ts), code:ts (// features/sending/gmail.ts), code:bash (git add features/sending/gmail.ts features/sending/gmail.tes), Task 6: `features/sending/gmail.ts` — Gmail send boundary (mocked test)

### Community 78 - "Community 78"
Cohesion: 0.50
Nodes (4): code:ts (// app/api/mailbox/google/connect/route.ts), code:ts (// app/api/mailbox/google/callback/route.ts), code:bash (git add app/api/mailbox), Task 8: OAuth route handlers

### Community 79 - "Community 79"
Cohesion: 0.50
Nodes (4): code:ts (// features/campaigns/sending-actions.test.ts), code:ts ("use server"), code:bash (git add features/campaigns/sending-actions.ts features/campa), Task 9: `features/campaigns/sending-actions.ts` — activate / pause / resume

### Community 80 - "Community 80"
Cohesion: 0.50
Nodes (4): code:ts (// lib/inngest/sending.ts), code:ts (// app/api/inngest/route.ts  (add import + array entry)), code:bash (git add lib/inngest/sending.ts app/api/inngest/route.ts), Task 10: `lib/inngest/sending.ts` — the send worker + registration

### Community 81 - "Community 81"
Cohesion: 0.50
Nodes (4): code:tsx (// app/(app)/skrzynki/page.tsx), code:ts (export async function setSendingMailbox(campaignId: string, ), code:bash (git add "app/(app)/skrzynki" "app/(app)/kampanie" features/c), Task 11: Minimal UI — mailbox page + campaign controls

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (4): code:tsx (// app/(app)/leady/lead-form.tsx), code:tsx (// app/(app)/leady/page.tsx), code:bash (git add "app/(app)/leady/page.tsx" "app/(app)/leady/lead-for), Task 11: Leads table page + filters + create form

### Community 85 - "Community 85"
Cohesion: 0.08
Nodes (23): code:ts (// features/sequences/plan.test.ts), code:bash (git add lib/inngest/sending.ts app/api/inngest/route.ts feat), code:ts (// features/campaigns/activation.test.ts), code:ts (// features/campaigns/activation.ts), code:ts (export async function activateCampaign(campaignId: string): ), code:bash (git add features/campaigns/activation.ts features/campaigns/), code:bash (git add docs/superpowers/ROADMAP.md graphify-out), code:ts (// features/sequences/plan.ts) (+15 more)

### Community 86 - "Community 86"
Cohesion: 0.12
Nodes (18): finalizeLead(), HARD_STOP, runLeadSequenceHandler(), SequenceStepTools, blocked, h, LEAD_ENTITY, decideStep() (+10 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (16): 10. Testing strategy, 11. Verification gates (read official docs before coding — standing rule), 12. New / changed files (proposed), 13. Out of scope (explicit), 1. Purpose & scope, 2. Decisions locked (from brainstorm), 3. Orchestration architecture, 4. Pure decision module (unit-tested) — `features/sequences/plan.ts` (+8 more)

### Community 88 - "Community 88"
Cohesion: 0.23
Nodes (10): inngest, helloWorld, pollMailboxReplies, scanMailboxesForReplies, {GET, POST, PUT}, runLeadSequence, sendCampaignEmail, getTrackedThreads() (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.25
Nodes (10): ActivateResult, ActivationFacts, validateActivation(), activateCampaign(), pauseCampaign(), setSendingMailbox(), startOfLocalDayUTC(), Props (+2 more)

## Knowledge Gaps
- **2466 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+2461 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `activateCampaign()` connect `Community 89` to `Community 0`, `Community 11`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `Boolean` connect `Community 89` to `Community 24`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `planSchedule()` connect `Community 11` to `Community 89`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _2479 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14210526315789473 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._