import { classDefinitions } from "../content/classes.js";
import { DECK_SIZE, getCardDefinition, starterDecks } from "../content/cards.js";

export const DRAW_PER_ROUND = 5;
export const STARTING_ENERGY = 3;
export const MAX_ENERGY = 10;
export const THREAT_DECAY = 3;

export function createCoopBattle(config = {}) {
  const playerConfigs =
    config.players ??
    [
      { id: "player-1", classId: "rook" },
      { id: "player-2", classId: "lyra" },
    ];

  const players = playerConfigs.map((playerConfig, index) => createPlayer(playerConfig, index + 1));
  const state = {
    mode: "coop-boss",
    phase: "planning",
    roundNumber: 1,
    players,
    monster: createMonster(),
    winner: null,
    log: [],
    events: [],
    nextEventId: 1,
  };

  for (const player of state.players) {
    drawCards(state, player, DRAW_PER_ROUND);
  }

  pushLog(state, "Round 1 begins. Both players plan their actions.");
  return state;
}

export function queueCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);

  const player = getPlayer(state, command.playerId);
  if (player.hp <= 0) {
    throw new Error(`${player.name} cannot act while defeated.`);
  }
  const handIndex = player.hand.findIndex((card) => card.instanceId === command.instanceId);
  if (handIndex < 0) {
    throw new Error("That card is not in this player's hand.");
  }

  const cardInstance = player.hand[handIndex];
  const card = getCardDefinition(cardInstance.cardId);
  if (getRemainingEnergy(player) < card.cost) {
    throw new Error(`${player.name} does not have enough energy for ${card.name}.`);
  }

  player.hand.splice(handIndex, 1);
  player.planned.push(cardInstance);
  pushEvent(state, "plan", {
    target: { type: "player", playerId: player.id },
    label: card.name,
  });
  return state;
}

export function unqueueCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);

  const player = getPlayer(state, command.playerId);
  const planIndex = player.planned.findIndex((card) => card.instanceId === command.instanceId);
  if (planIndex < 0) {
    throw new Error("That card is not queued.");
  }

  const [cardInstance] = player.planned.splice(planIndex, 1);
  player.hand.push(cardInstance);
  return state;
}

export function resolveRound(currentState) {
  const state = cloneState(currentState);
  ensurePlanning(state);

  if (state.players.every((player) => player.planned.length === 0)) {
    throw new Error("Queue at least one action before resolving the round.");
  }

  pushLog(state, `Round ${state.roundNumber} actions resolve.`);

  for (const player of state.players) {
    for (const cardInstance of player.planned) {
      const card = getCardDefinition(cardInstance.cardId);
      player.energy -= card.cost;
      resolveCard(state, player, card);
      player.discard.push(cardInstance);
      pushLog(state, `${player.name} uses ${card.name}.`);
      if (state.monster.hp <= 0) {
        break;
      }
    }
    player.planned = [];
    if (state.monster.hp <= 0) {
      break;
    }
  }

  if (state.monster.hp <= 0) {
    state.monster.hp = 0;
    state.phase = "game-over";
    state.winner = "players";
    pushEvent(state, "defeat", {
      target: { type: "monster" },
      label: state.monster.name,
    });
    pushLog(state, `${state.monster.name} falls. The players win.`);
    return state;
  }

  resolveMonsterTurn(state);
  if (state.players.every((player) => player.hp <= 0)) {
    state.phase = "game-over";
    state.winner = "monster";
    pushLog(state, `${state.monster.name} overwhelms the party.`);
    return state;
  }

  startNextRound(state);
  return state;
}

export function getRemainingEnergy(player) {
  const plannedCost = player.planned.reduce((total, cardInstance) => {
    const card = getCardDefinition(cardInstance.cardId);
    return total + card.cost;
  }, 0);

  return Math.max(0, player.energy - plannedCost);
}

export function getPlayer(state, playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Unknown player: ${playerId}`);
  }

  return player;
}

export function targetKey(target) {
  if (!target) {
    return "";
  }
  if (target.type === "monster") {
    return "monster";
  }
  return `player:${target.playerId}`;
}

function createPlayer(playerConfig, index) {
  const classDef = classDefinitions[playerConfig.classId];
  if (!classDef) {
    throw new Error(`Unknown class: ${playerConfig.classId}`);
  }

  const deckList = starterDecks[classDef.id];
  if (!deckList || deckList.length !== DECK_SIZE) {
    throw new Error(`${classDef.name} needs a ${DECK_SIZE}-card deck.`);
  }

  const id = playerConfig.id ?? `player-${index}`;
  const deck = shuffle(
    deckList.map((cardId, cardIndex) => ({
      instanceId: `${id}-card-${cardIndex + 1}`,
      cardId,
    })),
  );

  return {
    id,
    name: playerConfig.name ?? classDef.shortName,
    classId: classDef.id,
    role: classDef.role,
    maxHp: classDef.maxHp,
    hp: classDef.maxHp,
    block: 0,
    energyMax: STARTING_ENERGY,
    energy: STARTING_ENERGY,
    deck,
    hand: [],
    discard: [],
    planned: [],
  };
}

function createMonster() {
  return {
    id: "monster",
    name: "The Hollow Titan",
    maxHp: 120,
    hp: 120,
    baseAttack: 9,
    threat: {
      "player-1": 0,
      "player-2": 0,
    },
    statuses: {
      exposed: 0,
      weakened: 0,
    },
  };
}

function resolveCard(state, player, card) {
  for (const action of card.actions) {
    resolveAction(state, player, action);
  }
}

function resolveAction(state, player, action) {
  if (action.type === "damage") {
    const exposed = consumeExposedBonus(state);
    const amount = action.amount + exposed + (exposed > 0 ? action.exposedBonus ?? 0 : 0);
    dealMonsterDamage(state, player, amount);
    return;
  }

  if (action.type === "damageFromBlock") {
    dealMonsterDamage(state, player, Math.floor(player.block / action.divisor));
    return;
  }

  if (action.type === "executeDamage") {
    const amount = state.monster.hp <= action.threshold ? action.amount + action.bonus : action.amount;
    dealMonsterDamage(state, player, amount);
    return;
  }

  if (action.type === "block") {
    for (const target of getPlayerTargets(state, player, action.target)) {
      target.block += action.amount;
      pushEvent(state, "block", {
        target: { type: "player", playerId: target.id },
        amount: action.amount,
      });
    }
    return;
  }

  if (action.type === "heal") {
    for (const target of getPlayerTargets(state, player, action.target)) {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + action.amount);
      const healed = target.hp - before;
      if (healed > 0) {
        addThreat(state, player.id, Math.ceil(healed / 2));
        pushEvent(state, "heal", {
          target: { type: "player", playerId: target.id },
          amount: healed,
        });
      }
    }
    return;
  }

  if (action.type === "draw") {
    for (const target of getPlayerTargets(state, player, action.target)) {
      drawCards(state, target, action.count);
    }
    return;
  }

  if (action.type === "threat") {
    addThreat(state, player.id, action.amount);
    return;
  }

  if (action.type === "reduceThreat") {
    for (const target of getPlayerTargets(state, player, action.target)) {
      reduceThreat(state, target.id, action.amount);
    }
    return;
  }

  if (action.type === "weaken") {
    state.monster.statuses.weakened = Math.max(state.monster.statuses.weakened, action.amount);
    pushEvent(state, "ward", {
      target: { type: "monster" },
      amount: action.amount,
      label: "Weakened",
    });
    return;
  }

  if (action.type === "expose") {
    state.monster.statuses.exposed += action.amount;
    pushEvent(state, "criticalLine", {
      target: { type: "monster" },
      amount: action.amount,
      label: "Exposed",
    });
  }
}

function dealMonsterDamage(state, player, amount) {
  const damageAmount = Math.max(0, amount);
  state.monster.hp = Math.max(0, state.monster.hp - damageAmount);
  addThreat(state, player.id, damageAmount);
  pushEvent(state, "physicalHit", {
    target: { type: "monster" },
    amount: damageAmount,
  });
}

function resolveMonsterTurn(state) {
  const target = chooseMonsterTarget(state);
  if (!target) {
    return;
  }

  const reduction = state.monster.statuses.weakened;
  const damage = Math.max(1, state.monster.baseAttack + Math.floor(state.roundNumber / 2) - reduction);
  state.monster.statuses.weakened = 0;

  applyPlayerDamage(state, target, damage);
  pushLog(state, `${state.monster.name} attacks ${target.name} for ${damage}.`);
  pushEvent(state, "spellHit", {
    target: { type: "player", playerId: target.id },
    amount: damage,
    label: "Monster",
  });
}

function chooseMonsterTarget(state) {
  const livingPlayers = state.players.filter((player) => player.hp > 0);
  if (!livingPlayers.length) {
    return null;
  }

  return [...livingPlayers].sort((a, b) => {
    const threatDiff = getThreat(state, b.id) - getThreat(state, a.id);
    if (threatDiff !== 0) {
      return threatDiff;
    }
    return a.hp - b.hp;
  })[0];
}

function applyPlayerDamage(state, player, amount) {
  const blocked = Math.min(player.block, amount);
  player.block -= blocked;
  const remaining = amount - blocked;
  player.hp = Math.max(0, player.hp - remaining);
  if (blocked > 0) {
    pushEvent(state, "block", {
      target: { type: "player", playerId: player.id },
      amount: blocked,
    });
  }
}

function startNextRound(state) {
  for (const player of state.players) {
    player.block = 0;
    player.energyMax = Math.min(MAX_ENERGY, player.energyMax + 1);
    player.energy = player.energyMax;
    decayThreat(state, player.id, THREAT_DECAY);
    player.discard.push(...player.hand);
    player.hand = [];
    drawCards(state, player, DRAW_PER_ROUND);
  }

  state.roundNumber += 1;
  pushLog(state, `Round ${state.roundNumber} begins. Energy rises and threat decays by ${THREAT_DECAY}.`);
}

function drawCards(state, player, count) {
  for (let index = 0; index < count; index += 1) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) {
        return;
      }
      player.deck = shuffle(player.discard);
      player.discard = [];
      pushLog(state, `${player.name} reshuffles their discard into a new deck.`);
    }

    const card = player.deck.shift();
    player.hand.push(card);
    pushEvent(state, "draw", {
      target: { type: "player", playerId: player.id },
      label: "Draw",
    });
  }
}

function getPlayerTargets(state, player, targetType) {
  if (targetType === "self") {
    return [player];
  }
  if (targetType === "ally") {
    return state.players.filter((candidate) => candidate.id !== player.id && candidate.hp > 0);
  }
  if (targetType === "all") {
    return state.players.filter((candidate) => candidate.hp > 0);
  }
  if (targetType === "lowest") {
    const target = [...state.players]
      .filter((candidate) => candidate.hp > 0)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    return target ? [target] : [];
  }

  return [player];
}

function addThreat(state, playerId, amount) {
  state.monster.threat[playerId] = Math.min(20, getThreat(state, playerId) + amount);
  pushEvent(state, "threat", {
    target: { type: "player", playerId },
    amount,
  });
}

function reduceThreat(state, playerId, amount) {
  state.monster.threat[playerId] = Math.max(0, getThreat(state, playerId) - amount);
  pushEvent(state, "evasion", {
    target: { type: "player", playerId },
    amount,
  });
}

function decayThreat(state, playerId, amount) {
  state.monster.threat[playerId] = Math.max(0, getThreat(state, playerId) - amount);
}

function getThreat(state, playerId) {
  return state.monster.threat[playerId] ?? 0;
}

function consumeExposedBonus(state) {
  if (state.monster.statuses.exposed > 0) {
    const bonus = state.monster.statuses.exposed;
    state.monster.statuses.exposed = 0;
    return bonus;
  }

  return 0;
}

function ensurePlanning(state) {
  if (state.phase !== "planning") {
    throw new Error("The fight is already over.");
  }
}

function cloneState(state) {
  return structuredClone(state);
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function pushLog(state, entry) {
  state.log.unshift(entry);
  state.log = state.log.slice(0, 18);
}

function pushEvent(state, type, payload = {}) {
  state.events.push({
    id: state.nextEventId,
    type,
    ...payload,
  });
  state.nextEventId += 1;
  state.events = state.events.slice(-80);
}
