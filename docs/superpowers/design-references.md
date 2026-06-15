# Design references — taste contract

Date: 2026-06-10. Source: the user's own reference-list (`software houses score`, 54 sites scored on three axes). Built via a 16-agent analysis workflow (fan-out per site → synthesis → adversarial critique), then hand-corrected against the actual codebase. This is a DURABLE taste contract for every future polish round — read it before proposing visual/motion work.

The list was originally made for a software-house MARKETING site. Our target is the opposite: an **internal, authenticated, dense data tool** (leads tables, campaigns, sequence builder, templates, pipeline, dashboard, settings) already committed to a **monochrome UI with a tiny Linear micro-accent** (`#5e6ad2` light / `#828fff` dark) used ONLY on logo dot, active nav/tab bars, ON switches/checked chips, and the `:focus-visible` ring. So most of the list is read for *principles* and *anti-patterns*, not literal patterns — the marketing-only stuff is parked in §5.

## 1. The user's rating system (decoded)

Three axes, Polish shorthand, ascending **shit < meh < ok < top < \* < \*\*** (`*`/`**` = best-in-class, actively wants to emulate; `**` reserved for Stripe alone):

- **wizualnie** — the still/static surface: composition, palette, type, borders, spacing.
- **motion/detale** — motion craft + fine detailing: how things ease/settle/draw-in, hairline precision, hidden micro-detail.
- **mikro** — the small interaction-feedback layer: hover/press/focus/copy micro-states, microcopy.
- (`rozmieszczenie treści` — explicitly ignored by the user; dropped.)

**Core thesis:** he separates the *still surface* from the *motion/interaction layer* and **punishes mismatch** — gorgeous-but-static (Profound), gorgeous-but-buggy (Lovable, Krea, Scale), and motion-without-substance (Obys) all get docked. His **"AI slop"** verdict is reserved for *competent-but-generic* work with no voice (Nuxt, Leap, Brainhub, Xbow) — the tell is the predictable template (dark bg + neon/gradient glow hero + stock icons + logo wall + carousels), not ugliness. Two named failure modes: **emptiness mistaken for elegance** (Work&Co, Apollo, Zeromatter, Netguru) and **over-rounding** (Krea "too round"). The winning formula he rewards with top/\*: a cohesive still surface **AND** alive, fast, bug-free micro-interactions; motion that is hidden/restrained or domain-meaningful; a single accent on a neutral canvas; small architectural radii; hairline-border precision — i.e. exactly the Stripe/Linear/Vite register the app already chose.

## 2. Top references (what to emulate, and why)

- **Stripe** (`**` all axes — his stated #1) — small radii, 1px hairline dividers, single accent on neutral, tabular-nums, soft low-spread shadows, obsessive optical alignment, 120-200ms ease-out on *every* interactive element. Our tokens already encode this; the job is Stripe-grade *consistency*.
- **Linear** — literal source of our accent + the "motion hidden inside seemingly static elements" principle. Restrained enter (fade + few-px rise), hover micro-nudge, `→` nudges, kbd chips, charts that draw-in once then stay still. It essentially *is* our target register.
- **Vite** (`top` all axes) — the decisive lesson: **you don't need motion to feel premium.** Precise 1px hairline borders as the structural language + disciplined accent reserved for interactive/active/focus + consistent modest radius is enough. Highest-leverage work is border/spacing/focus precision, not adding motion.
- **Cursor** — markets the tool by showing *real product UI*; its status/queue cards + status-badge vocabulary map ~1:1 onto our campaign steps / send queue / lead lifecycle. "The hero is already the live table" = our exact situation.
- **applied compute** (`*` all axes — his craft benchmark) — the lesson is **discipline, not amplitude**: every interactive element gets a deliberate, consistent, fast (~120-200ms ease-out) micro-state (small transform + color shift) + directional draw-in indicators. Port "everything responds purposefully," not the ambient marketing motion.
- **Graphite** — the **glow calibration reference**: he loves the *minimal* amount and the scene-level shader, but explicitly docks "za dużo glow w pojedynczych hoverach." Rule: glow/ambient belongs to scene/section transitions and at most the single most-important active control — **never bound to per-row/card/button hover.**
- **Baseten** — domain-meaningful "live system" feel without hover-noise: animated pipeline diagrams, count-up metrics, pulsing "active" dots on a calm canvas. Maps onto our literal pipeline (lead → research → draft → send → reply) and dashboard metrics — ambient liveness confined to status/pipeline/metrics; data tables stay quiet.

## 3. Positive principles (all confirmed to apply to our app)

1. **Small/architectural radii** (Stripe/Linear/Vercel/Vite) — keep 4/6/8px; resist drift upward. **Offender to fix:** Badge uses `rounded-[999px]` full pill for status chips = the "too round" Krea anti-pattern in our most-repeated element. Move status badges to `--radius-sm` (4px); reserve full-round for the avatar circle and the Switch track only.
2. **Hairline 1px low-opacity borders as the primary separation device, not shadows** (Vite/Vercel/Next/Stripe/cal.com) — we lead here. Push further: stop stacking individual bordered `<Card>`s in dense lists (**two confirmed sites:** `leady/[id]/timeline.tsx` AND `kampanie/[id]/sequence-steps.tsx`) — render one bordered container with hairline `border-b` row dividers (the Table pattern) so lists read as one surface, not a pile of boxes.
3. **Single accent on a neutral canvas; color is an EVENT, not a wash** (Linear/Vite/Cursor/applied compute/Graphite/Profound/Next) — exactly our committed direction. Hold the line: `--accent` stays reserved for interactive/active state, never a decorative fill or hover glow. Status green/red/amber are the only other color.
4. **Tabular numerals everywhere** (Stripe/Vercel/spiraldb/monterail/Devin) — done in `dashboard-parts`; extend the audit to any numeric Table cell / Badge count still on proportional figures.
5. **Motion hidden inside seemingly static elements — restrained, one-shot** (Linear/applied compute/Vite/monterail) — fade + few-px rise (~150-200ms `--ease-out-quart`) on panels/rows/modals as they appear; hover micro-nudge (arrow `translateX ~2px` + faint bg tint) on actionable rows. We already do `active:scale-[.97]` on Button — extend the *vocabulary*, not the amplitude.
6. **Concept-as-motion: animate what the product DOES** (spiraldb/applied compute/cal.com/Baseten) — animate lifecycle STATE CHANGES (queued→sent→opened→replied→bounced) as a Badge color cross-fade + checkmark/number tick rather than a hard swap. **Guardrail:** lifecycle transitions use ONLY status colors — accent never participates (not even a transitional `accent-quiet` tint).
7. **Count-up on metrics — on FIRST MOUNT only** (Baseten/Replit/Devin/monterail) — tween HeroStat/MetricStat 0→value (~400-600ms `--ease-out`) once on mount; **snap on subsequent recalculations/navigations** (re-sweeping on every refresh is a perceived-speed tax in a tool opened many times/day). Reduced-motion snaps. Tabular-nums keeps width stable.
8. **Charts/sparklines/funnels draw-in once, then stay still** (Linear/Baseten/cal.com/Replit) — animate the Sparkline `stroke-dashoffset` sweep and FunnelRow width-growth once on first paint (~500ms ease-out client wrapper); no looping; reduced-motion renders final state.
9. **Directional sliding active indicator** (applied compute/Replit/Linear) — make the sidebar `before:bg-accent` bar and the campaign tab underline SLIDE between items (Motion shared `layoutId`) instead of hard-cutting. Moves only the existing accent — no new color. (Note: campaign tab *content* already fades+rises; only the indicator hard-cuts — that's the real gap.)
10. **Complete, identical interaction states on every control** (applied compute/Vite/Family/resend) — resend's failure is the lesson: no element should react richly while its neighbor does nothing. Audit hover/`focus-visible`/active/loading/disabled across Input/Select/Textarea/Switch/Badge-as-button + every clickable surface. **Specific confirmed holes:** Switch / Badge-as-button / sidebar-collapse rely on the global ring only; Input/Select use `focus:border` (not a `:focus-visible` ring) so keyboard vs mouse focus isn't differentiated on our two most-used form controls; the raw `<input type=checkbox>` "Wyślij draft AI" in `sequence-steps.tsx` is a browser default that bypasses the design system (give it a Checkbox primitive or reuse Switch).
11. **kbd chips, ⌘K palette, copy-to-clipboard, mono value blocks** (Next/Linear/Vite/Nuxt/ElevenLabs) — power-user details for a tool opened many times/day. The cheap, ship-now subset: a `kbd` chip primitive (Geist Mono, `--surface-3`, hairline border, `--radius-sm`) + a one-click copy affordance (success pulse) for merge-field tokens / API keys / tracking pixels, in a bordered mono block with a tinted header. (⌘K command palette is deferred — see §6.)
12. **One easing/spring token reused everywhere** (monterail/ElevenLabs/Stripe) — mostly done: toast/confirm/modal/button/tabs already use `--ease-out`/`--ease-out-quart`. Remaining work is small: (a) `campaign-tabs.tsx` hardcodes the quart bezier as an inline literal — extract to the token; (b) document the Modal spring (`visualDuration .25, bounce 0`) as the canonical spring token. **No new bespoke curves; no new spring identity** (see §4 on overshoot).
13. **Type weight + size drives hierarchy, not color** (Boldare/Daylight/ElevenLabs/monterail) — heavy tabular numerals for KPIs against calm muted labels; accent stays OUT of hierarchy (signals interactivity only). This is what keeps a mono UI scannable at density.
14. **One rigorously-reused token system on EVERY screen** (ElevenLabs/Vite/Stripe/superlist) — ensure campaigns/templates/mailbox/research/pipeline/settings all consume the same primitives with zero ad-hoc colors/spacings. superlist's warning: with no hero, the bar is *uniform* polish — craft must not decay "below the fold."
15. **Real interactive UI as the centerpiece; live data, never decoration** (cal.com/Cursor/Profound/Replicate/Flox) — our "hero" is the live table/scheduler/sequence. Spend motion budget there (row entrance, hover lift, drill-in arrows) and put live metrics/tabular numbers/status lines inside cards. Flox's terminal-with-checkmarks maps directly onto the upcoming mailbox send-log.
16. **Static, low-opacity ambient atmosphere — confined to chrome/empty zones, never hover-reactive, never behind dense data** (Raycast/Clerk/Graphite/Factory/Trunk) — dose homeopathically and respect the hard rule (ambient/static, NOT cursor/hover-reactive). **Permitted:** one faint static CSS radial-gradient bloom behind the **login** screen and behind **EmptyState** illustrations. Ship as CSS gradient or tiled asset — **never WebGL.** Tables/forms/logs always sit on flat `--surface-1`. (The dashboard header is NOT an empty zone — no grain/glow there; see §4.)
17. **Spring physics for tactile feedback on real status controls** (Family/applied compute/Baseten) — reserve the *settle* feel for the success moment on Send / Activate campaign (checkmark draw + brief settle). Import Family's MOTION behavior, explicitly NOT its rounded shape. **Use the existing `bounce:0` curve — no overshoot** (see §4).

## 4. Anti-patterns + guardrails

- **AI-slop default** (Nuxt/Xbow/Leap/Brainhub/Cognition): dark bg + neon/gradient mesh-glow hero + stock icons + placeholder frame graphics + logo wall + carousels. → Never add a gradient/mesh/aurora bloom to working chrome; never use stock icon packs (keep the single hand-tuned `components/ui/icons.tsx`); never put placeholder "frame" graphics where real data belongs. Flat `--bg` with no glow IS the anti-slop posture — defend it.
- **Per-element / per-hover glow** (Graphite's explicit "za dużo glow w pojedynczych hoverach", Clerk, Krea): → glow is scene-level and at most the single most-important active control. Row/card/button hover stays a faint `--surface-2` bg shift only. Accent never glows on hover.
- **Over-rounded radii** (Krea "too round", Family): → hold 4/6/8px; fix the pill Badge; full-round only for avatars + Switch track.
- **Buggy/janky/half-finished interactions** (Lovable/Speakeasy/Scale/Krea/resend): → ship FEWER interactions, each held to the same finish. Compositor-only transform/opacity, 120-250ms, on real state changes; run the motion-audit skill before shipping any animation. A stutter scores worse than honest static.
- **Imperceptible/pointless motion** (Black Forest Labs' invisible parallax): → every motion must produce a legible, intentional change. No sub-perceptual drift.
- **Emptiness mistaken for elegance** (Work&Co/Apollo/Zeromatter/Netguru/resend/superlist): → this is a DENSE tool; whitespace frames real content, never substitutes for it. Realistic data, not placeholder; uniform craft, no "hero peak then decay." EmptyState is the only sparse zone allowed.
- **Static-only where users expect live UI** (Profound/Apollo): → things that LOOK interactive MUST respond. Our sequence/metrics are live state, not static SVG mockups.
- **Slopy 3D / shader hero objects** (Speakeasy's rendered hand, active theory, obys): → no decorative 3D / WebGL hero objects / cursor-distortion. Visual interest = crisp data-viz, tabular numerals, typography, tight spacing.
- **Video-as-content** (Cuberto/Clay/Solana): → never substitute video for live UI; motion is functional micro-interaction, not footage.
- **Custom cursor / scroll-jacking / momentum hijack** (Cuberto/Obys/active theory/Locomotive): → never replace the cursor (precision clicking on dense tables is sacred); never hijack native scroll. Lenis-style momentum is **parked for the app** (landing-page signal only; fights muscle memory + adds JS to every long view).
- **Style over wayfinding** (teenage engineering/cognition): → orientation and affordances always win; clear labels, visible active-nav, explanatory connective tissue.
- **Gimmick mistaken for structure** (cognition's 01-04, carousels): → numbered rhythm only where it aids comprehension of a real flow (campaign steps 01/02/03); no decorative carousels.
- **Detail without precision** (Rox; and our own `▲`/`▼` text-glyph reorder buttons in `sequence-steps.tsx` — the highest-traffic control in the core feature rendered as raw characters): → fewer details at 100%. Replace the glyphs with the hand-tuned icon set + full hover/disabled states.
- **Broken scrollytelling** (Until Labs/Scale): → no scroll-driven narrative in the app; any scroll-coupled motion yields a legible change per increment.

## 5. Marketing-only — PARKED (only if a public site is ever built)

Full-bleed animated gradient/aurora/mesh hero · soft bloom behind a hero product shot (app gets at most ONE faint static bloom behind login/EmptyState) · 48-64px display headline type · logo/"trusted by" marquee walls · testimonial/review carousels · scroll-driven storytelling/parallax · Lenis/Locomotive site-wide momentum · continuous ambient marquees / perpetual float · video heroes / autoplay showreels · big SVG/illustrated/photographic hero backgrounds + 3D rendered hero objects · marketing narrative spine (problem→solution→proof→CTA), hero-stat theatrics, pricing toggles, dual CTAs, blog feeds, awards/Clutch strips · per-section distinct shader scenes · gradient text fill on headlines (hurts legibility).

## 6. Prioritized action backlog (corrected against the codebase)

Tiers reflect both effort and confidence. **Hard rule:** any change that adds NET-NEW accent *motion* (sliding indicator, success pulse, count-up) must pass a visual-mockup comparison before build — the user prefers visual forks and the whole effort is "less glow, tiny accent," so accent that *moves* is exactly the line to check. Bundle the mockup-gated items into one decision.

**Ship now — S (cheap, high-confidence, on-brief):**
- Status Badge `rounded-[999px]` → `--radius-sm` (4px). [refs: Krea/Vite/Stripe/Linear]
- Row drill-in nudge (`→` translateX ~2px on hover) on ReplyRow + linking Table rows; compositor-only, 150ms, reduced-motion safe. [Linear/applied compute]
- Extract the inline quart bezier in `campaign-tabs.tsx` to the `--ease-out-quart` token; document the `bounce:0` Modal spring as the canonical spring. [monterail/ElevenLabs/Stripe]
- Replace the `▲`/`▼` text-glyph reorder buttons with `icons.tsx` icons + full hover/disabled states. [Rox anti-pattern]

**Ship now — M (cheap, needs a bit of wiring):**
- Single-bordered-container + hairline `border-b` dividers for the two card-stacking lists (`timeline.tsx`, `sequence-steps.tsx`). [Clerk/Vercel/Vite]
- Interaction-state completeness audit: `:focus-visible` ring on Input/Select (currently border-only), Switch, Badge-as-button, sidebar-collapse; replace the raw draft-AI `<input type=checkbox>` with a primitive. [resend/applied compute/Vite]
- `kbd` chip primitive + copy-to-clipboard affordance (success pulse) for merge-field tokens / API keys / tracking pixels in a bordered mono block. [Next/Linear/Vite]
- Sparkline `stroke-dashoffset` sweep + FunnelRow width growth, once on first paint. [Linear/Baseten/cal.com]

**Mockup-gated — M (net-new accent motion; one visual fork before build):**
- Sliding active indicator (sidebar bar + tab underline) via shared `layoutId`. [Linear/applied compute/Replit]
- Count-up on HeroStat/MetricStat **on first mount only** (snap on recalc). [Baseten/Replit/Devin]
- Lifecycle status cross-fade + checkmark/number tick (status colors only, accent never). [Family/Baseten/spiraldb]
- Success-moment settle (checkmark draw, `bounce:0` curve — NOT an overshoot spring) on Send / Activate. [Family/applied compute/Cursor]

**Mockup-gated — S, atmosphere:**
- One faint static CSS radial bloom behind the **login** screen + EmptyState illustration zone (CSS gradient, never WebGL, never on data surfaces / dashboard header). Confirm it doesn't read as the AI-slop dark+glow hero. [Raycast/Clerk/Graphite]
- EmptyState draw-once illustration — **line-only, single neutral/accent stroke in the `icons.tsx` 1.8px vocabulary**, NOT a filled/colored spot illustration. [Family/Baseten/Linear]

**Later (Phase 4+):**
- Mailbox/send-log as a terminal/mono panel with check/x status lines + tabular counts. [Flox/Cursor]

**Dropped / de-scoped (overreach — do NOT do):**
- ❌ **Sequence-builder node/timeline rebuild (L).** The sequence builder already ships as a working card list with add/edit/delete/reorder; the rebuild leans on **Profound — a reference the user DOCKED as static marketing eye-candy** — and invites the exact "buggy ambition" failure he punishes, in a 40x/day tool. Spend that budget on the S/M wins above instead.
- ❌ **Overshoot spring** anywhere — contradicts our sole committed spring token (`bounce:0`) and edges toward the toy feel the mono direction rejects. Press feedback is already `active:scale-[.97]`.
- ❌ **Count-up on recalculation** (mount-only is fine; re-sweeping taxes perceived speed).
- ❌ **Grain/glow on the dashboard header** (it sits above dense data; flat-surface rule wins).
- ❌ **Lenis/smooth-scroll momentum** in the app (landing-page signal; fights precision + speed).
- ⏸ **⌘K command palette** — real power-user signal but a feature, not a polish pass; defer to post-Phase-4 to avoid half-finished scope.

## 7. Open questions for the user

1. **Dark as the default app theme?** Almost every craft reference he loves is dark-canvas, but those are dark *marketing* sites; our app is light-default with both themes fully tokenized. Flipping the default has real habituation cost the references don't justify — recommend keeping it a toggle unless the user wants the flip.
2. **Net-new accent motion** (sliding indicator + count-up + success pulse cumulatively add accent movement to a near-static UI) — bundle into one visual-mockup fork before building.
3. **Motion lib boundary** — count-up / sparkline sweep / sliding indicator: standardize on Motion (consistent `layoutId`/spring, more client JS) or keep the cheap ones pure CSS for perf? Decide per-effect with motion-audit.
4. **Login bloom** — confirm via mockup it reads restrained, not generic AI-slop.
