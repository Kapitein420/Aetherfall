// Monster registry. Each entry has a `factory(playerCount, playerIds)` that
// returns a fresh monster object for the engine. Keep these factories pure
// (no I/O) so the engine can clone them freely.
//
// Monster shape:
//   {
//     id: string,                       // identifier used by the engine
//     name: string,                     // display name
//     role: string,                     // short flavor / archetype label
//     faction: string,                  // worldbuilding tag
//     maxHp / hp: number,
//     baseAttack: number,
//     defense: number,                  // permanent flat damage reduction
//     actionsPerTurn: number,           // monster turn loops this many times
//     elementResistances: { [el]: mul },// >1 vulnerable, <1 resistant
//     statuses: { exposed, weakened, ... },
//     phases: [{ id, hpThresholdPct, onEnter }],
//     activePhaseIndex: number,         // bookkeeping; engine advances this
//     threat: { [playerId]: number },
//     fixate: { playerId, roundsRemaining } | null,
//     traits: string[],                 // flavor/diagnostic notes for UI
//   }

const DEFAULT_THREAT_MAX = 20;

function makeThreat(playerIds) {
  const threat = {};
  for (const id of playerIds) {
    threat[id] = 0;
  }
  return threat;
}

export const monsterRegistry = {
  "hollow-titan": {
    id: "hollow-titan",
    name: "The Hollow Titan",
    role: "Boss",
    faction: "Aetherfall",
    factory: (playerCount, playerIds = []) => ({
      id: "monster",
      name: "The Hollow Titan",
      monsterId: "hollow-titan",
      role: "Boss",
      faction: "Aetherfall",
      maxHp: 120,
      hp: 120,
      baseAttack: 9,
      defense: 0,
      actionsPerTurn: 1,
      elementResistances: {},
      statuses: {
        exposed: 0,
        weakened: 0,
      },
      phases: [
        { id: "p1", hpThresholdPct: 1.0, onEnter: null },
      ],
      activePhaseIndex: 0,
      threat: makeThreat(playerIds),
      fixate: null,
      traits: [],
      threatMax: DEFAULT_THREAT_MAX,
    }),
  },

  "ironjaw-bruiser": {
    id: "ironjaw-bruiser",
    name: "Ironjaw Bruiser",
    role: "Frontline / Tank",
    faction: "Dreadmaw Crocs",
    factory: (playerCount, playerIds = []) => {
      const hpPerPlayer = 10;
      const totalHp = Math.max(playerCount, 1) * hpPerPlayer;
      return {
        id: "monster",
        name: "Ironjaw Bruiser",
        monsterId: "ironjaw-bruiser",
        role: "Frontline / Tank",
        faction: "Dreadmaw Crocs",
        maxHp: totalHp,
        hp: totalHp,
        baseAttack: 6,
        defense: 5,
        actionsPerTurn: 1,
        elementResistances: {
          water: 1.25,
          toxic: 0.75,
        },
        statuses: {
          exposed: 0,
          weakened: 0,
        },
        // Phase machine: foundation for the boss patterns. Crossing the
        // threshold (descending HP) fires the onEnter hook once.
        phases: [
          { id: "p1", hpThresholdPct: 1.0, onEnter: null },
          {
            id: "crushing-bulwark",
            hpThresholdPct: 0.5,
            onEnter: "ironjawCrushingBulwark",
          },
          {
            id: "pack-convergence",
            hpThresholdPct: 0.25,
            onEnter: "ironjawPackConvergence",
          },
        ],
        activePhaseIndex: 0,
        threat: makeThreat(playerIds),
        // Fixate: when a player is "marked" the monster locks on for 2
        // rounds. Engine sets `selectTarget` to use this lookup.
        fixate: null,
        // Hint to the engine to use the fixate-aware target picker.
        targetSelector: "fixate",
        // Trait flavor: the design calls for Submerged-State / Crushing-
        // Bulwark / adjacency / pull-push, but adjacency is intentionally
        // deferred (no positional system). Surfaced for the log only.
        traits: [
          "Submerged-State",
          "Crushing Bulwark",
          "Pack Hunter",
        ],
        threatMax: DEFAULT_THREAT_MAX,
      };
    },
  },

  "warden-of-targeting": {
    id: "warden-of-targeting",
    name: "Warden of Targeting",
    role: "Surveillance Construct",
    faction: "Aetherfall",
    factory: (playerCount, playerIds = []) => {
      const hpPerPlayer = 10;
      const totalHp = Math.max(playerCount, 1) * hpPerPlayer;
      return {
        id: "monster",
        name: "Warden of Targeting",
        monsterId: "warden-of-targeting",
        role: "Surveillance Construct",
        faction: "Aetherfall",
        maxHp: totalHp,
        hp: totalHp,
        baseAttack: 6,
        defense: 2,
        actionsPerTurn: 1,
        elementResistances: {
          overclock: 1.25,
          biohack: 0.85,
        },
        statuses: {
          exposed: 0,
          weakened: 0,
        },
        // Surveillance is the entry phase — its periodic tracking lives
        // in the engine's startNextRound (see applyWardenSurveillance),
        // so no onEnter hook is needed. Override Protocol swaps threat
        // and installs a per-turn dampening pass. Judgement Mode locks
        // fixate at a lower threshold and gains a second action per turn.
        phases: [
          { id: "surveillance", hpThresholdPct: 1.0, onEnter: null },
          {
            id: "override-protocol",
            hpThresholdPct: 0.65,
            onEnter: "wardenOverrideProtocol",
          },
          {
            id: "judgement-mode",
            hpThresholdPct: 0.3,
            onEnter: "wardenJudgementMode",
          },
        ],
        activePhaseIndex: 0,
        threat: makeThreat(playerIds),
        fixate: null,
        // Per-turn hook installed by Override Protocol; cleared on entry
        // to Judgement Mode. Engine reads this in resolveMonsterTurn.
        onMonsterTurnStart: null,
        traits: [
          "Surveillance Lock",
          "Override Protocol",
          "Judgement Convergence",
        ],
        threatMax: DEFAULT_THREAT_MAX,
      };
    },
  },
};

// Hook registry for phase-enter side-effects. Hooks get the live state and
// can mutate the monster directly. Keep them small and additive.
export const phaseHooks = {
  // Foundation example hooks (kept here so future bosses can reuse).
  exposeAll: (state) => {
    state.monster.statuses.exposed = (state.monster.statuses.exposed ?? 0) + 4;
  },
  enrage: (state) => {
    state.monster.baseAttack += 3;
  },

  // Ironjaw Bruiser: bumps defense permanently while in this phase.
  ironjawCrushingBulwark: (state) => {
    state.monster.defense = Math.max(state.monster.defense ?? 0, 7);
    state.monster.statuses.exposed = 0;
  },
  // Ironjaw Bruiser: monster gains a second action per turn.
  ironjawPackConvergence: (state) => {
    state.monster.actionsPerTurn = Math.max(
      state.monster.actionsPerTurn ?? 1,
      2,
    );
  },

  // Warden of Targeting — phase 2: one-shot swap of highest/lowest
  // threat, then install a per-turn dampening hook that reduces every
  // living player's threat by 2 at the top of each monster turn.
  wardenOverrideProtocol: (state) => {
    const monster = state.monster;
    const livingIds = state.players
      .filter((p) => p.hp > 0)
      .map((p) => p.id);
    if (livingIds.length >= 2) {
      const sorted = [...livingIds].sort(
        (a, b) => (monster.threat[a] ?? 0) - (monster.threat[b] ?? 0),
      );
      const lowId = sorted[0];
      const highId = sorted[sorted.length - 1];
      if (lowId !== highId) {
        const lowVal = monster.threat[lowId] ?? 0;
        const highVal = monster.threat[highId] ?? 0;
        monster.threat[lowId] = highVal;
        monster.threat[highId] = lowVal;
      }
    }
    monster.baseAttack = Math.max(monster.baseAttack ?? 0, 7);
    monster.onMonsterTurnStart = (liveState) => {
      for (const player of liveState.players) {
        if (player.hp <= 0) continue;
        const current = liveState.monster.threat[player.id] ?? 0;
        liveState.monster.threat[player.id] = Math.max(0, current - 2);
      }
    };
  },

  // Warden of Targeting — phase 3: lock onto the highest-threat target
  // at a lower fixate threshold, gain a second action per turn, and
  // stop dampening threat (we want it to climb so fixate can land).
  wardenJudgementMode: (state) => {
    const monster = state.monster;
    monster.targetSelector = "fixate";
    monster.fixateThreshold = 10;
    monster.actionsPerTurn = Math.max(monster.actionsPerTurn ?? 1, 2);
    monster.baseAttack = Math.max(monster.baseAttack ?? 0, 9);
    monster.onMonsterTurnStart = null;
  },
};

export const DEFAULT_MONSTER_ID = "hollow-titan";

export function getMonsterRegistryEntry(monsterId) {
  return monsterRegistry[monsterId] ?? null;
}

export function listMonsters() {
  return Object.values(monsterRegistry);
}

export function createMonsterById(monsterId, playerCount, playerIds) {
  const entry = monsterRegistry[monsterId];
  if (!entry) {
    throw new Error(`Unknown monster: ${monsterId}`);
  }
  return entry.factory(playerCount, playerIds);
}
