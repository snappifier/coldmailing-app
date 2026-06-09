# Phase 7 — shell-and-nav-redesign — Design

Date: 2026-06-09. Status: spec ready (design approved via visual choice — **Wariant C: collapsible icon sidebar**;
mobile = collapse to icons). Sub-project #8 (build order) of Phase 7. High-taste. Depends on `design-foundation`
(tokens/primitives). No DB migration. Visual reference: `docs/superpowers/design/shell-mock/index.html` (variant C).

## Goal

Replace the flat 10-link top bar with a **left icon sidebar** that collapses to an icon-only rail, with grouped
sections, per-item icons + active state, and an **account menu** surfacing the signed-in user, their organization,
and role. Internal, JS-always tool; the sidebar is a client component, the rest stays server-rendered.

## Scope

**IN:** a new client `Sidebar` (icon rail, grouped links, collapse toggle + persistence, responsive icon-only on
narrow screens) replacing the inline `<nav>` in `app/(app)/layout.tsx`; an account menu (user/email/org/role +
theme toggle + Wyloguj); ~11 new section icons; a pure `isNavActive` helper. The layout fetches the org name.

**OUT:** role-based link gating / `requireRole` (that is `team-role-ui`); per-page visual polish
(`page-level-visual-pass`); any new route or migration; a full mobile hamburger drawer (the chosen behavior is
collapse-to-icons, not a drawer).

## Layout decision (chosen: Wariant C)

A single left sidebar with two states driven by one `collapsed` flag:
- **Expanded** (desktop, `lg+`, not collapsed): width ~212px, icon + label rows, group headers visible, brand
  wordmark, account block shows name + org·role.
- **Icon-only** (collapsed, OR any width `< lg`): width 56px (`w-14`), labels/group-headers/brand-text/account-text
  hidden, each item keeps its icon + a `title`/`aria-label` tooltip.

Expressed in pure Tailwind (no custom CSS): width `cn("w-14", !collapsed && "lg:w-[212px]")`; labels
`cn(collapsed ? "hidden" : "hidden lg:inline")`. So below `lg` it is always icon-only (the chosen "zwijany do
ikon" mobile behavior); at `lg+` the collapse toggle controls it. The collapse toggle button is `hidden lg:grid`
(meaningless below `lg`, where it is forced icon-only).

`collapsed` persists in `localStorage` ("nav-collapsed"); applied via `useEffect` after mount (SSR + first client
render are expanded, so no hydration mismatch — at most a one-frame settle, acceptable for an internal tool).

## Navigation structure

`app/(app)/nav-items.tsx` — the config (imports icon components):

```
SPRZEDAŻ:  Pulpit (/), Leady (/leady), Pipeline (/pipeline)
TREŚCI:    Linie usług (/linie), Szablony (/szablony), Placeholdery (/placeholdery)
WYSYŁKA:   Badania (/badania), Kampanie (/kampanie), Skrzynki (/skrzynki), Suppression (/suppression)
```
`Ustawienia` (/ustawienia) is a standalone item pinned just above the account block (not in a group). Group
headers render only in the expanded state.

Active state: a pure `isNavActive(pathname, href)` = `pathname === href || pathname.startsWith(href + "/")`
(`features/nav/active.ts`, unit-tested — covers the `/` exact-match edge so "Pulpit" is not active everywhere).
Active item = `bg-accent-quiet text-accent` (icon + label); hover = `hover:bg-surface-2 hover:text-fg`.

## Icons

Add ~11 stroke icons to `components/ui/icons.tsx` (same `Svg` wrapper, 24-viewbox, `currentColor`):
`HomeIcon` (Pulpit), `UsersIcon` (Leady), `ColumnsIcon` (Pipeline), `LayersIcon` (Linie), `FileTextIcon`
(Szablony), `BracesIcon` (Placeholdery), `SearchIcon` (Badania), `SendIcon` (Kampanie), `InboxIcon` (Skrzynki),
`BanIcon` (Suppression), `SettingsIcon` (Ustawienia), plus `ChevronLeftIcon` (collapse) and `LogOutIcon`. Each is a
small hand-written `<path>` set; rendered at `size-[18px]`.

## Account menu

A client component (native `<details>` popover for no-dep open/close + outside-click via `<summary>`), anchored at
the sidebar bottom:
- Trigger: avatar (initials from the user name/email) + (expanded only) name + `org · ROLE` line.
- Open panel: name + email (muted), the organization name, a role badge (`OWNER`/etc.), then `Wyloguj` (the
  existing `signOut` server-action `<form>`, moved here). The `ThemeToggle` stays in the rail footer above the
  account button (one-tap), not in the menu.
- Collapsed/icon-only: the trigger is just the avatar; the panel still opens with the full details.

Data: `app/(app)/layout.tsx` already calls `auth()`; it additionally loads the org name
(`prisma.organization.findUnique({where:{id: session.user.orgId}, select:{name:true}})`) and passes
`{name, email, role, orgName}` to `<Sidebar>`. Initials derived client-side from name (fallback email).

## Files

- Create `features/nav/active.ts` (+ `active.test.ts`) — pure `isNavActive`.
- Create `app/(app)/nav-items.tsx` — the grouped config (label + href + icon) + the standalone Ustawienia entry.
- Create `app/(app)/sidebar.tsx` (`"use client"`) — the rail: brand, groups, Ustawienia, collapse toggle, theme
  toggle, account menu; `usePathname` + `isNavActive`; `collapsed` state + localStorage.
- Edit `components/ui/icons.tsx` — add the ~13 icons.
- Edit `app/(app)/layout.tsx` — fetch org name; replace the `<header>`/`<nav>` with a flex `[Sidebar][main]`
  shell; keep the skip-link, `ToastProvider`/`ConfirmProvider`, `Container`. Remove the inline `LINKS`, `NavLink`
  usage in the header, the inline `Wyloguj` form, and the header `ThemeToggle` (all move into `Sidebar`).
- `app/(app)/nav-link.tsx` — superseded by the sidebar's own link rendering; delete if unused after the refactor.

## Testing

- TDD `features/nav/active.test.ts`: `isNavActive("/", "/")` true; `isNavActive("/leady", "/")` false;
  `isNavActive("/leady/123", "/leady")` true; `isNavActive("/leady", "/leady")` true; `isNavActive("/kampanie",
  "/leady")` false.
- `tsc` 0, `eslint "app/(app)" components` clean, `next build` green, `vitest` green (+ the active cases).
- Manual (dev server, the high-taste check): `/` shows the sidebar with the active "Pulpit"; collapse toggle
  shrinks to icons + persists across reload; below `lg` it is icon-only; the account menu shows name/org/role and
  Wyloguj works; theme toggle still works; tooltips show in icon-only mode.

## Risks / notes

- The layout drives every page — keep the refactor minimal (swap the nav region; preserve providers, skip link,
  Container, auth redirect). A regression here affects the whole app, so verify the build + a live eyeball.
- Hydration: `collapsed` is applied post-mount; the brand/labels render expanded first, so no SSR/client mismatch.
- Icon quality is the taste-sensitive part; keep them simple, consistent stroke, 18px. They can be refined later
  without touching structure.
- Org-name query is a single `findUnique` in the already-async layout — negligible cost.
