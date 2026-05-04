// Canonical Party Deck content. Cards are drawn 1-2 per turn into a shared
// zone; any player can play them. Data shape mirrors the existing card
// registry so the engine can ingest these once the Party Deck system lands.
// Until then, this file is content-only — nothing imports it yet.
//
// Authoritative spec: docs/canonical-rules.md §6.
//
// Action types referenced below extend the existing engine vocabulary. Some
// require systems that don't exist yet (token generation, infusion, auras,
// per-turn party-deck draw). Cards that depend on missing systems carry a
// `requires` array so a future loader can filter them out until ready.

export const PARTY_DECK_CATEGORIES = [
  "damage",
  "block",
  "buff",
  "debuff",
  "aura",
  "fusion",
  "risk",
];

export const PARTY_DECK_BALANCE = {
  positive: 0.6,
  neutral: 0.25,
  negative: 0.15,
};

// Each card:
//   {
//     id: string,
//     name: string,
//     category: one of PARTY_DECK_CATEGORIES,
//     cost: number,
//     description: string,           // human-readable summary
//     effects: [...],                // engine-resolvable steps
//     polarity: "positive" | "neutral" | "negative",
//     elements?: string[],           // for fusion cards, the required element pair
//     persistent?: true,             // for auras
//     requires?: string[],           // engine systems this depends on
//   }

export const partyDeckCards = [
  // ===== 1. DAMAGE =====
  {
    id: "overcharge-pulse",
    name: "Overcharge Pulse",
    category: "damage",
    cost: 1,
    polarity: "positive",
    description: "Deal 3 damage to all enemies. If any player has 15+ threat, deal double damage instead.",
    effects: [
      { type: "damageAllEnemies", amount: 3, doubleIfThreatAtLeast: 15 },
    ],
    requires: ["multi-monster"],
  },
  {
    id: "chain-reaction",
    name: "Chain Reaction",
    category: "damage",
    cost: 1,
    polarity: "positive",
    description: "Deal 2 damage to all enemies for each card played by the party this turn.",
    effects: [
      { type: "damageAllEnemiesPerCardThisTurn", amount: 2 },
    ],
    requires: ["multi-monster", "per-turn-card-tracking"],
  },
  {
    id: "friendly-fire-protocol",
    name: "Friendly Fire Protocol",
    category: "damage",
    cost: 2,
    polarity: "neutral",
    description: "Deal 6 damage to all enemies. Deal 2 damage to all players.",
    effects: [
      { type: "damageAllEnemies", amount: 6 },
      { type: "damageAllPlayers", amount: 2 },
    ],
    requires: ["multi-monster"],
  },

  // ===== 2. BLOCK / DEFENSE =====
  {
    id: "emergency-barrier",
    name: "Emergency Barrier",
    category: "block",
    cost: 1,
    polarity: "positive",
    description: "All players gain 5 block.",
    effects: [
      { type: "block", target: "all", amount: 5 },
    ],
  },
  {
    id: "threat-shield",
    name: "Threat Shield",
    category: "block",
    cost: 1,
    polarity: "positive",
    description: "The highest-threat player gains block equal to their current threat.",
    effects: [
      { type: "blockHighestThreatEqualToThreat" },
    ],
  },
  {
    id: "adaptive-cover",
    name: "Adaptive Cover",
    category: "block",
    cost: 1,
    polarity: "positive",
    description: "Gain 3 block. Double this amount if no player spent all energy this turn.",
    effects: [
      { type: "block", target: "self", amount: 3, doubleIfNoFullEnergySpend: true },
    ],
    requires: ["per-turn-energy-tracking"],
  },

  // ===== 3. BUFFS =====
  {
    id: "overclock-sync",
    name: "Overclock Sync",
    category: "buff",
    cost: 1,
    polarity: "positive",
    description: "All players gain +1 damage this turn. If all players spent all energy, gain +2 damage instead.",
    effects: [
      { type: "buffAllDamageThisTurn", amount: 1, bonusIfAllSpentAllEnergy: 1 },
    ],
    requires: ["per-turn-energy-tracking", "buff-stack"],
  },
  {
    id: "network-efficiency",
    name: "Network Efficiency",
    category: "buff",
    cost: 1,
    polarity: "positive",
    description: "The first card each player plays next turn costs −1 energy.",
    effects: [
      { type: "discountFirstCardNextTurn", amount: 1, target: "all" },
    ],
    requires: ["next-turn-flag"],
  },
  {
    id: "bio-surge",
    name: "Bio Surge",
    category: "buff",
    cost: 1,
    polarity: "positive",
    description: "Heal 2. Gain +1 strength per unused energy among all players.",
    effects: [
      { type: "heal", target: "self", amount: 2 },
      { type: "buffStrengthFromUnusedEnergy", amount: 1 },
    ],
    requires: ["unused-energy-tracking", "strength-stack"],
  },

  // ===== 4. DEBUFFS =====
  {
    id: "system-lag",
    name: "System Lag",
    category: "debuff",
    cost: 1,
    polarity: "negative",
    description: "All players' next card costs +1 energy.",
    effects: [
      { type: "debuffNextCardCost", amount: 1, target: "all" },
    ],
    requires: ["next-card-flag"],
  },
  {
    id: "threat-spike",
    name: "Threat Spike",
    category: "debuff",
    cost: 1,
    polarity: "negative",
    description: "All players gain +3 threat.",
    effects: [
      { type: "threat", target: "all", amount: 3 },
    ],
  },
  {
    id: "corrupt-signal",
    name: "Corrupt Signal",
    category: "debuff",
    cost: 1,
    polarity: "negative",
    description: "Random player loses 1 energy next turn.",
    effects: [
      { type: "debuffRandomPlayerEnergy", amount: 1 },
    ],
    requires: ["next-turn-flag"],
  },

  // ===== 5. AURAS (persistent) =====
  {
    id: "static-field",
    name: "Static Field",
    category: "aura",
    cost: 1,
    polarity: "neutral",
    persistent: true,
    description: "All Overclock effects deal +2 damage. Players gain +1 threat when using ⚡.",
    effects: [
      { type: "auraStaticField" },
    ],
    requires: ["aura-system", "element-tokens"],
  },
  {
    id: "data-stream",
    name: "Data Stream",
    category: "aura",
    cost: 1,
    polarity: "positive",
    persistent: true,
    description: "The first card each turn that a player plays draws 1 extra card.",
    effects: [
      { type: "auraDataStream" },
    ],
    requires: ["aura-system"],
  },
  {
    id: "growth-protocol",
    name: "Growth Protocol",
    category: "aura",
    cost: 1,
    polarity: "positive",
    persistent: true,
    description: "At the end of each turn, players with unused energy gain 2 Regen.",
    effects: [
      { type: "auraGrowthProtocol" },
    ],
    requires: ["aura-system", "unused-energy-tracking", "regen-status"],
  },
  {
    id: "chaos-field",
    name: "Chaos Field",
    category: "aura",
    cost: 1,
    polarity: "neutral",
    persistent: true,
    description: "All Infusion effects are randomized.",
    effects: [
      { type: "auraChaosField" },
    ],
    requires: ["aura-system", "infusion"],
  },

  // ===== 6. FUSION-BASED (require 2 elements) =====
  {
    id: "emp-field",
    name: "EMP Field",
    category: "fusion",
    cost: 2,
    polarity: "positive",
    elements: ["storm-charge", "hydroflow"],
    description: "All enemies lose targeting for 1 turn. Reset all players' threat to 5.",
    effects: [
      { type: "removeMonsterTargetingForTurn" },
      { type: "resetAllThreat", to: 5 },
    ],
    requires: ["element-tokens", "infusion", "multi-monster"],
  },
  {
    id: "neural-network",
    name: "Neural Network",
    category: "fusion",
    cost: 2,
    polarity: "positive",
    elements: ["hydroflow", "bio-growth"],
    description: "Share all positive buffs between players. Draw 1 card.",
    effects: [
      { type: "shareAllPositiveBuffs" },
      { type: "draw", target: "self", count: 1 },
    ],
    requires: ["element-tokens", "infusion", "buff-stack"],
  },
  {
    id: "mutation-zone",
    name: "Mutation Zone",
    category: "fusion",
    cost: 2,
    polarity: "positive",
    elements: ["storm-charge", "bio-growth"],
    description: "All damage is increased by 1 for each 5 total threat among players.",
    effects: [
      { type: "buffAllDamagePerThreatBucket", per: 5, bonus: 1 },
    ],
    requires: ["element-tokens", "infusion"],
  },

  // ===== 7. RISK / CHAOS =====
  {
    id: "overload-protocol",
    name: "Overload Protocol",
    category: "risk",
    cost: 2,
    polarity: "neutral",
    description: "All players gain +2 energy. At the start of your next turn, lose 2 energy.",
    effects: [
      { type: "energy", target: "all", amount: 2 },
      { type: "debuffNextTurnEnergy", target: "all", amount: -2 },
    ],
    requires: ["next-turn-flag"],
  },
  {
    id: "fixate-event",
    name: "Fixate Event",
    category: "risk",
    cost: 1,
    polarity: "negative",
    description: "The highest-threat player becomes Fixated immediately for 1 turn.",
    effects: [
      { type: "forceFixateHighestThreat", duration: 1 },
    ],
  },
  {
    id: "jackpot-cache",
    name: "Jackpot Cache",
    category: "risk",
    cost: 1,
    polarity: "neutral",
    description: "Choose one at random: gain a powerful buff or gain a massive debuff.",
    effects: [
      { type: "randomBuffOrDebuff" },
    ],
  },
];

// Helpers — usable today even before the engine supports the cards.
export function listPartyDeckCards() {
  return partyDeckCards;
}

export function getPartyDeckCard(id) {
  return partyDeckCards.find((c) => c.id === id) ?? null;
}

export function listByCategory(category) {
  return partyDeckCards.filter((c) => c.category === category);
}

// A simple draw helper for the future Party Deck system. Honors the deck
// balance roughly by tagging cards with `polarity`. For now this just
// returns N random cards from the registry.
export function drawPartyCards(count = 2, rng = Math.random) {
  const pool = [...partyDeckCards];
  const picks = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

// === Party Deck Interaction Options ===
//
// Players can manipulate the deck itself with these actions. Will surface as
// UI affordances above the Party Deck zone once the system lands. Each costs
// some resource (energy, an action, or a token) — TBD.
export const PARTY_DECK_INTERACTIONS = [
  { id: "peek-ahead", name: "Peek Ahead", description: "Look at the next Party Card." },
  { id: "discard", name: "Discard", description: "Discard the current Party Card and draw a new one." },
  { id: "duplicate", name: "Duplicate", description: "Duplicate the current Party Card's effect." },
  { id: "infuse", name: "Infuse", description: "Infuse the Party Card with up to 2 Elements." },
];
