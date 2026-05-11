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

// Inline SVG bodies for the 8 relics. Each uses `currentColor` so the
// CSS category tint on the parent (.reward-relic-card / .ab-relic-chip /
// .shop-icon) carries through. viewBox is normalised to 0 0 24 24.
const RELIC_SVG = {
  "bulwark-heart": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/><path d="M12 8v8"/><path d="M9 12h6"/></svg>`,
  "echo-stone": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="6" opacity="0.7"/><circle cx="12" cy="12" r="10" opacity="0.35"/></svg>`,
  "greenheart-sigil": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4c-7 0-13 4-13 12a8 8 0 0 0 8 8c0-7 4-13 12-13"/><path d="M7 17c2-3 5-5 9-6"/></svg>`,
  "stormrunner-anchor": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3 6 14h4l-2 7 10-11h-4l2-7z" fill="currentColor" fill-opacity="0.18"/></svg>`,
  "fixate-lens": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`,
  "networked-inverter": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 21 12 12 21 3 12z"/><path d="M12 8v8M8 12h8"/></svg>`,
  "glass-reactor": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 22 20H2z"/><path d="M12 9v6"/><path d="M9 17h6"/></svg>`,
  "crystal-refractor": `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 4 9l8 13 8-13z" fill="currentColor" fill-opacity="0.15"/><path d="M4 9h16"/><path d="M12 2v20"/><path d="M8 9l4 13M16 9l-4 13"/></svg>`,
};

export const relicLibrary = {
  // ---------- Stat boosts ----------
  "bulwark-heart": {
    id: "bulwark-heart",
    name: "Bulwark Heart",
    icon: "❤",
    iconSvg: RELIC_SVG["bulwark-heart"],
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
    iconSvg: RELIC_SVG["echo-stone"],
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
    iconSvg: RELIC_SVG["greenheart-sigil"],
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
    iconSvg: RELIC_SVG["stormrunner-anchor"],
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
    iconSvg: RELIC_SVG["fixate-lens"],
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
    iconSvg: RELIC_SVG["networked-inverter"],
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
    iconSvg: RELIC_SVG["glass-reactor"],
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
    iconSvg: RELIC_SVG["crystal-refractor"],
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
