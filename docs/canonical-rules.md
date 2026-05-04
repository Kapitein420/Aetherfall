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
4. End of round: −3 threat (minimum 0), except fixated players don't decay.

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
| Passive | Your attacks deal **+1 damage** |
| Token Generation ("Overload") | If you gain **5+ threat during your turn**, gain **1** Storm Charge token |
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
| End-of-round threat decay −3 | ✅ | [`src/engine/game.js`](../src/engine/game.js) `THREAT_DECAY = 3` |
| Fixate ≥15 threat for 2 rounds | ✅ | `FIXATE_THREAT_THRESHOLD = 15`, `FIXATE_DURATION = 2` |
| Halve threat after fixate ends | ✅ | `decayFixate` |
| Heal → threat (+1 per 2 healing) | ✅ | `resolveAction` heal branch — adds `Math.ceil(healed / 2)` |
| Damage → threat (+1 per damage) | ✅ | `dealMonsterDamage` adds `finalDamage` to threat |
| **Fixated player skips end-of-round decay** | ❌ | Need: skip in `startNextRound` `decayThreat` loop |
| **Other players: −1 threat on actions during fixate** | ❌ | Need: read fixate state in `addThreat` |
| **Taunt action type (+5 threat)** | ❌ | Need: new `taunt` action type in `resolveAction` |
| **Killing blow: +5 threat on other monsters** | ❌ | Requires multi-monster support first |
| **Enrage on fixated monster** | ❌ | Need: `monster.enrageDamageBonus` field, applied during monster turn |
| **Dual Punishment** | ❌ | Need: monster-card-driven payload when 2nd player crosses 15 during fixate |
| **Multi-monster (1–3 monsters)** | ❌ | Need: `state.monsters[]` instead of `state.monster`; per-monster threat rows |
| **4-player support** | 🟡 | Engine accepts `playerConfigs` of any length; UI is hardcoded to 2 |
| **Energy: base 4** | ❌ | Currently `STARTING_ENERGY = 3` |
| **Energy: no carryover** | ❌ | Currently `energyMax` rises by 1 each round |
| **Unused energy → buff** | ❌ | Not implemented |
| **Infusion (linear/threshold/branching)** | ❌ | Not implemented; cards need `infusion` payload |
| **Element tokens (3 types)** | ❌ | Need: `state.tokens[playerId]`, generation triggers, passives, Infusion spend |
| **Element combinations** | ❌ | Fire when player holds both types |
| **Party Deck (canonical, per-turn draw)** | ❌ | Currently we have a per-fight blessing draft (PR [#16](https://github.com/Kapitein420/Aetherfall/pull/16)); needs to be replaced or layered |
| **Party Deck — Auras (persistent)** | ❌ | New mechanic |
| **Party Deck — Fusion cards** | ❌ | Depends on element tokens |
| **Party Deck — Risk/Chaos** | ❌ | New mechanic |
| **Party Deck Interactions (peek/discard/duplicate/infuse)** | ❌ | New mechanic |
| **Class starter decks (Storm Forge etc.)** | 🟡 | Storm Forge data scaffolded in [`src/content/storm-forge.js`](../src/content/storm-forge.js) but not wired into `selectableClasses` until tokens land |
| **Hollow Titan boss** | ✅ | [`src/content/monsters.js`](../src/content/monsters.js) |
| **Ironjaw Bruiser boss** | ✅ | [`src/content/monsters.js`](../src/content/monsters.js) |
| **Warden of Targeting boss** | ✅ | [`src/content/monsters.js`](../src/content/monsters.js) |

---

## 11. Sequenced refactor plan

This plan assumes nothing in the engine matches the canonical rules yet. Each step is independently shippable.

| # | Step | Touches | Validates |
|---|---|---|---|
| 1 | Threat-rule tightening (fixate skip-decay, −1 actions while fixated, taunt action type) | [`src/engine/game.js`](../src/engine/game.js), [`src/content/cards.js`](../src/content/cards.js) | All 3 existing bosses still play through |
| 2 | Energy rework (base 4, no carryover, unused → buff) | [`src/engine/game.js`](../src/engine/game.js) | Existing decks still solvable |
| 3 | Element token system (passives + generation + Infusion mechanic) | [`src/engine/game.js`](../src/engine/game.js), new [`src/content/tokens.js`](../src/content/tokens.js) | New "Storm Forge" class playable |
| 4 | Multi-monster support (`state.monsters[]`) | [`src/engine/game.js`](../src/engine/game.js), [`src/app.js`](../src/app.js) | Three-monster Aetherfall encounter playable |
| 5 | Party Deck (canonical) replaces blessing draft; blessings repurposed as Aura cards or starter perks | [`src/engine/game.js`](../src/engine/game.js), [`src/app.js`](../src/app.js), [`src/content/party-deck.js`](../src/content/party-deck.js) | Per-turn Party Deck draw + play |
| 6 | 4-player support in setup screen + standoff layout | [`src/app.js`](../src/app.js), [`src/styles.css`](../src/styles.css) | 4-player co-op session works |
| 7 | Enrage + Dual Punishment + Killing Blow cross-threat | [`src/engine/game.js`](../src/engine/game.js), [`src/content/monsters.js`](../src/content/monsters.js) | All canonical rules covered |

After step 7, the [`ux-improvement-plan.md`](ux-improvement-plan.md) sprints (input parity, info surface, co-op transparency, feel polish) resume.
