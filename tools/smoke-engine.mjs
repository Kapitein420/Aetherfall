// Quick smoke harness for the engine. Runs an autonomous co-op battle by
// queueing every legal card each round until the fight ends, then prints a
// summary. Used to validate the new monster registry / element / defense /
// fixate / phase machinery without any browser.
//
// Run: node tools/smoke-engine.mjs

import {
  createCoopBattle,
  queueCard,
  resolveRound,
  getRemainingEnergy,
} from "../src/engine/game.js";
import { getCardDefinition } from "../src/content/cards.js";
import { listMonsters } from "../src/content/monsters.js";

function pickPlannableCards(state) {
  // Greedy: queue any card the player can afford, in hand order.
  let next = state;
  for (const player of next.players) {
    if (player.hp <= 0) continue;
    for (const cardInstance of [...player.hand]) {
      const card = getCardDefinition(cardInstance.cardId);
      const me = next.players.find((p) => p.id === player.id);
      if (getRemainingEnergy(me) >= card.cost) {
        try {
          next = queueCard(next, {
            playerId: player.id,
            instanceId: cardInstance.instanceId,
          });
        } catch (e) {
          // skip
        }
      }
    }
  }
  return next;
}

function runFight(monsterId, roundCap = 30) {
  const battle = createCoopBattle({
    players: [
      { id: "player-1", classId: "rook" },
      { id: "player-2", classId: "lyra" },
    ],
    monsterId,
  });

  let state = battle;
  let rounds = 0;
  const phaseEnters = [];
  const fixateEvents = [];

  while (state.phase !== "game-over" && rounds < roundCap) {
    state = pickPlannableCards(state);
    const queued = state.players.reduce((s, p) => s + p.planned.length, 0);
    if (queued === 0) {
      // No-one can play anything; force-end as defeat.
      console.log("  [smoke] no playable cards — stalemate");
      break;
    }
    state = resolveRound(state);
    rounds += 1;

    for (const entry of state.log) {
      if (entry.kind === "phase-enter" && !phaseEnters.includes(entry.phaseId)) {
        phaseEnters.push(entry.phaseId);
      }
      if (entry.kind === "fixate" || entry.kind === "fixate-end") {
        fixateEvents.push(entry.text);
      }
    }
  }

  return {
    monsterId,
    rounds,
    winner: state.winner,
    phase: state.phase,
    monsterHp: state.monster.hp,
    monsterMaxHp: state.monster.maxHp,
    defense: state.monster.defense,
    actionsPerTurn: state.monster.actionsPerTurn,
    activePhase: state.monster.phases?.[state.monster.activePhaseIndex ?? 0]?.id,
    phaseEnters,
    fixateEvents,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      hp: p.hp,
      maxHp: p.maxHp,
      statuses: p.statuses,
    })),
  };
}

console.log("Available monsters:", listMonsters().map((m) => `${m.id} (${m.name})`));
for (const monster of listMonsters()) {
  console.log("\n=== Smoke fight:", monster.id, "===");
  const result = runFight(monster.id, 40);
  console.log(JSON.stringify(result, null, 2));
}
