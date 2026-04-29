const uiPath = "/assets/ui";

export const battlefieldImage = `${uiPath}/battlefield-aetherfall.png`;

export const championVisuals = {
  arian: {
    portrait: `${uiPath}/portraits/arian.png`,
    cardBack: `${uiPath}/card-backs/arian.png`,
  },
  geert: {
    portrait: `${uiPath}/portraits/geert.png`,
    cardBack: `${uiPath}/card-backs/geert.png`,
  },
  wouter: {
    portrait: `${uiPath}/portraits/wouter.png`,
    cardBack: `${uiPath}/card-backs/wouter.png`,
  },
  noah: {
    portrait: `${uiPath}/portraits/noah.png`,
    cardBack: `${uiPath}/card-backs/noah.png`,
  },
};

export const effectVisuals = {
  advantageRoll: `${uiPath}/effects/spell-r5c2.png`,
  block: `${uiPath}/effects/spell-r2c1.png`,
  comboCharge: `${uiPath}/effects/spell-r2c4.png`,
  criticalLine: `${uiPath}/effects/spell-r3c3.png`,
  dice: `${uiPath}/effects/spell-r5c2.png`,
  discard: `${uiPath}/effects/spell-r2c2.png`,
  draw: `${uiPath}/effects/spell-r2c2.png`,
  evasion: `${uiPath}/effects/spell-r3c1.png`,
  instability: `${uiPath}/effects/spell-r4c4.png`,
  loot: `${uiPath}/effects/spell-r2c2.png`,
  mana: `${uiPath}/effects/spell-r2c4.png`,
  physicalAttack: `${uiPath}/effects/spell-r1c3.png`,
  physicalHit: `${uiPath}/effects/spell-r5c1.png`,
  polarity: `${uiPath}/effects/spell-r2c4.png`,
  polarityChanges: `${uiPath}/effects/spell-r2c4.png`,
  pressure: `${uiPath}/effects/spell-r2c3.png`,
  selfHit: `${uiPath}/effects/spell-r5c4.png`,
  slow: `${uiPath}/effects/spell-r2c1.png`,
  snareTrap: `${uiPath}/effects/spell-r3c3.png`,
  spellHit: `${uiPath}/effects/spell-r1c2.png`,
  storedDamage: `${uiPath}/effects/spell-r2c3.png`,
  summon: `${uiPath}/effects/spell-r1c1.png`,
  ward: `${uiPath}/effects/spell-r2c1.png`,
};

export function getChampionVisual(classId) {
  return championVisuals[classId] ?? championVisuals.arian;
}

export function getEffectVisual(type) {
  return effectVisuals[type] ?? null;
}
