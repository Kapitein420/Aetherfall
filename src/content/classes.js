export const classDefinitions = {
  rook: {
    id: "rook",
    name: "Rook, the Iron Vanguard",
    shortName: "Rook",
    role: "Defender",
    aspect: "Protection / Threat Control",
    maxHp: 42,
    summary: "A shield-heavy frontliner who can absorb punishment, taunt the monster, and turn defense into damage.",
    personality: "Steady, stubborn, and happiest when the monster is looking at him instead of an ally.",
    implemented: true,
  },
  lyra: {
    id: "lyra",
    name: "Lyra, the Ember Veil",
    shortName: "Lyra",
    role: "Striker",
    aspect: "Burst / Evasion / Marking",
    maxHp: 34,
    summary: "A fast damage dealer who marks weak points, dodges attacks, and manipulates threat with precise movement.",
    personality: "Sharp, playful, and always two steps away from where danger expected her to be.",
    implemented: true,
  },
};

export const selectableClasses = Object.values(classDefinitions);
