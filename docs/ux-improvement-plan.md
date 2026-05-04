# Aetherfall — UX Improvement Plan

> **Date:** 2026-05-04
> **Source:** Findings in [`research-card-game-ux.md`](research-card-game-ux.md), filtered for Aetherfall's stack and scope.
> **Constraints we work within:**
> - Browser-only, no build system. Plain ES modules. The site IS the source.
> - 2-player co-op via WebRTC P2P (PeerJS broker). Host drives state.
> - GitHub Pages deploy from `main`. Direct push and force-push to `main` blocked.
> - Painted bespoke PNG card art. No 3D, no engine, no asset pipeline.
> - Engine is event-driven on a per-round queue/resolve cycle. Foundation supports element types, defense, status counters, phase machine, multi-action turns, fixate.

This plan ranks every applicable research finding by ROI and groups them into shippable milestones.

---

## Already shipped ✅ (validates the direction)

These map directly to "universally loved" community patterns. No work needed; tracking what's behind us.

| Pattern | Where in repo | Source PR |
|---|---|---|
| Battle log in a corner widget (latest-first, scrollable, color-coded) | [`renderLogCorner`](../src/app.js), [`.log-corner` CSS](../src/styles.css) | [#17](https://github.com/Kapitein420/Aetherfall/pull/17) |
| Action bar that doesn't block the game scene | [`renderActionBar`](../src/app.js), [`.action-bar` CSS](../src/styles.css) | [#17](https://github.com/Kapitein420/Aetherfall/pull/17) |
| Hover-reveal for secondary controls (mid-fight only; auto-pinned at game-over) | `.ab-utility` CSS | [#17](https://github.com/Kapitein420/Aetherfall/pull/17) |
| Hover-reveal for idle multiplayer panel + collapsed log | `.mp-panel.mp-state-idle`, `.log-corner-list` CSS | [#17](https://github.com/Kapitein420/Aetherfall/pull/17) |
| Basic monster intent telegraph | `renderMonsterIntent`, `computeMonsterIntent` | PR [#4](https://github.com/Kapitein420/Aetherfall/pull/4) |
| Phase machine with HP-threshold transitions (foundation for telegraphing future phases) | [`src/engine/game.js`](../src/engine/game.js) `checkPhaseTransition` | [#13](https://github.com/Kapitein420/Aetherfall/pull/13) |
| Per-fight blessing chip (relic-equivalent visible during fight) | `.ab-blessing` in action bar | [#16](https://github.com/Kapitein420/Aetherfall/pull/16) |
| Themed card frames per faction | `getChampionVisual`, `.card.class-*` | PR [#9](https://github.com/Kapitein420/Aetherfall/pull/9) |

---

## Sprint 1 — Input parity & cheap accessibility wins (high ROI, low risk)

Fast wins that close the most-cited universal gripes. Can land in 1–2 PRs; no engine changes.

### 1.1 Click-to-cast with auto-target fallback
**Problem:** drag-only excludes trackpad/touch users. Across the Obelisk's #1 review complaint.
**Fix:** every card in hand becomes click-to-cast. Default targeting:
- Damage cards → monster
- Block / heal / draw with `target: "self"` → caster
- Cards with `target: "ally"` → cycle picker (highlight target on hover-after-click, second click confirms)
**Files:** [`src/app.js`](../src/app.js) `handleAction` add `cast-card-default` action, [`src/ui/drag-system.js`](../src/ui/drag-system.js) untouched (drag stays as alternate).
**Acceptance:** Trackpad users can play a full game without ever dragging. Existing drag flow unaffected.

### 1.2 Color + shape for element types
**Problem:** STS lesson — using color alone for element distinction fails colorblind players.
**Fix:** every element-type icon (water/toxic/overclock/net/biohack/spell/physical) gets a unique SVG shape. Element pills on cards and resistance chips on monsters use **icon + color**, never just color.
**Files:** new `src/content/element-icons.js` SVG library, update card frame rendering and `renderMonsterResistances`.
**Acceptance:** Render the page with `filter: grayscale(1)` — every element is still distinguishable by shape.

### 1.3 `prefers-reduced-motion` respect
**Problem:** STS / Hearthstone hammered for not respecting OS-level motion settings.
**Fix:** wrap all animations in `@media (prefers-reduced-motion: no-preference) { ... }` or invert with `(reduce)` overrides that disable transitions/animations for users who request it.
**Files:** [`src/styles.css`](../src/styles.css) — touch animation/transition rules.
**Acceptance:** With `Reduce motion` enabled in OS, all `@keyframes` and `transition` rules become inert.

### 1.4 Text-scale slider
**Problem:** STS's "Larger Text" setting is "negligible." Real scaling needs to multiply font-size proportionally across the UI.
**Fix:** add a CSS custom property `--ui-scale` defaulting to 1. Multiply key font-sizes by `var(--ui-scale)`. Add a small settings menu (gear icon top-left or in setup screen) with 0.85 / 1 / 1.15 / 1.3 presets. Persist to `localStorage`.
**Files:** [`src/styles.css`](../src/styles.css), [`src/app.js`](../src/app.js) settings panel.
**Acceptance:** Picking 1.3 scales card titles, log entries, and action bar text up perceptibly without breaking layout.

### 1.5 Generous target hitboxes
**Problem:** STS sets the bar — "you will never accidentally target the wrong person." Need to verify Aetherfall meets it.
**Fix:** audit `data-target-zone` rects at 1280×720 and 1920×1080. Each player's target zone should be ≥ 200×200px and have ≥ 24px margin between neighbors.
**Files:** [`src/styles.css`](../src/styles.css) `.standoff-flanks .standoff-champion`, `.standoff-monster`.
**Acceptance:** Manual test — drag a card halfway between Lyra and Rook; the system snaps to one cleanly without ambiguity.

**Sprint 1 estimated effort:** 1 day total. PR-able as one bundle "Input parity + cheap a11y wins" or split.

---

## Sprint 2 — Information surface (high ROI, medium effort)

Make every game state visible. Closes the Wildfrost gripe ("hidden state that punishes").

### 2.1 Status icons + tooltips on every entity
**Problem:** Engine has rich status counters (`marked`, `tracked`, `exposed`, `weakened`, etc.) but only a few render to the UI right now.
**Fix:**
- Render every active status on each player and on the monster as a small icon with stack count.
- Hover any icon → tooltip with one-sentence definition + current effect.
- Pin the most-relevant statuses to the player's HP plate; let the rest live in an expandable cluster.
**Files:** [`src/app.js`](../src/app.js) `renderMonsterStatusPips`, new `renderPlayerStatusPips`. New `src/content/status-keywords.js` registry mapping each status key → name, description, icon.
**Acceptance:** Pick Warden of Targeting; once a player gets the `tracked` status, an icon appears on their plate with hover-tooltip showing "Tracked: threat gain amplified by +2 while active."

### 2.2 Boss intent: phase preview + multi-action display
**Problem:** Community asks for *more* intent transparency. STS2's expanded intents (multi-action shown side-by-side) is the bar.
**Fix:**
- Existing intent telegraph shows next attack damage. Extend to show:
  - Each action of a multi-action turn separately (e.g., Warden phase 3 = `9 dmg → Lyra | 9 dmg → Rook`).
  - "Next phase at X% HP" indicator on the monster baseplate.
  - Special phase abilities preview when within 10% of the threshold ("almost: Override Protocol — threat will swap").
**Files:** [`src/app.js`](../src/app.js) `renderMonsterIntent`, `renderMonsterBaseplate`. Engine: extend `computeMonsterIntent` to return per-action and to read `monster.phases` for next-threshold lookup.
**Acceptance:** Run a Warden fight; the baseplate shows "Phase 1 → Phase 2 at 65% HP", and at 70% HP the warning escalates.

### 2.3 Battle log filter + step-through
**Problem:** Community would *cheer* a filterable, replayable log. STS mods exist solely for this.
**Fix:**
- Click the log corner header → expands to a full-screen overlay with all entries.
- Filter chips at top: All / Damage / Status / Phase change / Card use.
- Each "round" group has a "step through" button that animates the round again on the playfield.
**Files:** [`src/app.js`](../src/app.js) new `renderLogOverlay`, `enterLogReplay`. Engine: emit per-round event groups in `state.events` (already partially there).
**Acceptance:** After 3 rounds, click the log header; full overlay opens. Filter by "Phase" — shows only the 1-2 phase entries.

**Sprint 2 estimated effort:** 2-3 days. Best as 2 PRs: "Status icon + tooltip system" and "Battle log overlay + filter."

---

## Sprint 3 — Co-op transparency (high ROI, depends on multiplayer state)

These are Aetherfall's biggest differentiators vs Across the Obelisk. The research is unambiguous: this is where indies leapfrog the established players.

### 3.1 Show your partner's hand
**Problem:** ATO forces players to chat/emote about cards. We can be radically more transparent.
**Fix:**
- During the planning phase, both players see *both* hands.
- Partner's hand renders smaller / dimmed but readable; clicking a partner's card has no effect (visibility only).
- Card art is identical, no hidden info — fits a co-op planning game.
**Files:** [`src/app.js`](../src/app.js) `renderGame` — render both players' `.standoff-hand` for both clients (currently only the local player's hand is interactive). [`src/multiplayer/sync.js`](../src/multiplayer/sync.js) — confirm full state replication includes partner hand (it does, since the host snapshots `state.players[*].hand`).
**Acceptance:** Host hosts, friend joins, both see both hands during planning. Each client can only queue from their own hand.

### 3.2 Synced blessing draft with vote + tiebreak
**Problem:** Today the host alone picks the blessing. ATO's voting+tiebreak pattern is community-loved.
**Fix:**
- Both players see the 3-card draft.
- Each marks their pick. If both agree → confirm enables.
- If they disagree → a 3-second "tiebreak coin" animates; deterministic outcome (maybe the round-1 dealer alternates; or the player with `playerId` lower wins).
- Add a small chat-emote line ("👍 / 👎 / 🤔") so they can negotiate.
**Files:** Extend [`src/multiplayer/sync.js`](../src/multiplayer/sync.js) to broadcast `select-blessing` votes (already done for actions; just needs to surface as a vote indicator), [`src/app.js`](../src/app.js) `renderDraft` to show both votes, new `confirm-blessing` requires both votes.
**Acceptance:** Host picks Iron Aegis, friend picks Quickdraw → tiebreak runs and one wins; both see the same outcome.

### 3.3 Suggest-card / ping emote in planning
**Problem:** ATO's "ability to prompt / suggest cards for the current player" is one of its most-praised co-op features.
**Fix:**
- Hovering a partner's card during the planning phase shows a "💡 Suggest" affordance.
- Click → the card pulses on the partner's screen with "your friend suggests: Iron Aegis."
- Lightweight P2P message via the existing WebRTC channel.
**Files:** [`src/multiplayer/sync.js`](../src/multiplayer/sync.js) extend the action message bus with a `suggest-card` event type, [`src/app.js`](../src/app.js) handle the incoming event by adding a class to the suggested card with a CSS pulse.
**Acceptance:** Friend suggests "Marked Pierce" on host's screen → host sees it pulse blue for 3 seconds with a small annotation.

**Sprint 3 estimated effort:** 2-3 days. Best as 3 PRs since each is independently shippable.

---

## Sprint 4 — Feel polish (medium ROI, low risk)

Pacing and "juice." Less critical than Sprints 1–3 but cumulatively raises the bar.

### 4.1 Skippable / speed-up resolution on repeat fights
**Problem:** Hearthstone is the cautionary tale; STS / Balatro both let players accelerate animations.
**Fix:**
- Add a settings toggle: `Resolution speed: Cinematic / Standard / Fast`.
- Cinematic: full effects, ~250ms per card. Standard: ~120ms. Fast: ~30ms (snap-resolve).
- Default to Cinematic on first fight against a given monster, Standard thereafter.
- Always allow click-anywhere to skip the rest of the round's resolution.
**Files:** [`src/app.js`](../src/app.js) effect timing, [`src/styles.css`](../src/styles.css) animation durations via custom properties.
**Acceptance:** Pick Fast; resolve a round; player phase + monster phase complete in under 1 second total.

### 4.2 Layered audio feedback (queue, resolve, hit, win)
**Problem:** Community loves Balatro's "screen shake, card flip animations, exponentially jumping numbers, rising fire effects, and crisp chip sound effects" stacking. We have visuals but no audio.
**Fix:**
- Tiny audio sprite library: `card-queue.ogg`, `card-resolve.ogg`, `monster-hit.ogg`, `phase-enter.ogg`, `victory.ogg`, `defeat.ogg`.
- Mute toggle in the settings menu.
- Free-license SFX (e.g. Kenney.nl, Freesound CC0).
**Files:** new `src/audio/sound-bus.js`, hook into the engine's event stream (`pushEvent`).
**Acceptance:** Resolving a round triggers card-resolve and monster-hit cues; toggling mute silences everything.

### 4.3 Magnetic hand snap + reorder + memory
**Problem:** Balatro's hand-feel is the indie reference. Our hand uses static positioning.
**Fix:**
- Drag a card within your hand to reorder; snap-into-place animation.
- Persist preferred order to `localStorage` so reshuffles settle to the same arrangement when the same card returns.
**Files:** [`src/ui/drag-system.js`](../src/ui/drag-system.js) extend with intra-hand drag, [`src/app.js`](../src/app.js) hand-render reads ordering map.
**Acceptance:** Drag "Shield Bash" to position 1; reshuffle; "Shield Bash" comes back to position 1.

**Sprint 4 estimated effort:** 2-3 days. Each independently shippable.

---

## Backlog — gated on design decisions

Not in this plan; tracked for later.

- **Run shell + relics + persistent codex** — gated by Q1=c (full meta) which still needs a run-state model.
- **Token system** (Bio-Growth / Hydroflow / Storm Charge) — gated on the combo question (do consumed tokens fuse?).
- **Tutorial-free onboarding** — depends on first-fight design once tokens land.
- **Mobile-first viewport pass** — depends on whether mobile is a target audience.
- **Battle replay video export** — Fights in Tight Spaces does this; nice-to-have but heavy.
- **Boss-by-boss bespoke art** — already a known follow-up; portrait wiring exists.

---

## Ordering recommendation

If we ship one sprint at a time:

1. **Sprint 1 first** (a11y + input parity). Cheap, shippable as one PR or split, and immediately broadens our audience. No risk to existing flows.
2. **Sprint 2 next** (information surface). Status icons + tooltips. The Warden boss already creates `tracked` status counters that aren't surfaced — Sprint 2 fixes that and unblocks more boss design.
3. **Sprint 3 then** (co-op transparency). Biggest differentiator. Requires multiplayer state work but has the most marketing/word-of-mouth value.
4. **Sprint 4 last** (feel polish). Audio, animation speeds, hand magnetism. Nice-to-have but lower priority than the above.

If we want to fan out (multiple agents in parallel), Sprints 1.x items are independent and parallelizable. Sprint 2 has internal dependencies (status icons before log filter). Sprint 3 items are independent.

---

## Tracking

Not creating GitHub issues yet — this doc is the source of truth until we start picking. When a sprint kicks off, convert that sprint's items to issues so the agent fan-out can pick from the issue list.
