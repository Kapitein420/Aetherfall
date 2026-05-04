// Storm Forge — Storm Charge themed starter deck.
// Theme: "Aggression fuels power. Strike hard, risk higher."
// Element affinity: Storm Charge.
//
// Authoritative spec: docs/canonical-rules.md §7.
//
// Data only. NOT wired into selectableClasses yet — the cards reference
// systems (token spending, Storm passive +1 dmg) that don't exist in the
// engine until the token-system refactor lands. Once that lands, this
// class can be added to `src/content/classes.js` and the cards merged
// into the card registry.

export const STORM_FORGE_CLASS = {
  id: "storm-forge",
  shortName: "Storm Forge",
  name: "Storm Forge Vanguard",
  role: "Striker",
  faction: "Aetherfall — Storm Caste",
  element: "storm-charge",
  tagline: "Aggression fuels power. Strike hard, risk higher.",
  maxHp: 36,
  // Tags surfaced in setup screen. Will mirror existing classes once wired in.
  archetypes: ["Burst", "Risk/Reward", "Storm Charge"],
};

// Card registry shape mirrors src/content/cards.js: { id, name, role, cost,
// description, actions: [...], element? }. The `tokenSpend` entries describe
// optional spends that will be honored once the token system exists.
export const stormForgeCards = [
  {
    id: "storm-basic-attack",
    name: "Basic Attack",
    role: "attack",
    cost: 1,
    element: "storm-charge",
    description: "Deal 1 damage. Storm passive: +1 damage. Spend 1 token: +1 damage.",
    actions: [{ type: "damage", amount: 1, element: "overclock" }],
    passives: ["storm-attack-bonus"],
    tokenSpend: { token: "storm-charge", cost: 1, effect: { type: "damageBonus", amount: 1 } },
  },
  {
    id: "storm-basic-defend",
    name: "Basic Defend",
    role: "defense",
    cost: 1,
    element: "storm-charge",
    description: "Block 2 damage. Spend 1 token: +1 block.",
    actions: [{ type: "block", target: "self", amount: 2 }],
    tokenSpend: { token: "storm-charge", cost: 1, effect: { type: "blockBonus", amount: 1 } },
  },
  {
    id: "storm-power-strike",
    name: "Power Strike",
    role: "attack",
    cost: 2,
    element: "storm-charge",
    description: "Deal 3 damage. Enhanced by Storm passive (+1 from passive).",
    actions: [{ type: "damage", amount: 3, element: "overclock" }],
    passives: ["storm-attack-bonus"],
  },
  {
    id: "storm-surge-channel",
    name: "Surge Channel",
    role: "attack",
    cost: 2,
    element: "storm-charge",
    description: "Deal 1 damage. Gain 1 Storm Charge token.",
    actions: [
      { type: "damage", amount: 1, element: "overclock" },
      { type: "gainToken", token: "storm-charge", amount: 1 },
    ],
  },
];

// Deck composition: copies per card. Total 10 cards (matching the Storm
// Forge starter deck reference image: 4×basic-attack, 4×basic-defend,
// 1×power-strike, 1×surge-channel).
export const stormForgeDeck = [
  ...Array(4).fill("storm-basic-attack"),
  ...Array(4).fill("storm-basic-defend"),
  "storm-power-strike",
  "storm-surge-channel",
];

export function listStormForgeCards() {
  return stormForgeCards;
}

export function getStormForgeCard(id) {
  return stormForgeCards.find((c) => c.id === id) ?? null;
}
