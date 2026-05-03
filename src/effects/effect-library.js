export const effectLibrary = {
  block: {
    label: "Block",
    duration: 820,
    showsAmount: true,
  },
  defeat: {
    label: "KO",
    duration: 900,
    showsAmount: false,
  },
  draw: {
    label: "Draw",
    duration: 760,
    showsAmount: false,
  },
  heal: {
    label: "Heal",
    duration: 820,
    showsAmount: true,
  },
  discard: {
    label: "Discard",
    duration: 760,
    showsAmount: false,
  },
  mana: {
    label: "Mana",
    duration: 820,
    showsAmount: true,
  },
  pressure: {
    label: "Pressure",
    duration: 820,
    showsAmount: true,
  },
  storedDamage: {
    label: "Stored",
    duration: 820,
    showsAmount: true,
  },
  comboCharge: {
    label: "Combo",
    duration: 820,
    showsAmount: true,
  },
  loot: {
    label: "Loot",
    duration: 820,
    showsAmount: true,
  },
  instability: {
    label: "Instability",
    duration: 820,
    showsAmount: true,
  },
  polarity: {
    label: "Polarity",
    duration: 820,
    showsAmount: false,
  },
  polarityChanges: {
    label: "Polarity",
    duration: 820,
    showsAmount: true,
  },
  dice: {
    label: "Roll",
    duration: 900,
    showsAmount: true,
  },
  advantageRoll: {
    label: "Lucky Roll",
    duration: 900,
    showsAmount: false,
  },
  evasion: {
    label: "Evade",
    duration: 760,
    showsAmount: false,
  },
  selfHit: {
    label: "Backlash",
    duration: 820,
    showsAmount: true,
  },
  criticalLine: {
    label: "Crit",
    duration: 820,
    showsAmount: true,
  },
  physicalAttack: {
    label: "Swing",
    duration: 520,
    showsAmount: false,
  },
  physicalHit: {
    label: "Hit",
    duration: 820,
    showsAmount: true,
  },
  plan: {
    label: "Queued",
    duration: 520,
    showsAmount: false,
  },
  slow: {
    label: "Slow",
    duration: 820,
    showsAmount: false,
  },
  snareTrap: {
    label: "Trap",
    duration: 820,
    showsAmount: true,
  },
  spellHit: {
    label: "Spell",
    duration: 820,
    showsAmount: true,
  },
  summon: {
    label: "Summon",
    duration: 920,
    showsAmount: false,
  },
  threat: {
    label: "Threat",
    duration: 820,
    showsAmount: true,
  },
  ward: {
    label: "Ward",
    duration: 820,
    showsAmount: false,
  },
};

export function getEffectName(type) {
  return effectLibrary[type]?.label ?? "Effect";
}

export function getEffectDuration(type) {
  return effectLibrary[type]?.duration ?? 820;
}

export function shouldShowEffectAmount(type) {
  return Boolean(effectLibrary[type]?.showsAmount);
}
