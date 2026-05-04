// Party-deck blessings — per-fight buffs picked between setup and battle.
// Each blessing exposes optional hooks that the engine calls at well-known
// points. Hooks mutate `state` directly (the engine clones state at each
// operation boundary, so this is safe). Heavy lifting that needs to read
// across multiple turns is done via `state.blessingFlags` so the data
// survives `structuredClone` (functions on state objects do not).
//
// Hook contract:
//   apply?(state)            — runs once at fight start, after players exist.
//   onRoundStart?(state)     — runs at the top of startNextRound.
//   onCardResolve?(state, player, card) — runs after each card resolves.

import { drawCards } from "../engine/game.js";

export const blessingRegistry = {
  "iron-aegis": {
    id: "iron-aegis",
    name: "Iron Aegis",
    description: "Each champion enters with +5 max HP.",
    flavor: "Plate forged in the silence between heartbeats.",
    apply: (state) => {
      for (const player of state.players) {
        player.maxHp += 5;
        player.hp += 5;
      }
    },
  },

  "quickdraw": {
    id: "quickdraw",
    name: "Quickdraw",
    description: "Draw 1 extra card at the start of each round.",
    flavor: "Faster hands, fewer regrets.",
    onRoundStart: (state) => {
      for (const player of state.players) {
        if (player.hp <= 0) continue;
        drawCards(state, player, 1);
      }
    },
  },

  "sparked-wires": {
    id: "sparked-wires",
    name: "Sparked Wires",
    description: "Start the fight with +1 energy. Energy cap rises with you.",
    flavor: "A current that knows your shape.",
    apply: (state) => {
      for (const player of state.players) {
        player.energyMax += 1;
        player.energy = player.energyMax;
      }
    },
  },

  "glass-cannon": {
    id: "glass-cannon",
    name: "Glass Cannon",
    description: "+1 damage on every attack, but each champion has 3 less max HP.",
    flavor: "Hit harder. Bleed faster.",
    apply: (state) => {
      state.blessingFlags.glassCannon = true;
      for (const player of state.players) {
        player.maxHp = Math.max(1, player.maxHp - 3);
        player.hp = Math.min(player.hp, player.maxHp);
      }
    },
  },

  "healers-cradle": {
    id: "healers-cradle",
    name: "Healer's Cradle",
    description: "At round start, the most-wounded champion regains 2 HP.",
    flavor: "The party breathes together.",
    onRoundStart: (state) => {
      const living = state.players.filter((p) => p.hp > 0);
      if (living.length === 0) return;
      const lowest = [...living].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      lowest.hp = Math.min(lowest.maxHp, lowest.hp + 2);
    },
  },

  "threat-sink": {
    id: "threat-sink",
    name: "Threat Sink",
    description: "Threat decays 1 faster each round (4 instead of 3).",
    flavor: "Eyes slide off the gifted.",
    apply: (state) => {
      state.blessingFlags.threatDecayBonus = 1;
    },
  },

  "crit-vision": {
    id: "crit-vision",
    name: "Crit Vision",
    description: "The first card each champion queues per round costs 1 less energy (min 0).",
    flavor: "Time slows for the first commitment.",
    apply: (state) => {
      state.blessingFlags.firstCardDiscount = true;
    },
  },

  "slow-burn": {
    id: "slow-burn",
    name: "Slow Burn",
    description: "Energy cap raises to 12 instead of 10.",
    flavor: "The patient empire crowns itself.",
    apply: (state) => {
      state.blessingFlags.energyCapBonus = 2;
    },
  },

  "mending-tide": {
    id: "mending-tide",
    name: "Mending Tide",
    description: "Whenever a card resolves, any wounded champion (under half HP) gains 3 block.",
    flavor: "Salt on the wound is still water.",
    onCardResolve: (state) => {
      for (const player of state.players) {
        if (player.hp <= 0) continue;
        if (player.hp < player.maxHp / 2) {
          player.block += 3;
        }
      }
    },
  },

  "insight": {
    id: "insight",
    name: "Insight",
    description: "Each champion starts with one extra card in hand.",
    flavor: "The first move was always there.",
    apply: (state) => {
      for (const player of state.players) {
        drawCards(state, player, 1);
      }
    },
  },
};

export function listBlessings() {
  return Object.values(blessingRegistry);
}

export function getBlessingById(blessingId) {
  if (!blessingId) return null;
  return blessingRegistry[blessingId] ?? null;
}

export function randomBlessingDraft(count = 3, rng = Math.random) {
  const pool = listBlessings();
  if (pool.length <= count) {
    return [...pool];
  }
  // Fisher-Yates partial shuffle: enough swaps to fill `count` distinct slots.
  const indices = pool.map((_, i) => i);
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rng() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((i) => pool[i]);
}
