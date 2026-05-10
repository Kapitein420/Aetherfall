// Relic library. Each relic is a passive run-scoped effect picked up
// after a boss encounter and applied for the rest of the run.
//
// Hook surface (every field optional):
//   onBattleStart(state)   — once per encounter, after players + monsters
//                            are created and decks shuffled. Best place
//                            for stat boosts that re-apply each fight.
//   onRoundStart(state)    — before player phase, every round. Use for
//                            "draw +1 each round" / "first-card discount".
//   onDamageDealt(state, player, amount, action) → amount
//                          — modify damage at deal-time (fixate bonuses,
//                            element multipliers, etc.).
//
// The engine walks state.run.relics on each event and invokes any hook
// the relic defines. Relics are additive — multiple stack.

export const relicLibrary = {
  // ---------- Stat boosts ----------
  "bulwark-heart": {
    id: "bulwark-heart",
    name: "Bulwark Heart",
    icon: "❤",
    category: "stat",
    description: "+5 max HP for every player. Heals to match.",
    onBattleStart: (state) => {
      for (const p of state.players) {
        p.maxHp += 5;
        p.hp = Math.min(p.maxHp, p.hp + 5);
      }
    },
  },

  // ---------- Combat triggers ----------
  "echo-stone": {
    id: "echo-stone",
    name: "Echo Stone",
    icon: "✦",
    category: "trigger",
    description: "Draw +1 card on round 1 of every fight.",
    // Round 1 draw happens inside createCoopBattle (DRAW_PER_ROUND).
    // Hook into onBattleStart and add an extra draw per player.
    onBattleStart: (state, helpers) => {
      for (const p of state.players) {
        helpers.drawCards(state, p, 1);
      }
    },
  },
  "greenheart-sigil": {
    id: "greenheart-sigil",
    name: "Greenheart Sigil",
    icon: "✿",
    category: "trigger",
    description: "Heal 5 HP per player at the start of every encounter.",
    onBattleStart: (state) => {
      for (const p of state.players) {
        p.hp = Math.min(p.maxHp, p.hp + 5);
      }
    },
  },

  // ---------- Token economy ----------
  "stormrunner-anchor": {
    id: "stormrunner-anchor",
    name: "Stormrunner Anchor",
    icon: "⚡",
    category: "token",
    description: "Each player gains 1 token of their faction at the start of every fight.",
    onBattleStart: (state) => {
      for (const p of state.players) {
        if (!p.tokens) p.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
        // Map class.element → token slot. The class definitions carry
        // the elemental id; we infer the token field from there.
        const element = p.element ?? null;
        if (element === "storm-charge") p.tokens.stormCharge += 1;
        else if (element === "hydroflow") p.tokens.hydroflow += 1;
        else if (element === "bio-growth") p.tokens.bioGrowth += 1;
        // Classes without an element gain a generic Storm Charge.
        else p.tokens.stormCharge += 1;
      }
    },
  },

  // ---------- Damage modifiers ----------
  "fixate-lens": {
    id: "fixate-lens",
    name: "Fixate Lens",
    icon: "◎",
    category: "damage",
    description: "+2 damage on hits against the monster's fixated target.",
    // Engine hook reads this via onDamageDealt; for v1 we leave the
    // engine wiring deferred (relic data is here, hook will fire when
    // the engine wires it). Placeholder shape kept consistent.
    onDamageDealt: (state, player, amount /* , action */) => {
      const fix = state.monster?.fixate;
      if (fix && fix.roundsRemaining > 0 && fix.playerId === player.id) {
        return amount + 2;
      }
      return amount;
    },
  },
  "networked-inverter": {
    id: "networked-inverter",
    name: "Networked Inverter",
    icon: "◊",
    category: "damage",
    description: "First card each player queues per round costs −1 (min 0).",
    onRoundStart: (state) => {
      for (const p of state.players) {
        if (!p.statuses) p.statuses = {};
        p.statuses.firstCardDiscount = Math.max(p.statuses.firstCardDiscount ?? 0, 1);
      }
    },
  },

  // ---------- Risk / reward ----------
  "glass-reactor": {
    id: "glass-reactor",
    name: "Glass Reactor",
    icon: "△",
    category: "risk",
    description: "−8 max HP, +1 starting energy. Every fight is a gamble.",
    onBattleStart: (state) => {
      for (const p of state.players) {
        p.maxHp = Math.max(8, p.maxHp - 8);
        p.hp = Math.min(p.maxHp, p.hp);
        p.energyMax += 1;
        p.energy = p.energyMax;
      }
    },
  },

  // ---------- Run economy ----------
  "crystal-refractor": {
    id: "crystal-refractor",
    name: "Crystal Refractor",
    icon: "◈",
    category: "economy",
    description: "+5 bonus crystals per encounter cleared.",
    // Run-economy relics don't fire combat hooks; the reward flow
    // checks state.run.relics for "crystal-refractor" and adds 5 to
    // the crystals earned. See app.js handleClaimReward.
    bonusCrystalsPerClear: 5,
  },
};

export function listRelics() {
  return Object.values(relicLibrary);
}

export function getRelic(id) {
  return relicLibrary[id] ?? null;
}
