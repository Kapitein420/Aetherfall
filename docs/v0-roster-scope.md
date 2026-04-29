# V0 Roster Scope

The first stable version should stay focused on four champion decks. This gives us enough variety to test the core system without exploding the amount of card art, balance work, and combo rules.

## Champion Decks

- Arian, the Still Colossus: Ancient Giant / Stone Troll, aspect of Accumulation. Builds Pressure, stores damage, gains armor, and wins through delayed seismic payoffs.
- Geert, the Polarity Architect: Tinkerer / Arcane Artificer, aspect of Control. Uses Polarity, Combo Charge, buffs, magnetic control, and chain reactions.
- Wouter, the Veilstalker: Elf Rogue / Forest Hunter, aspect of Precision. Plays fast, uses evasion, loot, ambush damage, traps, and critical strikes.
- Noah, Lord of Unwritten Chaos: Demon Sorcerer / Chaos Warlock, aspect of Chaos. Rolls damage, builds Instability, risks self-damage, and bends random effects into explosive turns.

## Content Rule

Until the core game is fun and readable, do not add new champions, races, or classes. Add depth by improving:

- champion starter decks,
- card art and sprite sheets,
- status effects,
- monster traits,
- champion-specific counters,
- balance.

New champions or races should only come after these four decks feel distinct and stable.

## Current Implementation Rule

The V0 browser prototype treats each champion as a locked class plus race identity. This keeps selection simple:

- Player chooses a champion deck.
- The champion automatically provides race, aspect, passive stats, and deck identity.
- Cards stay data-driven through `src/content/cards.js`.
- Champion metadata stays in `src/content/classes.js`.
- Race identity bonuses stay in `src/content/races.js`.
