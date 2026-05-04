import { classDefinitions } from "../content/classes.js";
import { DECK_SIZE, getCardDefinition, starterDecks } from "../content/cards.js";
import {
  DEFAULT_MONSTER_ID,
  createMonsterById,
  phaseHooks,
} from "../content/monsters.js";
import { getBlessingById } from "../content/blessings.js";

export const DRAW_PER_ROUND = 5;
export const STARTING_ENERGY = 3;
export const MAX_ENERGY = 10;
export const THREAT_DECAY = 3;
export const FIXATE_THREAT_THRESHOLD = 15;
export const FIXATE_DURATION = 2;

export function createCoopBattle(config = {}) {
  const playerConfigs =
    config.players ??
    [
      { id: "player-1", classId: "rook" },
      { id: "player-2", classId: "lyra" },
    ];

  const players = playerConfigs.map((playerConfig, index) => createPlayer(playerConfig, index + 1));
  const monsterId = config.monsterId ?? DEFAULT_MONSTER_ID;
  const playerIds = players.map((p) => p.id);
  const monster = createMonsterById(monsterId, players.length, playerIds);

  const state = {
    mode: "coop-boss",
    phase: "planning",
    roundNumber: 1,
    players,
    monster,
    winner: null,
    log: [],
    events: [],
    nextEventId: 1,
    // Per-fight blessing. Only the ID lives on state (functions can't be
    // structuredClone'd); helpers re-resolve via getBlessingById.
    blessingId: config.blessingId ?? null,
    blessingFlags: {},
  };

  for (const player of state.players) {
    drawCards(state, player, DRAW_PER_ROUND);
  }

  // Apply blessing — `apply` runs once at fight start, before round 1's
  // onRoundStart so per-round bonuses (Quickdraw, Healer's Cradle) layer
  // on top of any apply-time mutations.
  const blessing = getBlessingById(state.blessingId);
  if (blessing) {
    blessing.apply?.(state);
    pushLog(state, {
      kind: "info",
      text: `${blessing.name} blesses the party — ${blessing.description}`,
    });
    blessing.onRoundStart?.(state);
  }

  pushLog(state, {
    kind: "round-start",
    round: 1,
    text: `Round 1 begins. ${monster.name} steps into the arena. Plan your opening moves together.`,
  });
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
  // Crit Vision blessing: the first card a player queues this round costs
  // 1 less energy. "First this round" = no other card currently planned
  // already carries a discount. If they unqueue and re-queue, the discount
  // transfers naturally.
  let effectiveCost = card.cost;
  if (
    state.blessingFlags?.firstCardDiscount &&
    !player.planned.some((c) => c.discountedCost !== undefined)
  ) {
    effectiveCost = Math.max(0, card.cost - 1);
  }
  if (getRemainingEnergy(player) < effectiveCost) {
    throw new Error(`${player.name} does not have enough energy for ${card.name}.`);
  }

  if (effectiveCost !== card.cost) {
    cardInstance.discountedCost = effectiveCost;
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
  // Returning the card to hand wipes any discount it carried — if it gets
  // re-queued and there's still no other discounted card planned, queueCard
  // will reapply the discount cleanly.
  delete cardInstance.discountedCost;
  player.hand.push(cardInstance);
  return state;
}

export function resolveRound(currentState) {
  const state = cloneState(currentState);
  ensurePlanning(state);

  if (state.players.every((player) => player.planned.length === 0)) {
    throw new Error("Queue at least one action before resolving the round.");
  }

  pushLog(state, {
    kind: "phase-banner",
    phase: "player",
    round: state.roundNumber,
    text: `Round ${state.roundNumber} · Player phase`,
  });

  for (const player of state.players) {
    for (const cardInstance of player.planned) {
      const card = getCardDefinition(cardInstance.cardId);
      const cost = cardInstance.discountedCost ?? card.cost;
      player.energy -= cost;
      const monsterHpBefore = state.monster.hp;
      resolveCard(state, player, card);
      player.discard.push(cardInstance);
      const damageDealt = monsterHpBefore - state.monster.hp;
      pushLog(state, {
        kind: "card-use",
        actor: player.name,
        classId: player.classId,
        card: card.name,
        role: card.role,
        cost,
        damage: damageDealt > 0 ? damageDealt : 0,
        text: buildCardUseText(player, card, damageDealt),
      });
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
    pushLog(state, {
      kind: "outcome",
      outcome: "victory",
      text: `${state.monster.name} falls. The party wins.`,
    });
    return state;
  }

  pushLog(state, {
    kind: "phase-banner",
    phase: "monster",
    round: state.roundNumber,
    text: `Round ${state.roundNumber} · Monster phase`,
  });
  resolveMonsterTurn(state);
  if (state.players.every((player) => player.hp <= 0)) {
    state.phase = "game-over";
    state.winner = "monster";
    pushLog(state, {
      kind: "outcome",
      outcome: "defeat",
      text: `${state.monster.name} overwhelms the party.`,
    });
    return state;
  }

  startNextRound(state);
  return state;
}

function buildCardUseText(player, card, damageDealt) {
  const verb = card.role === "attack" ? "attacks with" : card.role === "defense" ? "braces" : card.role === "healing" ? "channels" : "plays";
  if (damageDealt > 0) {
    return `${player.name} ${verb} ${card.name} — ${damageDealt} damage`;
  }
  return `${player.name} ${verb} ${card.name}`;
}

export function getRemainingEnergy(player) {
  const plannedCost = player.planned.reduce((total, cardInstance) => {
    const card = getCardDefinition(cardInstance.cardId);
    const cost = cardInstance.discountedCost ?? card.cost;
    return total + cost;
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
    // Generic status counter bag. Engine decays anything declared in
    // `statusDecay` at end of round. Cards/monsters can write arbitrary
    // keys (marked, frenzy, ...). See addPlayerStatus / getPlayerStatus.
    statuses: {},
    statusDecay: {},
  };
}

function resolveCard(state, player, card) {
  for (const action of card.actions) {
    resolveAction(state, player, action);
  }
  // Per-card blessing hook (Mending Tide etc.). Re-resolve via id so the
  // function reference survives state cloning across operations.
  const blessing = getBlessingById(state.blessingId);
  blessing?.onCardResolve?.(state, player, card);
}

function resolveAction(state, player, action) {
  if (action.type === "damage") {
    const exposed = consumeExposedBonus(state);
    const amount = action.amount + exposed + (exposed > 0 ? action.exposedBonus ?? 0 : 0);
    dealMonsterDamage(state, player, amount, action.element);
    return;
  }

  if (action.type === "damageFromBlock") {
    dealMonsterDamage(
      state,
      player,
      Math.floor(player.block / action.divisor),
      action.element,
    );
    return;
  }

  if (action.type === "executeDamage") {
    const amount = state.monster.hp <= action.threshold ? action.amount + action.bonus : action.amount;
    dealMonsterDamage(state, player, amount, action.element);
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

  if (action.type === "taunt") {
    addThreat(state, player.id, 5);
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

function dealMonsterDamage(state, player, amount, element) {
  const rawDamage = Math.max(0, amount);
  if (rawDamage === 0) {
    return;
  }
  const el = element ?? "physical";
  const multiplier = getElementMultiplier(state.monster, el);
  const defense = state.monster.defense ?? 0;
  // Element first, then defense subtraction. Floor at 0.
  const afterElement = Math.ceil(rawDamage * multiplier);
  let finalDamage = Math.max(0, afterElement - defense);
  // Glass Cannon blessing: +1 to any non-zero damage hit, applied after
  // mitigation so the bonus survives even high-defense monsters.
  if (state.blessingFlags?.glassCannon && finalDamage > 0) {
    finalDamage += 1;
  }

  state.monster.hp = Math.max(0, state.monster.hp - finalDamage);
  // Threat tracks the actual damage applied (post-mitigation) so
  // defense doesn't accidentally mute fixate / target priority.
  addThreat(state, player.id, finalDamage);
  pushEvent(state, "physicalHit", {
    target: { type: "monster" },
    amount: finalDamage,
    label: el === "physical" ? undefined : capitalize(el),
  });

  // Phase machine: descending HP triggers thresholds.
  checkPhaseTransition(state);
}

function getElementMultiplier(monster, element) {
  if (!element || element === "physical" || element === "spell") {
    // Default neutral. Resistances may still target these explicitly.
    const tagged = monster.elementResistances?.[element];
    return typeof tagged === "number" ? tagged : 1;
  }
  const value = monster.elementResistances?.[element];
  return typeof value === "number" ? value : 1;
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function checkPhaseTransition(state) {
  const monster = state.monster;
  if (!Array.isArray(monster.phases) || monster.phases.length === 0) {
    return;
  }

  const hpFrac = monster.maxHp > 0 ? monster.hp / monster.maxHp : 0;
  // Phases are sorted by descending hpThresholdPct; we walk forward until
  // the monster's HP fraction drops at or below the next threshold.
  let nextIndex = monster.activePhaseIndex ?? 0;
  while (
    nextIndex + 1 < monster.phases.length &&
    hpFrac <= monster.phases[nextIndex + 1].hpThresholdPct
  ) {
    nextIndex += 1;
    const phase = monster.phases[nextIndex];
    monster.activePhaseIndex = nextIndex;

    pushEvent(state, "phase-enter", {
      target: { type: "monster" },
      label: phase.id,
    });
    const description = describePhase(monster, phase);
    pushLog(state, {
      kind: "phase-enter",
      phaseId: phase.id,
      text: description,
    });

    if (phase.onEnter) {
      const hook = phaseHooks[phase.onEnter];
      if (typeof hook === "function") {
        hook(state);
      }
    }

    if (monster.hp <= 0) {
      break;
    }
  }
}

function describePhase(monster, phase) {
  // Lightweight flavor for the log. Bosses can override by registering
  // their own phase descriptions, but for v1 we stitch a simple line.
  const pct = Math.round((phase.hpThresholdPct ?? 0) * 100);
  if (phase.id === "crushing-bulwark") {
    return `${monster.name} hunkers down — Crushing Bulwark active (defense rises). [${pct}% HP]`;
  }
  if (phase.id === "pack-convergence") {
    return `${monster.name} calls the pack — Pack Convergence: extra strike per turn. [${pct}% HP]`;
  }
  if (phase.id === "override-protocol") {
    return `${monster.name} engages Override Protocol — threat values inverted, surveillance dampens each turn. [${pct}% HP]`;
  }
  if (phase.id === "judgement-mode") {
    return `${monster.name} enters Judgement Mode — converges on the highest threat, twice per turn. [${pct}% HP]`;
  }
  if (phase.id === "p1" || phase.id === "surveillance") {
    return `${monster.name} engages.`;
  }
  return `${monster.name} enters phase ${phase.id} (${pct}% HP).`;
}

function resolveMonsterTurn(state) {
  // Optional per-monster pre-turn hook. Phase hooks may install a
  // function on `monster.onMonsterTurnStart` to run side-effects (e.g.
  // Warden's Override Protocol dampening all threat by 2 each turn).
  if (typeof state.monster.onMonsterTurnStart === "function") {
    state.monster.onMonsterTurnStart(state);
  }

  const actions = Math.max(1, state.monster.actionsPerTurn ?? 1);
  // Weakened reduction applies to the first hit only (consumes once).
  let weakenConsumed = false;

  for (let actionIndex = 0; actionIndex < actions; actionIndex += 1) {
    if (state.players.every((player) => player.hp <= 0)) {
      return;
    }

    const target = chooseMonsterTarget(state);
    if (!target) {
      return;
    }

    const reduction = weakenConsumed ? 0 : (state.monster.statuses.weakened ?? 0);
    if (!weakenConsumed) {
      state.monster.statuses.weakened = 0;
      weakenConsumed = true;
    }
    const damage = Math.max(
      1,
      state.monster.baseAttack + Math.floor(state.roundNumber / 2) - reduction,
    );

    const blockBefore = target.block;
    applyPlayerDamage(state, target, damage);
    const blocked = Math.min(blockBefore, damage);
    const through = damage - blocked;
    pushLog(state, {
      kind: "monster-attack",
      target: target.name,
      targetClassId: target.classId,
      damage,
      blocked,
      through,
      text: through > 0
        ? `${state.monster.name} strikes ${target.name} for ${damage} (${blocked > 0 ? `${blocked} blocked, ` : ""}${through} through)`
        : `${state.monster.name} strikes ${target.name} — ${damage} fully blocked`,
    });
    pushEvent(state, "spellHit", {
      target: { type: "player", playerId: target.id },
      amount: damage,
      label: "Monster",
    });
  }
}

function chooseMonsterTarget(state) {
  const livingPlayers = state.players.filter((player) => player.hp > 0);
  if (!livingPlayers.length) {
    return null;
  }

  // Fixate-aware target selector. Locks onto the marked player while
  // their `marked` counter is > 0, regardless of threat tiebreak.
  if (state.monster.targetSelector === "fixate") {
    const fixated = selectTargetWithFixate(state, livingPlayers);
    if (fixated) {
      return fixated;
    }
  }

  return defaultTargetSelector(state, livingPlayers);
}

function defaultTargetSelector(state, livingPlayers) {
  return [...livingPlayers].sort((a, b) => {
    const threatDiff = getThreat(state, b.id) - getThreat(state, a.id);
    if (threatDiff !== 0) {
      return threatDiff;
    }
    return a.hp - b.hp;
  })[0];
}

function selectTargetWithFixate(state, livingPlayers) {
  const monster = state.monster;
  // If currently fixated, keep targeting that player while marked > 0
  // and they're alive.
  const current = monster.fixate;
  if (current && current.roundsRemaining > 0) {
    const target = livingPlayers.find((p) => p.id === current.playerId);
    if (target) {
      return target;
    }
    monster.fixate = null;
  }

  // Otherwise, check if any living player has crossed the fixate threshold
  // and lock onto the highest-threat one. Monsters can override the
  // threshold via `monster.fixateThreshold` (e.g. Warden phase 3 = 10).
  const threshold = monster.fixateThreshold ?? FIXATE_THREAT_THRESHOLD;
  const candidates = livingPlayers
    .filter((p) => getThreat(state, p.id) >= threshold)
    .sort((a, b) => getThreat(state, b.id) - getThreat(state, a.id));

  if (candidates.length === 0) {
    return defaultTargetSelector(state, livingPlayers);
  }

  const lock = candidates[0];
  monster.fixate = {
    playerId: lock.id,
    roundsRemaining: FIXATE_DURATION,
  };
  addPlayerStatus(state, lock.id, "marked", FIXATE_DURATION);
  pushLog(state, {
    kind: "fixate",
    playerId: lock.id,
    text: `${monster.name} fixates on ${lock.name} — marked for ${FIXATE_DURATION} rounds.`,
  });
  pushEvent(state, "criticalLine", {
    target: { type: "player", playerId: lock.id },
    label: "Marked",
    amount: FIXATE_DURATION,
  });
  return lock;
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
  const energyCap = MAX_ENERGY + (state.blessingFlags?.energyCapBonus ?? 0);
  const threatDecay = THREAT_DECAY + (state.blessingFlags?.threatDecayBonus ?? 0);
  for (const player of state.players) {
    player.block = 0;
    player.energyMax = Math.min(energyCap, player.energyMax + 1);
    player.energy = player.energyMax;
    // Canonical rule: fixated players do not lose threat during end-of-round
    // decay. Their threat only drops via the post-fixate halve in decayFixate.
    const fix = state.monster.fixate;
    const isFixated =
      fix && fix.roundsRemaining > 0 && fix.playerId === player.id;
    if (!isFixated) {
      decayThreat(state, player.id, threatDecay);
    }
    player.discard.push(...player.hand);
    player.hand = [];
    drawCards(state, player, DRAW_PER_ROUND);
  }

  // Decay generic player status counters (marked, frenzy, ...)
  decayPlayerStatuses(state);
  // Decay monster fixate timer; on expiry, halve target's threat once.
  decayFixate(state);

  state.roundNumber += 1;

  // Warden of Targeting — Phase 1 "Surveillance": every other round,
  // mark the lowest-threat living player as "tracked" for 2 rounds.
  // Runs first so blessing hooks below see the post-surveillance state.
  applyWardenSurveillance(state);

  // Per-round blessing hook fires AFTER the standard reset (and after the
  // monster's start-of-round effects) so things like Quickdraw add cards
  // on top of the round's normal 5-card draw.
  getBlessingById(state.blessingId)?.onRoundStart?.(state);

  const energyMax = state.players[0]?.energyMax ?? STARTING_ENERGY;
  const threatSummary = state.players
    .map((p) => `${p.name} ${getThreat(state, p.id)}`)
    .join(" / ");
  pushLog(state, {
    kind: "round-start",
    round: state.roundNumber,
    text: `Round ${state.roundNumber} · Energy ${energyMax}/${energyCap} · Threat: ${threatSummary}`,
  });
}

function applyWardenSurveillance(state) {
  const monster = state.monster;
  const phase = monster.phases?.[monster.activePhaseIndex ?? 0];
  if (!phase || phase.id !== "surveillance") {
    return;
  }
  if (state.roundNumber % 2 !== 0) {
    return;
  }
  const living = state.players.filter((p) => p.hp > 0);
  if (living.length === 0) {
    return;
  }
  // Find the lowest current threat. Ties broken by player order.
  const target = [...living].sort(
    (a, b) => getThreat(state, a.id) - getThreat(state, b.id),
  )[0];
  addPlayerStatus(state, target.id, "tracked", 2, { mode: "max", decay: 1 });
  pushLog(state, {
    kind: "info",
    text: `${monster.name} marks ${target.name} for surveillance — threat gain amplified.`,
  });
  pushEvent(state, "criticalLine", {
    target: { type: "player", playerId: target.id },
    label: "Tracked",
    amount: 2,
  });
}

// Player status helpers. The `statuses` bag holds arbitrary numeric counters
// (marked, frenzy, ...). `statusDecay` declares how each counter decays per
// round end; default is 1 if a key is added without explicit decay.
export function addPlayerStatus(state, playerId, key, amount = 1, options = {}) {
  const player = getPlayer(state, playerId);
  if (!player.statuses) {
    player.statuses = {};
  }
  if (!player.statusDecay) {
    player.statusDecay = {};
  }
  if (options.mode === "set") {
    player.statuses[key] = amount;
  } else if (options.mode === "max") {
    player.statuses[key] = Math.max(player.statuses[key] ?? 0, amount);
  } else {
    player.statuses[key] = (player.statuses[key] ?? 0) + amount;
  }
  if (options.decay !== undefined) {
    player.statusDecay[key] = options.decay;
  } else if (player.statusDecay[key] === undefined) {
    // Default: tick down by 1 per round end.
    player.statusDecay[key] = 1;
  }
  return player.statuses[key];
}

export function getPlayerStatus(state, playerId, key) {
  const player = getPlayer(state, playerId);
  return player.statuses?.[key] ?? 0;
}

export function decayPlayerStatuses(state) {
  for (const player of state.players) {
    if (!player.statuses) {
      continue;
    }
    const decay = player.statusDecay ?? {};
    for (const key of Object.keys(player.statuses)) {
      const amount = decay[key];
      if (typeof amount !== "number" || amount <= 0) {
        continue;
      }
      const next = (player.statuses[key] ?? 0) - amount;
      if (next <= 0) {
        delete player.statuses[key];
      } else {
        player.statuses[key] = next;
      }
    }
  }
}

function decayFixate(state) {
  const monster = state.monster;
  const fixate = monster.fixate;
  if (!fixate) {
    return;
  }
  fixate.roundsRemaining -= 1;
  if (fixate.roundsRemaining <= 0) {
    // Halve the formerly-marked player's threat (rounded down).
    const target = state.players.find((p) => p.id === fixate.playerId);
    if (target) {
      const before = getThreat(state, target.id);
      const after = Math.floor(before / 2);
      monster.threat[target.id] = after;
      pushLog(state, {
        kind: "fixate-end",
        playerId: target.id,
        text: `${monster.name}'s fixation on ${target.name} fades. Threat ${before} → ${after}.`,
      });
    }
    monster.fixate = null;
  }
}

export function drawCards(state, player, count) {
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
  const cap = state.monster.threatMax ?? 20;
  // Warden phase 1 "tracked" status amplifies any threat gain by +2.
  // Applies whenever the player has tracked > 0 and we're adding a
  // positive amount (no boost when amount is 0/negative).
  let bonus = 0;
  if (amount > 0 && getPlayerStatus(state, playerId, "tracked") > 0) {
    bonus = 2;
  }
  // Canonical rule: while a monster is fixated on someone else, every other
  // player's positive threat gain is reduced by 1 (floor 0). The fixated
  // player themselves is unaffected.
  let reduction = 0;
  const fix = state.monster.fixate;
  if (amount > 0 && fix && fix.roundsRemaining > 0 && fix.playerId !== playerId) {
    reduction = 1;
  }
  const adjusted = Math.max(0, amount + bonus - reduction);
  state.monster.threat[playerId] = Math.min(cap, getThreat(state, playerId) + adjusted);
  pushEvent(state, "threat", {
    target: { type: "player", playerId },
    amount: adjusted,
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
  const normalized = typeof entry === "string" ? { kind: "info", text: entry } : entry;
  state.log.unshift(normalized);
  state.log = state.log.slice(0, 24);
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
