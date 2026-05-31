---
type: community
cohesion: 0.09
members: 44
---

# App pages & routes

**Cohesion:** 0.09 - loosely connected
**Members:** 44 nodes

## Members
- [[AppLayout()]] - code - app/(app)/layout.tsx
- [[CampaignDetailPage()]] - code - app/(app)/kampanie/[id]/page.tsx
- [[ImportPage()]] - code - app/(app)/leady/import/page.tsx
- [[ImportWizard()]] - code - app/(app)/leady/import/import-wizard.tsx
- [[LeadEditForm()]] - code - app/(app)/leady/[id]/lead-edit-form.tsx
- [[LeadEditPage()]] - code - app/(app)/leady/[id]/page.tsx
- [[LeadsPage()]] - code - app/(app)/leady/page.tsx
- [[LoginPage()]] - code - app/logowanie/page.tsx
- [[OrgContext]] - code - lib/org.ts
- [[PlaceholderForm()]] - code - app/(app)/placeholdery/placeholder-form.tsx
- [[PlaceholderResult]] - code - features/placeholders/actions.ts
- [[PlaceholdersPage()]] - code - app/(app)/placeholdery/page.tsx
- [[SequenceAndLeads()]] - code - app/(app)/kampanie/[id]/sequence-and-leads.tsx
- [[SuppressionForm()]] - code - app/(app)/suppression/suppression-form.tsx
- [[SuppressionPage()]] - code - app/(app)/suppression/page.tsx
- [[SuppressionResult]] - code - features/suppression/actions.ts
- [[actions.ts_3]] - code - features/placeholders/actions.ts
- [[actions.ts_4]] - code - features/suppression/actions.ts
- [[addSuppression()]] - code - features/suppression/actions.ts
- [[auth-helpers.ts]] - code - lib/auth-helpers.ts
- [[auth.ts]] - code - lib/auth.ts
- [[createPlaceholder()]] - code - features/placeholders/actions.ts
- [[deleteLead()]] - code - features/leads/actions.ts
- [[deletePlaceholder()]] - code - features/placeholders/actions.ts
- [[emailSchema]] - code - features/suppression/actions.ts
- [[ensureMembership()]] - code - lib/auth-helpers.ts
- [[globalForPrisma]] - code - lib/prisma.ts
- [[isEmailAllowed()]] - code - lib/auth-helpers.ts
- [[layout.tsx_1]] - code - app/(app)/layout.tsx
- [[org.ts]] - code - lib/org.ts
- [[page.tsx_2]] - code - app/(app)/kampanie/[id]/page.tsx
- [[page.tsx_5]] - code - app/(app)/leady/[id]/page.tsx
- [[page.tsx_4]] - code - app/(app)/leady/import/page.tsx
- [[page.tsx_3]] - code - app/(app)/leady/page.tsx
- [[page.tsx_7]] - code - app/(app)/placeholdery/page.tsx
- [[page.tsx_8]] - code - app/(app)/suppression/page.tsx
- [[page.tsx_10]] - code - app/logowanie/page.tsx
- [[placeholder-form.tsx]] - code - app/(app)/placeholdery/placeholder-form.tsx
- [[prisma.ts]] - code - lib/prisma.ts
- [[removeSuppression()]] - code - features/suppression/actions.ts
- [[requireOrg()]] - code - lib/org.ts
- [[route.ts]] - code - app/api/auth/[...nextauth]/route.ts
- [[suppression-form.tsx]] - code - app/(app)/suppression/suppression-form.tsx
- [[{handlers, signIn, signOut, auth}]] - code - lib/auth.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/App_pages__routes
SORT file.name ASC
```

## Connections to other communities
- 14 edges to [[_COMMUNITY_Campaigns feature]]
- 14 edges to [[_COMMUNITY_Leads & import feature]]
- 10 edges to [[_COMMUNITY_Templates feature]]
- 9 edges to [[_COMMUNITY_Offering lines feature]]
- 2 edges to [[_COMMUNITY_Placeholder schema]]

## Top bridge nodes
- [[requireOrg()]] - degree 42, connects to 4 communities
- [[org.ts]] - degree 18, connects to 4 communities
- [[prisma.ts]] - degree 18, connects to 4 communities
- [[actions.ts_3]] - degree 10, connects to 1 community
- [[auth.ts]] - degree 10, connects to 1 community