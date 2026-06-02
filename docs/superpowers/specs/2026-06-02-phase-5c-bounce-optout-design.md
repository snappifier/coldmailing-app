# Cold Mailing Tool — Phase 5c: Smarter inbound (bounce + opt-out + RODO) (Design)

- Date: 2026-06-02
- Phase: 5c (third sub-phase of Phase 5 "Sequences + replies")
- Depends on: Phase 5a (reply detection: poller `pollMailboxReplies`, `getTrackedThreads`/`recordReply`, `matchReplies`, `gmail-history` boundary, inbound `Message`) and Phase 1 (`Suppression` + `addSuppression`, the `/suppression` page)
- Status: Design approved in brainstorm; pending written-spec review

## 1. Purpose & scope

Classify every inbound message the poller sees (today every inbound on a tracked thread is blindly
counted as a REPLY) into **REPLY / BOUNCE / AUTO_REPLY / OPT_OUT_SUSPECT**, and act per type so the
tool stays accurate, deliverable, and RODO-friendly:

- **Bounce** (delivery failure from `mailer-daemon`/DSN) → mark the lead `BOUNCED`, flag it, and **stop counting it as a reply** (the current bug); suppression is **manual** for now.
- **Auto-reply** (out-of-office) → **ignore**: not a reply, the sequence keeps going.
- **Opt-out** ("nie jestem zainteresowany" in a reply) → detect via a **pluggable** detector (keyword or LLM), behavior gated by a per-org mode `OFF / SUGGEST / AUTO`.
- **Manual "Nie kontaktować"** button on any lead → permanent `Suppression` (org-wide) + stop.

**Definition of done**
- Prisma migrated on Neon (per-org settings, `Message.inboundKind`).
- A bounce on a tracked thread → `CampaignLead` `BOUNCED` (+ inbound `Message` `kind=BOUNCE`), **not** `REPLIED`, no `campaign/lead.replied` emitted.
- An out-of-office auto-reply → no status change, sequence continues.
- A reply with `optOutMode != OFF` → flagged `OPT_OUT_SUSPECT`; in `AUTO` it is auto-suppressed; the manual button suppresses in any mode.
- Detector method switchable per-org (`KEYWORD` works out of the box; `LLM` requires `ANTHROPIC_API_KEY`).
- `npx tsc --noEmit` clean, `npx vitest run` green (incl. new pure-logic tests), production `next build` green.

## 2. Decisions locked (from brainstorm)

- **Classify every inbound; act per type.** Deterministic for BOUNCE/AUTO_REPLY (from + headers), fuzzy for OPT_OUT (reply text).
- **Bounce:** `BOUNCED` + flag + **manual** suppression (auto-suppress-bounce deferred — "na początek" manual).
- **Auto-reply (OOO):** ignored (not a reply, sequence continues).
- **Opt-out detection:** per-org `optOutMode: OFF | SUGGEST | AUTO` (default **OFF**). SUGGEST flags only (human confirms); AUTO auto-suppresses; OFF does not detect.
- **Detector pluggable + switchable:** per-org `optOutDetector: KEYWORD | LLM` (default **KEYWORD**). `CUSTOM` (a self-trained model) is a future third implementation, **out of scope** — but SUGGEST-mode confirmations are exactly its future training data, so the interface leaves the door open.
- **Manual "Nie kontaktować":** always available; upserts `Suppression` (org-wide) + sets the lead terminal + stops.
- **Sender identity (RODO):** **no feature** — the operator writes their signature in the template body.
- **UI is minimal/mechanical** (raw Tailwind); the polished visual pass is deferred to a separate session (a dedicated Claude-Design prompt) / Phase 7.
- **No unsubscribe link / `List-Unsubscribe`** this phase (deferred).

## 3. Classification pipeline (extends the 5a poller)

**`gmail-history.ts` (MODIFY):** the inbound fetch (`users.messages.get`) additionally pulls the
**snippet** and the headers **`Auto-Submitted`**, **`Precedence`**, **`X-Failed-Recipients`** (alongside
`From`/`Subject`). `FetchedMessage`/`AddedMessage` gain `snippet: string` and these header values
(e.g. `autoSubmitted`, `precedence`, `failedRecipients`). If `format: "metadata"` does not return
`snippet`, fall back to `format: "full"` and read `data.snippet` (verify against the installed client).

**`features/replies/classify.ts` (NEW, pure):**

```
type DeterministicKind = "REPLY" | "BOUNCE" | "AUTO_REPLY"  // the stored Message.inboundKind (sec. 6) is the superset that adds OPT_OUT_SUSPECT
interface InboundFacts {
	from: string
	subject: string
	labelIds: string[]
	autoSubmitted: string | null
	precedence: string | null
	failedRecipients: string | null
}
function classifyInbound(f: InboundFacts): DeterministicKind
```

Rules (unit-tested), conservative:
- **BOUNCE** when `from` matches `mailer-daemon`/`postmaster` (case-insensitive), OR `failedRecipients` is present, OR `subject` matches `/delivery status notification|undelivered|delivery failed|failure notice|returned mail|nie dostarczono/i`.
- **AUTO_REPLY** when `autoSubmitted` is set and not `"no"`, OR `precedence` in `{auto_reply, bulk, junk}`, OR `subject` matches `/out of office|automatyczna odpowiedz|autoreply|nieobecno/i`.
- else **REPLY**.

(OPT_OUT is a refinement of REPLY, decided by the detector in §4 — kept separate so the deterministic
classifier stays pure and free of the fuzzy logic.)

**Poller branching (`lib/inngest/replies.ts` `pollMailboxReplies`, MODIFY):** for each inbound on a
tracked thread, after `classifyInbound`:
- **BOUNCE** → record inbound `Message{kind: BOUNCE, body: snippet}`, set `CampaignLead.status = BOUNCED`; **do not** emit `campaign/lead.replied`. (No auto-suppress.)
- **AUTO_REPLY** → record `Message{kind: AUTO_REPLY}` (for the timeline); **no** status change, **no** replied event — the sequence continues.
- **REPLY** → if `optOutMode != OFF`, run the detector (§4) on the snippet; `optOut → kind = OPT_OUT_SUSPECT` else `REPLY`. Record `Message{kind, body: snippet}`, set `CampaignLead.status = REPLIED` + `repliedAt`, emit `campaign/lead.replied` (as 5a — the reply still stops the sequence). If `optOutMode == AUTO` and `optOut`, also auto-suppress (§5/§7).

`matchReplies` still selects inbound-on-tracked-thread and excludes our own sends; the new
classification + per-type action replace the unconditional `recordReply`.

## 4. Opt-out detector (pluggable, switchable)

**`features/replies/optout/index.ts` (NEW):**

```
interface OptOutResult {optOut: boolean; score: number}
interface OptOutDetector {detect(text: string): Promise<OptOutResult>}
function getDetector(kind: "KEYWORD" | "LLM"): OptOutDetector
```

- **`keyword.ts` (NEW, pure, default):** normalize (lowercase, strip Polish diacritics), match a curated phrase list — e.g. `nie jestem zainteresowany`, `nie jestesmy zainteresowani`, `prosze nie wysylac`, `prosze o niekontaktowanie`, `nie piszcie`, `rezygnuj`, `prosze usunac`, `usuncie mnie`, `wypisz`, `odczepcie sie`, `unsubscribe`. `optOut = any phrase present`, `score = 1` on hit else `0`. Fully unit-tested (hits, diacritics, basic negation caveat documented).
- **`llm.ts` (NEW, boundary):** one Anthropic call (cheap model, prompt-cached system instruction) returning `{optOut, score}` for the Polish reply text. Requires `ANTHROPIC_API_KEY`. Mocked in tests. (Verify the current Anthropic SDK + prompt-caching idioms before coding — see the claude-api guidance.)
- **`CUSTOM`** — future third implementation fed by SUGGEST-mode confirmations; out of scope.

The poller picks the detector from the org's `optOutDetector` setting.

## 5. Per-org settings (`prisma/schema.prisma`, migration)

New enums + fields on `Organization`:

```
enum OptOutMode { OFF SUGGEST AUTO }
enum OptOutDetector { KEYWORD LLM }
// Organization:
optOutMode     OptOutMode     @default(OFF)
optOutDetector OptOutDetector @default(KEYWORD)
```

Migration: `npx prisma migrate dev --name phase5c_inbound_classification` (additive; dev server OFF).

**Settings UI:** a minimal `/ustawienia` page (NEW) with the two controls (mode select, detector
select), saved via a `setOrgInboundSettings` server action (org-scoped via `requireOrg`). Nav link added.

## 6. Data model / flags (`Message`)

New enum + nullable field (only inbound rows set it):

```
enum InboundKind { REPLY BOUNCE AUTO_REPLY OPT_OUT_SUSPECT }
// Message:
inboundKind InboundKind?   // null for OUTBOUND
```

Inbound `Message.body` now stores the **snippet** (5a stored the sender `from`; superseded). The UI
badge for a lead derives from its latest inbound `Message.inboundKind`. No new `CampaignLead` field —
bounce uses the existing `status = BOUNCED`; opt-out shows as a badge from the Message kind while the
lead is `REPLIED`.

## 7. Actions

- **Auto (in the poller, §3):** OOO ignored; bounce → `BOUNCED` + flag (no suppress); opt-out → OFF nothing / SUGGEST flag / AUTO suppress.
- **`markDoNotContact(campaignLeadId)` (NEW server action in `features/suppression/actions.ts`):** org-scoped; loads the lead's email; upserts `Suppression` (reason `BOUNCED` if the latest inbound is a bounce, else `UNSUBSCRIBED`); sets `CampaignLead.status` to `UNSUBSCRIBED` (or leaves `BOUNCED`); the running sequence stops at the next step via the existing `runLeadSequence` guard (`HARD_STOP` already includes `UNSUBSCRIBED`/`BOUNCED`). Reuses the `addSuppression` upsert pattern.
- **AUTO opt-out** calls the same suppression write from the poller.

(Note: `runLeadSequence`'s `HARD_STOP` already contains `BOUNCED` and `UNSUBSCRIBED`, so a suppressed/bounced lead's in-flight followup self-stops — no orchestrator change needed.)

## 8. UI (minimal, raw Tailwind — visual polish deferred)

- **`sequence-and-leads.tsx` (MODIFY):** per lead, show the latest inbound **snippet** + a **kind badge** (`odpowiedź` / `odbicie` / `auto` / `możliwa rezygnacja`) + a **"Nie kontaktować"** button (calls `markDoNotContact`). Visible for leads with an inbound message.
- **`/ustawienia` (NEW):** the two per-org selects (§5).
- No styling pass — that is a later, separate session.

## 9. Sender identity (RODO)

No feature. Operators include their identity/signature in the template body. Documented as the RODO
opt-out + identity story for this phase (the unsubscribe-link path is deferred).

## 10. Error handling / edge cases

- **Reply that is also an opt-out:** it is BOTH a reply (→ `REPLIED`, sequence stops) AND flagged `OPT_OUT_SUSPECT` (→ suppress decision). Both happen; suppression is the additional permanent block.
- **Bounce after the lead already REPLIED/DONE:** `getTrackedThreads` still tracks non-`REPLIED`/`UNSUBSCRIBED` leads; a late bounce on a `DONE` lead flips it to `BOUNCED` (acceptable). A bounce on an already-`REPLIED` lead is ignored (thread no longer tracked).
- **LLM detector unavailable** (no `ANTHROPIC_API_KEY` / API error): fail safe → treat as **not** opt-out (kind stays `REPLY`), log a warning; never block the poller. (Keyword is the always-available default.)
- **Keyword false positive/negative:** acceptable in SUGGEST (human confirms); in AUTO the org opted into the risk. Negation ("nie wiem czy nie jestem zainteresowany") is a documented limitation of the keyword detector.
- **Auto-reply loop:** OOO ignored means no reply event, so no risk of treating an autoresponder as engagement.

## 11. Testing strategy

- **Unit (pure):** `classifyInbound` (bounce via from/subject/failed-recipients; OOO via Auto-Submitted/Precedence/subject; else reply) and `keyword` detector (phrase hits, diacritic stripping, non-match, documented negation gap) and the per-type decision mapping.
- **Boundary (mocked):** `llm` detector with a mocked Anthropic client; `gmail-history` snippet/header fetch with mocked `googleapis`.
- **Poller:** follow 5a's mocked-boundary style for the branch behaviors (bounce → BOUNCED no-replied-event; OOO → ignored; opt-out SUGGEST flag vs AUTO suppress).
- **Manual action:** `markDoNotContact` is a `use server` module (not unit-tested per repo convention); covered by tsc + the live e2e.
- **Live e2e (user-run):** send to a known-dead address → bounce → `BOUNCED` + badge, not `REPLIED`; reply "nie jestem zainteresowany" with `SUGGEST` → badge "możliwa rezygnacja" → click "Nie kontaktować" → in `Suppression`, lead `UNSUBSCRIBED`; (optional) flip `AUTO` → auto-suppressed.
- Gates: `tsc` 0, `vitest` green, `next build` green.

## 12. Verification gates (read official docs before coding — standing rule)

- **Gmail API (googleapis 173.x):** whether `users.messages.get format:"metadata"` returns `snippet` (else use `format:"full"`); requesting `Auto-Submitted`/`Precedence`/`X-Failed-Recipients` via `metadataHeaders`; DSN/bounce shape.
- **Anthropic SDK (LLM detector):** current SDK + model id + prompt caching idioms (use the claude-api guidance; cheap model; cache the system prompt). Fail-safe on missing key/error.
- **Prisma 7.8:** additive `migrate dev` for the new enums + fields.
- Reconfirm `runLeadSequence`'s `HARD_STOP` already includes `BOUNCED`/`UNSUBSCRIBED` (so suppression self-stops in-flight followups).

## 13. New / changed files (proposed)

```
prisma/schema.prisma                       # OptOutMode, OptOutDetector, InboundKind enums; Organization.optOut*; Message.inboundKind (+ migration)
features/replies/classify.ts               # NEW pure classifyInbound                    (+ classify.test.ts)
features/replies/optout/index.ts           # NEW detector interface + getDetector
features/replies/optout/keyword.ts         # NEW pure keyword detector                   (+ keyword.test.ts)
features/replies/optout/llm.ts             # NEW Anthropic boundary detector             (+ mocked test)
features/replies/gmail-history.ts          # MODIFY: fetch snippet + Auto-Submitted/Precedence/X-Failed-Recipients
lib/inngest/replies.ts                     # MODIFY: classify + per-type branch (replaces unconditional recordReply)
features/replies/queries.ts                # MODIFY: record inbound with kind/snippet; per-type writes
features/suppression/actions.ts            # MODIFY: add markDoNotContact server action
features/org/settings.ts                   # NEW: setOrgInboundSettings (mode + detector)  (+ pure validation test if any)
app/(app)/ustawienia/page.tsx              # NEW: minimal settings page (two selects)
app/(app)/kampanie/[id]/sequence-and-leads.tsx  # MODIFY: snippet + kind badge + "Nie kontaktować" button
app/(app)/<nav>                            # MODIFY: nav link to /ustawienia
```

## 14. Out of scope (explicit)

- Unsubscribe link + `List-Unsubscribe` header → later.
- Auto-suppress on bounce → later (manual for now).
- A self-trained "CUSTOM" opt-out model → bonus, separate project (SUGGEST data is its training set).
- Polished visual/UX design → separate session (dedicated Claude-Design prompt) / Phase 7.
- Sender-identity-as-a-feature (enforced footer) → operators use template content.
