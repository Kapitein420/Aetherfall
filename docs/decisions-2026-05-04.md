# Design Decisions — 2026-05-04 (evening)

> Three rule decisions Noah locked in after the council audit. Pinned for the
> follow-up PRs that will execute them.

## 1. Heal → threat rounding: **canonical-strict (floor)**

**Change:** `Math.ceil(healed / 2)` → `Math.floor(healed / 2)` in `resolveAction`'s heal branch (`src/engine/game.js:343`).

**Effect:** A 1 HP heal generates **0** threat. A 2 HP heal generates 1. A 3 HP heal generates 1. A 4 HP heal generates 2.

**Why:** Canonical rule wording is "+1 per 2 healing." Floor is the intuitive read; ceil was an off-by-one drift.

**Where to ship:** Bundled with Step 1 (Team A's PR) if reachable; otherwise a 1-line follow-up PR after Team A merges.

## 2. Blessings: **remove and replace with Auras**

**Change:** Strip the per-fight Blessing Draft system entirely and let the canonical Auras (Static Field / Data Stream / Growth Protocol / Chaos Field) cover persistent battlefield effects.

**What gets removed:**
- `src/content/blessings.js` — the 10-blessing registry.
- `renderDraft` and the draft action handlers (`select-blessing`, `confirm-blessing`, `back-to-setup`) in `src/app.js`.
- `state.blessingId` / `state.blessingFlags` in `src/engine/game.js`.
- All blessing-flag reads scattered in `queueCard` (Crit Vision discount), `dealMonsterDamage` (Glass Cannon), `resolveCard` (onCardResolve hook), `startNextRound` (energyCapBonus / threatDecayBonus / onRoundStart hook).
- The active-blessing chip in the action bar (`renderActionBar`'s `ab-blessing` block).

**What replaces it:** Canonical Auras drawn from the Party Deck per turn. Auras are persistent until replaced/removed, played by any party member, and live in the Party Deck registry already (`src/content/party-deck.js`'s `category: "aura"` cards).

**Sequencing:** This is conceptually part of **Step 5** (Party Deck implementation) in the canonical refactor plan. Strip blessings *as part of* that step so we don't have a dead window with no persistent buffs available.

**Implementation order when Step 5 lands:**
1. Wire `src/content/party-deck.js` into the engine (per-turn draw, anyone-plays).
2. Implement Aura mechanics (persistent state slot, replace-or-stack semantics).
3. Remove the blessing draft system.
4. Update the canonical-rules doc to record the removal.

## 3. Orphan statuses: **strip**

**Statuses to strip:** `exposed`, `weakened`, `tracked`.

**Why:** They are pre-canonical leftovers not named in `canonical-rules.md`. Noah's call is to remove rather than canonicalize them — keeps the rules surface tight to the doc.

**Engine code to remove:**
- `src/engine/game.js`:
  - The `expose` action branch in `resolveAction` (~line 386).
  - The `weaken` action branch in `resolveAction` (~line 374).
  - `consumeExposedBonus` helper.
  - `state.monster.statuses.exposed` / `state.monster.statuses.weakened` initialization in monster factories.
  - The exposed-bonus damage-amplification branch in damage resolution.
  - The weakened reduction in `resolveMonsterTurn` (`weakenConsumed` flag and `monster.statuses.weakened` read).
  - The `tracked` amplification branch in `addThreat`.
  - `applyWardenSurveillance` and its call in `startNextRound` (Warden's tracked-application).
- `src/content/monsters.js`:
  - Remove `statuses: { exposed: 0, weakened: 0 }` initialization from monster factories.
  - Warden of Targeting's surveillance phase becomes purely passive (or phase-1 gets a different mechanic).
- `src/content/cards.js`:
  - Identify and rewrite/remove cards with `expose` or `weaken` actions. Replace mechanics with canonical alternatives where appropriate (block, damage, threat manipulation).

**Card audit needed before stripping:** grep for `type: "expose"` and `type: "weaken"` in `cards.js`; each card needs a redesigned action set or removal.

**Sequencing:** Run as a discrete cleanup PR after Step 1 (threat tightening) lands. Independent of Steps 2-7.

**Risk:** Warden of Targeting becomes a less interesting boss without `tracked`. Phase 1 (Surveillance) loses its on-round tracking effect — replace with a different mechanic or accept the simplification.

**Documentation update:** After this lands, refresh `canonical-rules.md` §10 (implementation status) to remove the orphan rows.

---

## Execution sequence (the long view)

1. **Now (in flight):** Team A (Step 1), Team B (4-player UI, Step 6 partial), Team C (Visual identity v1).
2. **After they merge:** apply Decision 1 (heal floor) if Team A didn't include it.
3. **Then:** Decision 3 (strip orphan statuses) as a discrete cleanup PR.
4. **Then:** Step 2 (energy rework) — base 4, no carryover, unused → buff.
5. **Then:** Step 3 (element token system).
6. **Then:** Step 4 (multi-monster engine refactor).
7. **Then:** Step 5 (Party Deck implementation) **+ Decision 2** (remove blessing draft as part of Party Deck wiring).
8. **Then:** Step 7 (Enrage + Dual Punishment + Killing Blow cross-monster threat).
9. **Then:** UX improvement plan sprints resume (input parity, info surface, co-op transparency, feel polish).
