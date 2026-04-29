export const cardArtDefinitions = {
  fire: {
    label: "Fire",
    symbol: "FIRE",
    className: "art-fire",
  },
  frost: {
    label: "Frost",
    symbol: "ICE",
    className: "art-frost",
  },
  storm: {
    label: "Storm",
    symbol: "BOLT",
    className: "art-storm",
  },
  arcane: {
    label: "Arcane",
    symbol: "RUNE",
    className: "art-arcane",
  },
  shield: {
    label: "Shield",
    symbol: "WARD",
    className: "art-shield",
  },
  blade: {
    label: "Blade",
    symbol: "SLASH",
    className: "art-blade",
  },
  armor: {
    label: "Armor",
    symbol: "IRON",
    className: "art-armor",
  },
  banner: {
    label: "Banner",
    symbol: "RALLY",
    className: "art-banner",
  },
  arrow: {
    label: "Arrow",
    symbol: "SHOT",
    className: "art-arrow",
  },
  beast: {
    label: "Beast",
    symbol: "BEAST",
    className: "art-beast",
  },
  trap: {
    label: "Trap",
    symbol: "TRAP",
    className: "art-trap",
  },
  shadow: {
    label: "Shadow",
    symbol: "SHADE",
    className: "art-shadow",
  },
  poison: {
    label: "Poison",
    symbol: "TOXIN",
    className: "art-poison",
  },
  trick: {
    label: "Trick",
    symbol: "TRICK",
    className: "art-trick",
  },
  coin: {
    label: "Coin",
    symbol: "COIN",
    className: "art-coin",
  },
  stone: {
    label: "Stone",
    symbol: "STONE",
    className: "art-stone",
  },
  moss: {
    label: "Moss",
    symbol: "MOSS",
    className: "art-moss",
  },
  seismic: {
    label: "Seismic",
    symbol: "FAULT",
    className: "art-seismic",
  },
  magnet: {
    label: "Magnet",
    symbol: "PULSE",
    className: "art-magnet",
  },
  metal: {
    label: "Metal",
    symbol: "GEAR",
    className: "art-metal",
  },
  electric: {
    label: "Electric",
    symbol: "ARC",
    className: "art-electric",
  },
  relic: {
    label: "Relic",
    symbol: "LOOT",
    className: "art-relic",
  },
  void: {
    label: "Void",
    symbol: "VOID",
    className: "art-void",
  },
  dice: {
    label: "Dice",
    symbol: "ROLL",
    className: "art-dice",
  },
  chaos: {
    label: "Chaos",
    symbol: "RIFT",
    className: "art-chaos",
  },
  demon: {
    label: "Demon",
    symbol: "IMP",
    className: "art-demon",
  },
};

export function getCardArtDefinition(card) {
  return cardArtDefinitions[card.artKey] ?? cardArtDefinitions[card.role] ?? cardArtDefinitions.arcane;
}
