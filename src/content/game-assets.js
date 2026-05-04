import { assetUrl } from "./asset-paths.js";

const uiAsset = (path) => assetUrl(`ui/${path}`);

export const battlefieldImage = uiAsset("battlefield-aetherfall.png");

export const monsterVisuals = {
  "hollow-titan": {
    portrait: uiAsset("monsters/hollow-titan.png"),
  },
};

export const championVisuals = {
  rook: {
    portrait: uiAsset("portraits/arian.png"),
    cardBack: uiAsset("card-backs/arian.png"),
  },
  lyra: {
    portrait: uiAsset("portraits/wouter.png"),
    cardBack: uiAsset("card-backs/wouter.png"),
  },
  arian: {
    portrait: uiAsset("portraits/arian.png"),
    cardBack: uiAsset("card-backs/arian.png"),
  },
  geert: {
    portrait: uiAsset("portraits/geert.png"),
    cardBack: uiAsset("card-backs/geert.png"),
  },
  wouter: {
    portrait: uiAsset("portraits/wouter.png"),
    cardBack: uiAsset("card-backs/wouter.png"),
  },
  noah: {
    portrait: uiAsset("portraits/noah.png"),
    cardBack: uiAsset("card-backs/noah.png"),
  },
  // TODO: replace with bespoke art for Captain Virex (Space Pirates)
  virex: {
    portrait: uiAsset("portraits/arian.png"),
    cardBack: uiAsset("card-backs/arian.png"),
  },
  // TODO: replace with bespoke art for Elyra Rootweaver (Bionic Nature Elves)
  elyra: {
    portrait: uiAsset("portraits/wouter.png"),
    cardBack: uiAsset("card-backs/wouter.png"),
  },
  // TODO: replace with bespoke art for Gorath Deepbreaker (Abyssal Orcs)
  gorath: {
    portrait: uiAsset("portraits/noah.png"),
    cardBack: uiAsset("card-backs/noah.png"),
  },
};

export const effectVisuals = {
  advantageRoll: uiAsset("effects/spell-r5c2.png"),
  block: uiAsset("effects/spell-r2c1.png"),
  comboCharge: uiAsset("effects/spell-r2c4.png"),
  criticalLine: uiAsset("effects/spell-r3c3.png"),
  dice: uiAsset("effects/spell-r5c2.png"),
  discard: uiAsset("effects/spell-r2c2.png"),
  draw: uiAsset("effects/spell-r2c2.png"),
  evasion: uiAsset("effects/spell-r3c1.png"),
  heal: uiAsset("effects/spell-r1c1.png"),
  instability: uiAsset("effects/spell-r4c4.png"),
  loot: uiAsset("effects/spell-r2c2.png"),
  mana: uiAsset("effects/spell-r2c4.png"),
  physicalAttack: uiAsset("effects/spell-r1c3.png"),
  physicalHit: uiAsset("effects/spell-r5c1.png"),
  plan: uiAsset("effects/spell-r2c2.png"),
  polarity: uiAsset("effects/spell-r2c4.png"),
  polarityChanges: uiAsset("effects/spell-r2c4.png"),
  pressure: uiAsset("effects/spell-r2c3.png"),
  selfHit: uiAsset("effects/spell-r5c4.png"),
  slow: uiAsset("effects/spell-r2c1.png"),
  snareTrap: uiAsset("effects/spell-r3c3.png"),
  spellHit: uiAsset("effects/spell-r1c2.png"),
  storedDamage: uiAsset("effects/spell-r2c3.png"),
  summon: uiAsset("effects/spell-r1c1.png"),
  threat: uiAsset("effects/spell-r5c1.png"),
  ward: uiAsset("effects/spell-r2c1.png"),
};

export function getChampionVisual(classId) {
  return championVisuals[classId] ?? championVisuals.arian;
}

export function getMonsterVisual(monsterId) {
  return monsterVisuals[monsterId] ?? null;
}

export function getEffectVisual(type) {
  return effectVisuals[type] ?? null;
}
