# Phase 5c — Live e2e walkthrough (user-run, step by step)

> **For the assistant resuming after a `/clear`:** Phase 5c (smarter inbound: bounce + opt-out + RODO) is implemented and verified at the code/test/build level (`tsc` 0, `vitest` 99/99, `next build` green — see ROADMAP). What remains is this **live Gmail e2e**, which the user runs on their machine. Walk the user through it **one scenario at a time**, wait for their result before moving on, and offer to fix anything that misbehaves. Keep it friendly and concrete (the user appreciated that style for the 5b e2e). Start with Scenario A (opt-out SUGGEST) — it is the highest-value, easiest path.

## What 5c added (so you know what we're verifying)
Every inbound email is now classified: **bounce** → lead `BOUNCED` (no longer counted as a reply — the 5a bug fix); **auto-reply / OOO** → ignored (sequence continues); **opt-out** ("nie zainteresowany") → detected by a keyword (default) or LLM detector, gated by a per-org mode **OFF / SUGGEST / AUTO** set at `/ustawienia`. Plus a manual **„Nie kontaktować"** button + a leads/replies list on the campaign page. Suppress/bounce flips the lead to a HARD_STOP status, so in-flight followups self-stop.

## The three windows + terminal
- **App:** `http://localhost:3000` — campaign at `/kampanie/<id>` (the „Przychodzące" list + badges live here), settings at `/ustawienia`, suppression list at `/suppression`.
- **Inngest dev panel:** `http://localhost:8288` — where you **Invoke** `scan-mailboxes-for-replies` to force a reply scan.
- **Gmail `nzzhry@gmail.com`:** all outbound reroutes here (`SEND_OVERRIDE_TO`); you reply from here.
- **Terminal** (in the project root) for the helper scripts.

## Helper scripts (already in repo, committed)
- `npx tsx scripts/seed-test-campaign.ts` — idempotent reset: campaign **"Test 5b"** (2 steps, lead PENDING), clears its Messages. Pass `always` to make step 1 `ALWAYS` (not needed for 5c).
- `npx tsx scripts/test-mode.ts on` — mailbox 24/7 window + ~2-3 min gap (so you have time to reply/Invoke). `off` restores production (Mon-Fri 08-16, 180-600s) — **run `off` when done**.
- `npx tsx scripts/test-ids.ts` — prints current campaign/lead/mailbox IDs + `CampaignLead.status`/`currentStep`/`repliedAt` (read-only). Run this to get the campaign id for the URL and to check results.

## Setup (once)
1. Dev server on `:3000` (`npm run dev`) and `npx inngest-cli dev -u http://localhost:3000/api/inngest` both running.
2. `npx tsx scripts/test-mode.ts on`
3. `npx tsx scripts/test-ids.ts` → note the **"Test 5b"** campaign id → its page is `http://localhost:3000/kampanie/<id>`. (As of the last session the id was `cmpvkpvaw0003gcv29x9vud8a`, mailbox `snappifyacc@gmail.com` / `cmpuy2tcp0000lwv2gyupytzw` — but re-run test-ids to be sure.)

---

## Scenario A — opt-out SUGGEST (start here)
1. App → `/ustawienia` → **Wykrywanie rezygnacji = SUGGEST**, **Metoda = Lista fraz** → Zapisz.
2. Terminal: `npx tsx scripts/seed-test-campaign.ts` (clean reset).
3. Campaign page → refresh → **„Aktywuj wysyłkę"**.
4. Gmail (nzzhry@) → wait for the **„Test 5b - krok 0"** mail → **reply** with `nie jestem zainteresowany` and send.
5. Inngest panel (`:8288`) → function **`scan-mailboxes-for-replies`** → **Invoke** (empty `{}`).
6. Campaign page → refresh → **„Przychodzące"** section → the lead shows status `REPLIED` + a badge **„możliwa rezygnacja"** + the reply snippet.
7. Click **„Nie kontaktować"** on that lead.
8. Verify: `/suppression` now lists `lead5b@example.com` (reason UNSUBSCRIBED); `npx tsx scripts/test-ids.ts` shows the lead `status: 'UNSUBSCRIBED'`.

**Pass = badge „możliwa rezygnacja" appeared, and the click moved the lead to Suppression/UNSUBSCRIBED.**

## Scenario B — opt-out AUTO (auto-suppress, no click)
1. `/ustawienia` → mode **AUTO** → Zapisz.
2. `npx tsx scripts/seed-test-campaign.ts` → activate → reply „nie jestem zainteresowany" to the new krok 0 → Invoke `scan-mailboxes-for-replies`.
3. Verify WITHOUT clicking anything: `test-ids.ts` shows the lead `UNSUBSCRIBED` and `/suppression` has the email. **Pass = auto-suppressed by the system.**

## Scenario C — auto-reply / OOO ignored
1. (Any mode.) `seed-test-campaign.ts` → activate → reply to krok 0 with the **subject** changed to `Automatyczna odpowiedź: jestem nieobecny` (body anything) → Invoke poller.
2. Verify: the lead is **NOT** `REPLIED` (stays `ACTIVE`/`DONE`), no „odpowiedź" badge — it was classified as an auto-reply and ignored, so the followup keeps going. **Pass = OOO did not stop the sequence.**

## Scenario D — bounce (optional, trickiest)
`SEND_OVERRIDE_TO` reroutes every send to `nzzhry@gmail.com` (a valid inbox), so a normal send never bounces. The bounce *classification* is unit-tested (`features/replies/classify.test.ts`). To exercise it live:
1. In `.env`, temporarily set `SEND_OVERRIDE_TO` to a guaranteed-dead address (a made-up local part at a domain that hard-rejects unknown recipients). **Restart `npm run dev`** (env loads at start).
2. `seed-test-campaign.ts` → activate → the send bounces → the DSN (from `mailer-daemon`) arrives in the connected mailbox `snappifyacc@gmail.com`.
3. Inngest → Invoke `scan-mailboxes-for-replies`.
4. Verify: lead `BOUNCED`, „Przychodzące" badge **„odbicie"**, and **no** `campaign/lead.replied` event (bounce is not a reply).
5. **Restore** `SEND_OVERRIDE_TO=nzzhry@gmail.com` and restart dev.

## Cleanup (after testing)
- `npx tsx scripts/test-mode.ts off` (restore conservative send window/gaps).
- Set `/ustawienia` back to **OFF** if you don't want auto-detection running.
- Restore `SEND_OVERRIDE_TO` if you changed it for Scenario D.

## Gotchas (this machine)
- **Neon sleeps:** the serverless DB suspends after idle; the first command after a break may `P1001` — just retry, it wakes.
- **OAuth/mailbox:** if no mail goes out, check the Inngest panel for a red `run-lead-sequence`/`send` run — usually the mailbox OAuth token expired; reconnect at `/skrzynki`.
- **Port:** keep coldmailing's dev on `:3000` (the GCP OAuth redirect is fixed to `:3000`).
- **Duplicate test mails:** the inbox accumulates several „Test 5b - krok 0" over runs — always reply to the **newest** one, or the reply lands on an untracked thread.
- **LLM detector (Metoda = LLM):** needs `ANTHROPIC_API_KEY` in `.env`; without it the detector fail-safes to "not opt-out" (so SUGGEST/AUTO would never flag). Use **Lista fraz** unless a key is set. Model is `claude-haiku-4-5` (cheap) — switch to `claude-opus-4-8` in `features/replies/optout/llm.ts` for max accuracy.

## After the e2e
Update the ROADMAP: mark 5c **live e2e DONE** (which scenarios passed), then NEXT = Phase 6 (sales pipeline). Two flagged follow-up tasks exist (poller idempotency / dup inbound Message on retry; the pre-existing Phase-4 retry-stomp) — address before high volume, not blocking.
