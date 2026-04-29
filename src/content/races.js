export const raceDefinitions = {
  ancient_giant: {
    id: "ancient_giant",
    name: "Ancient Giant / Stone Troll",
    maxHpBonus: 0,
    damageBonus: 0,
    blockBonus: 1,
    startingHandBonus: 0,
    summary: "Stone-born and patient. Gains extra block from defense cards.",
  },
  arcane_artificer: {
    id: "arcane_artificer",
    name: "Tinkerer / Arcane Artificer",
    maxHpBonus: 0,
    damageBonus: 0,
    blockBonus: 0,
    startingHandBonus: 0,
    summary: "Inventive and technical. Built around polarity and combo chains.",
  },
  elf_veilstalker: {
    id: "elf_veilstalker",
    name: "Elf Rogue / Forest Hunter",
    maxHpBonus: 0,
    damageBonus: 0,
    blockBonus: 0,
    startingHandBonus: 1,
    summary: "Fast and precise. Starts with one extra card.",
  },
  chaos_demon: {
    id: "chaos_demon",
    name: "Demon Sorcerer / Chaos Warlock",
    maxHpBonus: 0,
    damageBonus: 0,
    blockBonus: 0,
    startingHandBonus: 0,
    summary: "Volatile and dangerous. Turns risk into explosive power.",
  },
};

export const selectableRaces = Object.values(raceDefinitions);

