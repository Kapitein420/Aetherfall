# Aetherfall — Canonical Rules

> **Source of truth** for game systems. Every engine change should reconcile against this doc.
> **Date pinned:** 2026-05-04
> **Origin:** Reference images shared by Noah; transcribed and structured here for code-readable cross-reference.
> **Companions:** [`research-card-game-ux.md`](research-card-game-ux.md), [`ux-improvement-plan.md`](ux-improvement-plan.md).

---

## Table of contents

1. [Core gameplay loop](#1-core-gameplay-loop)
2. [Energy system](#2-energy-system)
3. [Threat system](#3-threat-system)
4. [Element tokens](#4-element-tokens)
5. [Element combinations](#5-element-combinations)
6. [Party Deck](#6-party-deck)
7. [Class starter decks](#7-class-starter-decks)
8. [Symbol legend](#8-symbol-legend)
9. [Design goals](#9-design-goals)
10. [Implementation status](#10-implementation-status)

---

## 1. Core gameplay loop

| Step | What happens |
|---|---|
| 1 | Draw **2 Party Cards** into the shared Party Deck zone |
| 2 | Players take their actions (play class cards, build threat, spend energy) |
| 3 | Anyone can play a Party Card (or hold it for later) |
| 4 | Monsters act based on **current** threat (highest threat wins target) |
| 5 | End of turn: **threat −3** (minimum 0), **except fixated players do not lose threat** |

Players act first, then monsters. Up to **4 players** per fight; up to **3 monsters** per fight.

---

## 2. Energy system

| Property | Rule | Variation |
|---|---|---|
| **Base energy** | 4 per turn | Gained at start of turn |
| **Energy usage** | Spend to play cards/items | Cards have unique costs |
| **Infusion** | Extra energy enhances cards | Linear · Threshold · Branching scaling |
| **Infusion limits** | Diminishing returns | Extra energy becomes less efficient |
| **Unused energy** | Converts to a **buff** | No raw carryover |

### Infusion scaling shapes

These are the three patterns extra-energy boosts can follow on a card. Each card declares which one it uses.

- **Linear** — every extra energy adds a constant bonus. Example: "+1 damage per extra energy infused (max 3)".
- **Threshold** — bonus unlocks at a specific extra-energy amount. Example: "If infused with 2+ extra energy, also draw a card."
- **Branching** — extra energy unlocks alternate effects. Example: "Infuse 1 → +block; infuse 2 → +block + heal."

### Unused-energy buff

End-of-turn unused energy → a temporary buff (definition TBD; suggestion: per unused energy point, gain +1 strength stack consumed by the next card you play, max 3).

---

## 3. Threat system

### Threat sources

| Source | Threat gained |
|---|---|
| **Damage** | +1 per damage point dealt |
| **Taunt** | +5 threat |
| **Heal** | +1 per 2 healing |
| **Killing Blow** | +5 threat on **other** monsters |

Per-monster threat tracker, range **0–20**, fixate threshold at **15**.

### Fixate (≥15 threat)

- Lasts **2 rounds**; target is fixed.
- Fixated monster gains **Enrage** (extra damage modifier on the fixated player).
- Other players: **−1 threat on their actions** while fixate is active.
- The fixated player **does NOT lose threat during end-of-round decay**.
- After fixate ends: **halve** that player's threat.

### Dual Punishment

- During an active Fixate, if **another** player also reaches ≥15 threat → trigger Punishment.
- Effect comes from the monster card (varies by monster).
- Stacks possible per player.

### Turn order & target selection

1. Players act.
2. Monsters act.
3. Each monster targets the player with the **highest current threat against that monster**.
4. End of round: −2 threat (minimum 0), except fixated players don't decay.

---

## 4. Element tokens

Three tokens. Each has an **always-on passive** while held; tokens **stack**; they are **spent ("Infused")** to enhance cards.

### Bio-Growth (green) — Adaptive Biomass / Regeneration

| Property | Rule |
|---|---|
| Passive | Your healing actions heal **+1 additional** health |
| Token Generation | After you are **targeted by a monster**, gain **1** Bio-Growth token |
| Token Use | Used to enhance item and ability cards (Infusion) |

### Hydroflow (blue) — Fluid Systems / Regulation

| Property | Rule |
|---|---|
| Passive | When you would gain **2+ threat**, reduce by **1** |
| Token Generation | Whenever you move **5+ threat** from one player to another, gain **1** Hydroflow token |
| Token Use | Used to enhance item and ability cards (Infusion) |

### Storm Charge (purple) — Energy Grid / Overload

| Property | Rule |
|---|---|
| Passive | The **first damage action you resolve each turn** deals **+1 damage** |
| Token Generation ("Overload") | _Disabled per balance call (2026-05-05) — no auto-grant from threat gain._ |
| Token Use | Used to enhance item and ability cards (Infusion) |

---

## 5. Element combinations

These effects fire while a player **holds at least one of each** of two element types. They unlock automatically — no extra spend required to activate the combination effect itself, though some combo effects also generate tokens or trigger spends.

### Adaptive Control — Bio-Growth + Hydroflow

- Convert up to **4 threat** from a player into healing, distributed among players.
- The next time a player would gain **5+ threat**, reduce it to **2** instead.
- If this prevention triggers, gain **1 Bio-Growth token**.

### Conductive Surge — Hydroflow + Storm Charge

- When you move threat from one player to another, deal damage equal to the amount moved to a monster.
- You may **choose the target** of this damage.
- If 5+ damage is dealt this way, gain **1 Storm Charge token**.

### Overgrowth Chain — Bio-Growth + Storm Charge

- When you deal damage, **heal for half** the damage dealt (rounded down).
- When you deal **5+ damage** in a single action, gain **1 Bio-Growth token**.
- If **10+ damage** in a single action, gain **2 Bio-Growth tokens** instead.

---

## 6. Party Deck

> "Random events. Shared fate. Strategic chaos."
> Each turn, draw 1–2 Party Cards that any player can activate. Effects can help, hinder, or change the battlefield for everyone.

### Core rules

- Draw **1–2 Party Cards** each turn.
- **Anyone** can play the card.
- Most cards cost **0–2 energy**.
- Effects shared across the party or affect the battlefield.
- Some cards can be **Infused** with Elements for extra effects.

### Deck balance

- **60% positive · 25% neutral · 15% negative**.

### Categories

The Party Deck has 8 sections:

1. **Damage** — damage to enemies; many scale with party actions or threat.
2. **Block / Defense** — protect the party and mitigate incoming damage.
3. **Buffs** — empower the party.
4. **Debuffs** — disrupt the party or empower enemies.
5. **Auras** (Persistent Effects) — remain in play and affect the battlefield until replaced or removed.
6. **Fusion-Based Party Cards** — synergize with dual-element systems; require 2 element infusions to play.
7. **Risk / Chaos Cards** — high risk, high reward… or disaster.
8. **Party Deck Interaction Options** — players can manipulate the deck itself.

### Sample card list

#### Damage

| Cost | Name | Effect |
|---|---|---|
| 1 | **Overcharge Pulse** | Deal 3 damage to all enemies. If any player has 15+ threat, deal **double damage** instead. |
| 1 | **Chain Reaction** | Deal 2 damage to all enemies for **each card played by the party this turn**. |
| 2 | **Friendly Fire Protocol** | Deal 6 damage to all enemies. Deal 2 damage to all players. |

#### Block / Defense

| Cost | Name | Effect |
|---|---|---|
| 1 | **Emergency Barrier** | All players gain **5 block**. |
| 1 | **Threat Shield** | The highest-threat player gains block equal to their **current threat**. |
| 1 | **Adaptive Cover** | Gain **3 block**. Double this amount if **no player spent all energy** this turn. |

#### Buffs

| Cost | Name | Effect |
|---|---|---|
| 1 | **Overclock Sync** | All players gain **+1 damage** this turn. If all players spent all energy, gain **+2 damage** instead. |
| 1 | **Network Efficiency** | The first card each player plays next turn costs **−1 energy**. |
| 1 | **Bio Surge** | Heal 2. Gain **+1 strength per unused energy** among all players. |

#### Debuffs

| Cost | Name | Effect |
|---|---|---|
| 1 | **System Lag** | All players' next card costs **+1 energy**. |
| 1 | **Threat Spike** | All players gain **+3 threat**. |
| 1 | **Corrupt Signal** | Random player loses **1 energy** next turn. |

#### Auras (persistent until replaced/removed)

| Cost | Name | Effect |
|---|---|---|
| 1 | **Static Field** | All Overclock effects deal **+2 damage**. Players gain **+1 threat when using ⚡**. |
| 1 | **Data Stream** | The first card each turn that a player plays draws **1 extra card**. |
| 1 | **Growth Protocol** | At the end of each turn, players with unused energy gain **2 Regen**. |
| 1 | **Chaos Field** | All Infusion effects are **randomized**. |

#### Fusion-based (2 elements required)

| Cost | Elements | Name | Effect |
|---|---|---|---|
| 2 | ⚡+❄ | **EMP Field** | All enemies lose targeting for 1 turn. Reset all players' threat to 5. |
| 2 | ❄+🌿 | **Neural Network** | Share all positive buffs between players. Draw 1 card. |
| 2 | ⚡+🌿 | **Mutation Zone** | All damage is increased by 1 for each 5 total threat among players. |

#### Risk / Chaos

| Cost | Name | Effect |
|---|---|---|
| 2 | **Overload Protocol** | All players gain **+2 energy**. At the start of your next turn, **lose 2 energy**. |
| 1 | **Fixate Event** | The highest-threat player becomes **Fixated immediately** for 1 turn. |
| 1 | **Jackpot Cache** | Choose one at random: gain a powerful buff · gain a massive debuff. |

#### Party Deck Interaction Options

Players can spend resources or actions to manipulate the deck itself.

| Action | Effect |
|---|---|
| **Peek Ahead** | Look at the next Party Card. |
| **Discard** | Discard the current Party Card and draw a new one. |
| **Duplicate** | Duplicate the current Party Card's effect. |
| **Infuse** | Infuse the Party Card with up to **2 Elements**. |

---

## 7. Class starter decks

Each class has a starter deck themed around one element token's identity.

### Storm Forge (Storm Charge — Aggression)

**Theme:** "Aggression fuels power. Strike hard, risk higher."
**Element affinity:** Storm Charge.
**Deck contents (10 cards total):**

| Cost | Name | Copies | Effect |
|---|---|---|---|
| 1 | **Basic Attack** | ×4 | Deal **1 damage**. ⚡ Gain +1 damage from Storm passive. ⊙ Spend 1 token to gain +1 damage. |
| 1 | **Basic Defend** | ×4 | Block **2 damage**. ⊙ Spend 1 token to gain +1 block. |
| 2 | **Power Strike** | ×1 | Deal **3 damage**. ⚡ Enhanced by Storm passive. |
| 2 | **Surge Channel** | ×1 | Deal **1 damage**. ⊙ Gain **1 Storm Charge token**. |

**Notes on iconography on cards:**
- ⚡ icon = "uses Storm passive bonus"
- ⊙ (token spend icon) = "spend a held token to enhance this card"

### Bio-Growth and Hydroflow starter decks

To be designed; should mirror the Storm Forge structure with thematic differences:

- **Bio-Growth (Sustain / Regeneration):** focus on healing, defensive plays, threat absorption.
- **Hydroflow (Control / Manipulation):** focus on threat redirection, soft control, support.

---

## 8. Symbol legend

| Icon | Meaning |
|---|---|
| ✦ red | Damage |
| 🛡️ blue | Block |
| ⬆ green | Buff |
| 💀 magenta | Debuff |
| ◎ orange | Aura (persistent) |
| ⚡ yellow | Energy / Storm Charge |
| ⚠ red | Threat |
| ⟳ cyan | Infusion / Fusion |

Element-token shorthand:
- 🌿 green = Bio-Growth
- ❄ blue = Hydroflow
- ⚡ purple = Storm Charge

---

## 9. Design goals

1. **Create dynamic moments every turn** — Party Deck draws make every round feel different.
2. **Encourage team coordination** — anyone-plays Party Cards, element combinations, and the threat system reward party-wide thinking.
3. **Interact with Threat, Energy & Infusion systems** — every system feeds the others (energy enables Infusion, Infusion uses tokens, tokens come from threat dynamics, etc.).

---

## 10. Implementation status

Where each rule lives in code today (or notes for what's still required).

| Rule | Status | Where (or what's needed) |
|---|---|---|
| Players act first, then monsters | ✅ | [`src/engine/game.js`](../src/engine/game.js) `resolveRound` → `resolveMonsterTurn` |
| End-of-round threat decay −2 | ✅ | [`src/engine/game.js`](../src/engine/game.js) `THREAT_DECAY = 2` |
| Fixate ≥15 threat for 2 rounds | ✅ | `FIXATE_THREAT_THRESHOLD = 15`, `FIXATE_DURATION = 2` |
| Halve threat after fixate ends | ✅ | `decayFixate` |
| Heal → threat (+1 per 2 healing) | ✅ | `resolveAction` heal branch — `Math.floor(healed / 2)` (Decision 1, PR #23) |
| Damage → threat (+1 per damage) | ✅ | `dealMonsterDamage` adds `finalDamage` to threat |
| Fixated player skips end-of-round decay | ✅ | `startNextRound` skips `decayThreat` for the fixated player (PR #21) |
| Other players: −1 threat on actions during fixate | ✅ | `addThreat` reduces by 1 for non-fixate players (PR #21) |
| Taunt action type (+5 threat) | ✅ | `resolveAction` taunt branch (PR #21) |
| Killing blow: +5 threat on other monsters | ✅ | `dealMonsterDamage` iterates `state.monsters` survivors (PR #33) |
| Enrage on fixated monster | ✅ | `resolveMonsterTurn` adds `monster.enrageDamageBonus` (default 3) to fixate-target hits (PR #29) |
| Dual Punishment | ✅ | `addThreat` calls `triggerDualPunishment` on cross-threshold; per-monster `dualPunishment` override (PR #29) |
| Multi-monster (1–3 monsters) | 🟡 | `state.monsters[]` array exists with `state.monster` aliasing primary; helpers `primaryMonster`, `livingMonsters`. UI/turn iteration still primary-only — content can extend (PR #33). |
| 4-player support | ✅ | Setup screen 2/3/4 picker, dynamic standoff/hand-shelf grid (PR #25) |
| Energy: base 4 | ✅ | `STARTING_ENERGY = 4` (PR #26) |
| Energy: no carryover | ✅ | `startNextRound` resets `player.energy = STARTING_ENERGY` (PR #26) |
| Unused energy → buff | ✅ | Surge stacks (+1 dmg per stack, cap 3 per turn, decay 3 — PR #26) |
| Infusion (linear/threshold/branching) | ❌ | DEFERRED — gated on canonical token-themed starter decks |
| Element tokens (3 types) | ✅ | `player.tokens` bag, passives + generation triggers (PR #28) |
| Element combinations | ✅ | Adaptive Control / Conductive Surge / Overgrowth Chain auto-fire; `moveThreat` action; Hydroflow generation (PR #31) |
| Token UI surfacing | ✅ | `.token-chip` cluster on each player plate, element-color SVG icons (PR #34) |
| Party Deck (canonical, per-turn draw) | ✅ | `state.partyHand`, `drawPartyCards`, per-round draw, anyone-plays. Blessing draft retired (Decision 2, PR #30) |
| Party Deck — Auras (persistent) | 🟡 | `state.activeAuras` slot + `aura.onEndOfRound` hook exist; per-aura logic only partially wired (PR #30) |
| Party Deck — Fusion cards | 🟡 | Data scaffolded; effects gated on multi-monster targeting + Infusion |
| Party Deck — Risk/Chaos | 🟡 | `forceFixateHighestThreat` shipped (Fixate Event); Overload Protocol + Jackpot Cache effects deferred |
| Party Deck Interactions (peek/discard/duplicate/infuse) | ❌ | UI + engine wiring not yet built |
| Class starter decks (Storm Forge etc.) | 🟡 | Storm Forge data in `src/content/storm-forge.js`; not yet in `selectableClasses` (gated on Infusion) |
| Hollow Titan boss | ✅ | `src/content/monsters.js` |
| Ironjaw Bruiser boss | ✅ | `src/content/monsters.js` |
| Warden of Targeting boss | ✅ | `src/content/monsters.js` |
| Hollow Titan portrait art | ✅ | `assets/ui/monsters/hollow-titan.png` (PR #14) |
| Compact battle UI (corner log + fixed action bar + party pill) | ✅ | PRs #17, #36, #39 |
| Visual identity v1 (element color+shape, palette tokens, hex frames) | ✅ | `src/content/element-icons.js` (PR #27) |
| Hand-focus toggle | ✅ | Click player name; others collapse (PR #32) |
| Drag-and-drop disabled (click-to-queue only) | ✅ | `DRAG_AND_DROP_ENABLED = false` flag in `src/app.js` (PRs #37, #38) |
| Orphan statuses stripped (exposed/weakened/tracked) | ✅ | Decision 3, PR #24 — 17 cards rewritten to canonical actions |
| Layout stability when queueing cards | ✅ | Queue strip absolute-positioned; message-bar slot reserved (PR #39) |

---

## 11. Sequenced refactor plan — ALL STEPS SHIPPED

The original 7-step plan is complete. Each landed via the noted PR.

| # | Step | Status | PRs |
|---|---|---|---|
| 1 | Threat-rule tightening (fixate skip-decay, −1 actions while fixated, taunt action type) | ✅ shipped | [#21](https://github.com/Kapitein420/Aetherfall/pull/21), [#23](https://github.com/Kapitein420/Aetherfall/pull/23), [#24](https://github.com/Kapitein420/Aetherfall/pull/24) |
| 2 | Energy rework (base 4, no carryover, surge buff) | ✅ shipped | [#26](https://github.com/Kapitein420/Aetherfall/pull/26) |
| 3 | Element token system (passives + generation + combinations) | ✅ shipped | [#28](https://github.com/Kapitein420/Aetherfall/pull/28), [#31](https://github.com/Kapitein420/Aetherfall/pull/31), [#34](https://github.com/Kapitein420/Aetherfall/pull/34) |
| 4 | Multi-monster support (`state.monsters[]`) | 🟡 schema only | [#33](https://github.com/Kapitein420/Aetherfall/pull/33) — content can extend when designing a multi-monster encounter |
| 5 | Party Deck (canonical) replaces blessing draft | ✅ shipped | [#30](https://github.com/Kapitein420/Aetherfall/pull/30) |
| 6 | 4-player support | ✅ shipped | [#25](https://github.com/Kapitein420/Aetherfall/pull/25) |
| 7 | Enrage + Dual Punishment + Killing Blow | ✅ shipped | [#29](https://github.com/Kapitein420/Aetherfall/pull/29), [#33](https://github.com/Kapitein420/Aetherfall/pull/33) |

## 12. Remaining open work

After Steps 1-7, the canonical surface is largely live. What's left:

1. **Infusion mechanic** — cards spending tokens for enhanced effects (linear/threshold/branching scaling). Gated on designing the canonical token-themed starter decks (Storm Forge / Verdant Reach / Tideflow Engineer) since those are where Infusion lives.
2. **Aura per-card effects** — `state.activeAuras` slot exists with `onEndOfRound` hook. Static Field, Data Stream, Growth Protocol, Chaos Field still need their per-aura logic wired.
3. **More Party Deck card effects** — Fusion cards (need multi-monster targeting), buff-stack-driven cards (Overclock Sync, Network Efficiency, Bio Surge, Mutation Zone), debuff-flag cards (System Lag, Corrupt Signal, Overload Protocol). Foundation for these is a small "buff/debuff stack" engine layer that doesn't exist yet.
4. **Party Deck Interactions UI** — Peek Ahead, Discard, Duplicate, Infuse. Engine + UI work.
5. **Multi-monster turn iteration + per-monster threat baseplate UI** — when a real multi-monster encounter is designed.

The [`ux-improvement-plan.md`](ux-improvement-plan.md) sprints (input parity, info surface, co-op transparency, feel polish) can resume in parallel with the above.
