import { classDefinitions } from "../content/classes.js";
import { raceDefinitions } from "../content/races.js";
import { getCardDefinition, starterDecks } from "../content/cards.js";

const FIELD_SLOTS = 7;
const FIRST_PLAYER_OPENING_HAND = 3;
const SECOND_PLAYER_OPENING_HAND = 4;

export function createLocalDuel(config) {
  const players = config.players.map((playerConfig, index) =>
    createPlayer(playerConfig, `player-${index + 1}`),
  );

  const state = {
    mode: "duel",
    turnNumber: 1,
    activePlayerId: players[0].id,
    players,
    winnerId: null,
    log: [],
    events: [],
    nextEventId: 1,
  };

  for (const [index, player] of state.players.entries()) {
    const openingHandSize = index === 0 ? FIRST_PLAYER_OPENING_HAND : SECOND_PLAYER_OPENING_HAND;
    drawCards(state, player, openingHandSize + getRace(player).startingHandBonus);
    if (index === 1) {
      player.hand.push({ instanceId: `${player.id}-spark-coin`, cardId: "neutral.spark-coin" });
      pushLog(state, `${player.name} receives Spark Coin.`);
    }
  }

  startTurn(state, players[0], { draw: false });
  pushLog(state, `${players[0].name} takes the first turn.`);
  return state;
}

export function playCard(currentState, command) {
  const state = cloneState(currentState);
  ensureGameActive(state);

  const player = getPlayer(state, command.playerId);
  ensureActivePlayer(state, player);

  const handIndex = player.hand.findIndex((card) => card.instanceId === command.instanceId);
  if (handIndex < 0) {
    throw new Error("That card is not in the active player's hand.");
  }

  const cardInstance = player.hand[handIndex];
  const card = getCardDefinition(cardInstance.cardId);
  ensurePlayableCard(state, player, card, command.target);

  player.mana -= getCardCost(player, card);
  player.hand.splice(handIndex, 1);

  if (card.kind === "monster") {
    summonMonster(state, player, cardInstance, card);
    resolveCardActions(state, player, card, command.target);
  } else {
    resolveCardActions(state, player, card, command.target);
    player.discard.push(cardInstance);
    pushLog(state, `${player.name} plays ${card.name}.`);
  }

  checkWinCondition(state);
  return state;
}

export function attackWithMonster(currentState, command) {
  const state = cloneState(currentState);
  ensureGameActive(state);

  const player = getPlayer(state, command.playerId);
  ensureActivePlayer(state, player);

  const monster = player.field[command.slotIndex];
  if (!monster) {
    throw new Error("No monster exists in that field slot.");
  }
  if (!monster.ready) {
    throw new Error(`${monster.name} is not ready to attack.`);
  }
  if (!isValidEnemyTarget(state, player.id, command.target, { ignoresGuard: false })) {
    throw new Error("That is not a valid monster attack target.");
  }

  monster.ready = false;
  if (triggerSnareTrap(state, player, command.slotIndex)) {
    checkWinCondition(state);
    return state;
  }

  const damage = prepareOutgoingDamage(
    state,
    player,
    monster.attack + getRace(player).damageBonus,
    monster.name,
    command.target,
  );
  pushEvent(state, "physicalAttack", {
    source: { type: "monster", playerId: player.id, slotIndex: command.slotIndex },
    target: command.target,
    label: monster.name,
  });

  if (command.target.type === "monster") {
    applyMonsterCombat(state, player, command.slotIndex, command.target, damage);
  } else {
    applyDamage(state, player, command.target, damage, `${monster.name}`, "physicalHit");
    pushLog(state, `${player.name}'s ${monster.name} attacks.`);
  }
  checkWinCondition(state);
  return state;
}

export function endTurn(currentState, playerId) {
  const state = cloneState(currentState);
  ensureGameActive(state);

  const player = getPlayer(state, playerId);
  ensureActivePlayer(state, player);

  const nextPlayer = getNextPlayer(state, player.id);
  state.activePlayerId = nextPlayer.id;
  state.turnNumber += 1;
  startTurn(state, nextPlayer, { draw: true });
  pushLog(state, `${nextPlayer.name}'s turn begins.`);
  return state;
}

export function getValidTargets(state, playerId, card) {
  if (card.target === "none") {
    return [];
  }

  const player = getPlayer(state, playerId);
  if (card.target === "self") {
    return [{ type: "hero", playerId: player.id }];
  }

  const targets = [];
  for (const otherPlayer of state.players) {
    if (!areEnemies(state, player.id, otherPlayer.id)) {
      continue;
    }

    const heroTarget = { type: "hero", playerId: otherPlayer.id };
    if (isValidEnemyTarget(state, player.id, heroTarget, card)) {
      targets.push(heroTarget);
    }

    otherPlayer.field.forEach((monster, slotIndex) => {
      if (monster) {
        targets.push({ type: "monster", playerId: otherPlayer.id, slotIndex });
      }
    });
  }

  return targets;
}

export function getValidMonsterTargets(state, playerId) {
  const player = getPlayer(state, playerId);
  const targets = [];

  for (const otherPlayer of state.players) {
    if (!areEnemies(state, player.id, otherPlayer.id)) {
      continue;
    }

    const heroTarget = { type: "hero", playerId: otherPlayer.id };
    if (isValidEnemyTarget(state, player.id, heroTarget, { ignoresGuard: false })) {
      targets.push(heroTarget);
    }

    otherPlayer.field.forEach((monster, slotIndex) => {
      if (monster) {
        targets.push({ type: "monster", playerId: otherPlayer.id, slotIndex });
      }
    });
  }

  return targets;
}

export function getActivePlayer(state) {
  return getPlayer(state, state.activePlayerId);
}

export function getPlayer(state, playerId) {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new Error(`Unknown player: ${playerId}`);
  }

  return player;
}

export function getCardCost(player, card) {
  const firstSpellDiscount =
    getRace(player).firstSpellDiscount &&
    card.kind === "spell" &&
    card.cost > 0 &&
    !player.flags.usedFirstSpellDiscount
      ? getRace(player).firstSpellDiscount
      : 0;

  return Math.max(0, card.cost - firstSpellDiscount);
}

export function targetKey(target) {
  if (!target) {
    return "";
  }
  if (target.type === "hero") {
    return `hero:${target.playerId}`;
  }

  return `monster:${target.playerId}:${target.slotIndex}`;
}

function createPlayer(playerConfig, fallbackId) {
  const classDef = classDefinitions[playerConfig.classId];
  const raceId = playerConfig.raceId ?? classDef.raceId;
  const raceDef = raceDefinitions[raceId];
  if (!classDef) {
    throw new Error(`Unknown class: ${playerConfig.classId}`);
  }
  if (!raceDef) {
    throw new Error(`Unknown race: ${playerConfig.raceId}`);
  }
  if (!starterDecks[classDef.id]) {
    throw new Error(`${classDef.name} does not have a starter deck yet.`);
  }

  const maxHp = classDef.maxHp + raceDef.maxHpBonus;
  const id = playerConfig.id ?? fallbackId;
  const deck = starterDecks[classDef.id].map((cardId, index) => ({
    instanceId: `${id}-card-${index + 1}`,
    cardId,
  }));

  const name = playerConfig.name ?? classDef.name;

  return {
    id,
    name,
    classId: classDef.id,
    raceId: raceDef.id,
    maxManaCrystals: classDef.maxManaCrystals,
    manaCrystals: 0,
    mana: 0,
    hero: {
      name,
      hp: maxHp,
      maxHp,
      block: 0,
      statuses: [],
      ultimateCharge: 0,
    },
    deck: shuffle(deck),
    hand: [],
    discard: [],
    field: Array.from({ length: FIELD_SLOTS }, () => null),
    counters: {
      pressure: 0,
      storedDamage: 0,
      comboCharge: 0,
      loot: 0,
      instability: 0,
      polarity: "neutral",
      polarityChanges: 0,
    },
    flags: {
      usedFirstSpellDiscount: false,
      polarityChangedThisTurn: false,
    },
  };
}

function startTurn(state, player, options) {
  player.hero.block = 0;
  player.flags.usedFirstSpellDiscount = false;
  player.flags.polarityChangedThisTurn = false;

  player.manaCrystals = Math.min(player.maxManaCrystals, player.manaCrystals + 1);
  const slowStacks = consumeStatus(player.hero, "slow");
  player.mana = Math.max(0, player.manaCrystals - slowStacks);

  for (const monster of player.field) {
    if (monster) {
      monster.ready = true;
    }
  }

  if (options.draw) {
    drawCards(state, player, 1);
  }

  if (slowStacks > 0) {
    pushLog(state, `${player.name} is slowed and starts with ${player.mana} mana.`);
  }
}

function drawCards(state, player, count) {
  for (let i = 0; i < count; i += 1) {
    if (player.deck.length === 0 && player.discard.length > 0) {
      player.deck = shuffle(player.discard);
      player.discard = [];
      pushLog(state, `${player.name} reshuffles their discard pile.`);
    }

    if (player.deck.length === 0) {
      pushLog(state, `${player.name} has no cards left to draw.`);
      return;
    }

    player.hand.push(player.deck.shift());
    pushEvent(state, "draw", {
      playerId: player.id,
      target: { type: "hero", playerId: player.id },
    });
  }
}

function ensurePlayableCard(state, player, card, target) {
  const cost = getCardCost(player, card);
  if (player.mana < cost) {
    throw new Error(`${card.name} costs ${cost} mana.`);
  }

  if (card.kind === "monster") {
    if (!player.field.some((slot) => slot === null)) {
      throw new Error("There are no empty field slots.");
    }
    return;
  }

  if (card.target === "self") {
    if (targetKey(target) !== targetKey({ type: "hero", playerId: player.id })) {
      throw new Error(`${card.name} must target yourself.`);
    }
    return;
  }

  if (card.target === "enemy" && !isValidEnemyTarget(state, player.id, target, card)) {
    throw new Error(`${card.name} needs a valid enemy target.`);
  }
}

function resolveCardActions(state, player, card, target) {
  if (
    getRace(player).firstSpellDiscount &&
    card.kind === "spell" &&
    card.cost > 0 &&
    !player.flags.usedFirstSpellDiscount
  ) {
    player.flags.usedFirstSpellDiscount = true;
  }

  for (const action of card.actions ?? []) {
    if (!shouldResolveAction(player, action)) {
      continue;
    }

    if (action.type === "damage") {
      const amount = getActionDamageAmount(state, player, action, target, card.name);
      applyDamage(state, player, target, amount, card.name, "spellHit");
    }

    if (action.type === "damageIfCounterAtLeast") {
      const counterValue = getCounter(player, action.counter);
      const amount = action.baseAmount + (counterValue >= action.threshold ? action.bonusAmount : 0);
      applyDamage(state, player, target, amount, card.name, "spellHit");
      if (counterValue >= action.threshold && action.spendCounterOnBonus) {
        setCounter(state, player, action.counter, 0);
      }
    }

    if (action.type === "randomDamage") {
      const amount = rollDamage(state, player, action.min, action.max);
      applyDamage(state, player, target, amount, `${card.name} rolls ${amount}`, "spellHit");
    }

    if (action.type === "block") {
      const blockAmount = action.amount + getRace(player).blockBonus;
      player.hero.block += blockAmount;
      pushEvent(state, "block", {
        target: { type: "hero", playerId: player.id },
        amount: blockAmount,
      });
      pushLog(state, `${player.name} gains ${blockAmount} block.`);
    }

    if (action.type === "selfDamage") {
      applyDirectHeroDamage(state, player, action.amount, card.name);
    }

    if (action.type === "draw") {
      drawCards(state, player, action.count);
      pushLog(state, `${player.name} draws ${action.count} card.`);
    }

    if (action.type === "discardRandom") {
      discardRandomCards(state, player, action.count);
    }

    if (action.type === "gainMana") {
      player.mana = Math.min(player.maxManaCrystals, player.mana + action.amount);
      pushEvent(state, "mana", {
        target: { type: "hero", playerId: player.id },
        amount: action.amount,
      });
      pushLog(state, `${player.name} gains ${action.amount} mana this turn.`);
    }

    if (action.type === "gainCounter") {
      addCounter(state, player, action.counter, action.amount);
    }

    if (action.type === "storeDamage") {
      addCounter(state, player, "storedDamage", action.amount);
    }

    if (action.type === "setPolarity") {
      setPolarity(state, player, action.value);
    }

    if (action.type === "flipPolarity") {
      setPolarity(state, player, player.counters.polarity === "positive" ? "negative" : "positive");
    }

    if (action.type === "damageRandomEnemy") {
      damageRandomEnemy(state, player, action.amount, card.name);
    }

    if (action.type === "areaDamage") {
      const repeatCount = action.repeatIfPolarityChanged && player.flags.polarityChangedThisTurn ? 2 : 1;
      for (let i = 0; i < repeatCount; i += 1) {
        damageAllEnemies(state, player, action.amount, card.name);
      }
    }

    if (action.type === "chaosCatastrophe") {
      resolveChaosCatastrophe(state, player, action, card.name);
    }

    if (action.type === "applyStatus" && canApplyStatus(action, target)) {
      const statusTargetDescriptor = action.targetOverride === "self" ? { type: "hero", playerId: player.id } : target;
      const statusTarget = getTargetEntity(state, statusTargetDescriptor);
      addStatus(statusTarget, action.status, action.duration);
      pushEvent(state, action.status, {
        target: statusTargetDescriptor,
        label: action.status,
      });
      pushLog(state, `${statusTarget.name} gains ${action.status}.`);
    }
  }
}

function summonMonster(state, player, cardInstance, card) {
  const slotIndex = player.field.findIndex((slot) => slot === null);
  if (slotIndex < 0) {
    throw new Error("There are no empty field slots.");
  }

  const monsterTemplate = getMonsterTemplate(player, card);
  player.field[slotIndex] = {
    instanceId: cardInstance.instanceId,
    cardId: card.id,
    ownerId: player.id,
    name: monsterTemplate.name ?? card.name,
    attack: monsterTemplate.attack,
    hp: monsterTemplate.hp,
    maxHp: monsterTemplate.hp,
    traits: [...(monsterTemplate.traits ?? [])],
    statuses: [],
    ready: false,
  };

  pushEvent(state, "summon", {
    target: { type: "monster", playerId: player.id, slotIndex },
    label: card.name,
  });
  pushLog(state, `${player.name} summons ${card.name}.`);
}

function applyDamage(state, sourcePlayer, target, amount, sourceName, effectType) {
  const targetEntity = getTargetEntity(state, target);

  if (target.type === "hero" && consumeStatus(targetEntity, "ward") > 0) {
    pushEvent(state, "ward", {
      target,
      label: sourceName,
    });
    pushLog(state, `${targetEntity.name}'s ward prevents ${sourceName}.`);
    return;
  }

  if (target.type === "hero" && consumeStatus(targetEntity, "evasion") > 0) {
    pushEvent(state, "evasion", {
      target,
      label: sourceName,
    });
    pushLog(state, `${targetEntity.name} evades ${sourceName}.`);
    return;
  }

  let remainingDamage = amount;
  if (target.type === "hero" && targetEntity.block > 0) {
    const blocked = Math.min(targetEntity.block, remainingDamage);
    targetEntity.block -= blocked;
    remainingDamage -= blocked;
    pushEvent(state, "block", {
      target,
      amount: blocked,
    });
    pushLog(state, `${targetEntity.name} blocks ${blocked} damage.`);
  }

  if (remainingDamage > 0) {
    targetEntity.hp = Math.max(0, targetEntity.hp - remainingDamage);
    sourcePlayer.hero.ultimateCharge = Math.min(10, sourcePlayer.hero.ultimateCharge + remainingDamage);
    pushEvent(state, effectType, {
      target,
      amount: remainingDamage,
      label: sourceName,
    });
    pushLog(state, `${sourceName} deals ${remainingDamage} damage to ${targetEntity.name}.`);
  } else {
    pushLog(state, `${targetEntity.name} absorbs ${sourceName}.`);
  }

  if (target.type === "monster" && targetEntity.hp <= 0) {
    defeatMonster(state, target);
  }
}

function applyMonsterCombat(state, sourcePlayer, attackerSlotIndex, defenderTarget, attackDamage) {
  const attacker = sourcePlayer.field[attackerSlotIndex];
  const defenderOwner = getPlayer(state, defenderTarget.playerId);
  const defender = defenderOwner.field[defenderTarget.slotIndex];
  const defenderDamage = defender.attack + getRace(defenderOwner).damageBonus;

  defender.hp = Math.max(0, defender.hp - attackDamage);
  attacker.hp = Math.max(0, attacker.hp - defenderDamage);
  sourcePlayer.hero.ultimateCharge = Math.min(10, sourcePlayer.hero.ultimateCharge + Math.max(1, attackDamage));
  pushEvent(state, "physicalHit", {
    target: defenderTarget,
    amount: attackDamage,
    label: attacker.name,
  });
  pushEvent(state, "physicalHit", {
    target: { type: "monster", playerId: sourcePlayer.id, slotIndex: attackerSlotIndex },
    amount: defenderDamage,
    label: defender.name,
  });

  pushLog(
    state,
    `${sourcePlayer.name}'s ${attacker.name} trades ${attackDamage} damage with ${defender.name}.`,
  );

  if (defender.hp <= 0) {
    defeatMonster(state, defenderTarget);
  }
  if (attacker.hp <= 0) {
    defeatMonster(state, { type: "monster", playerId: sourcePlayer.id, slotIndex: attackerSlotIndex });
  }
}

function triggerSnareTrap(state, attackingPlayer, attackerSlotIndex) {
  const attacker = attackingPlayer.field[attackerSlotIndex];
  if (!attacker) {
    return false;
  }

  for (const defender of state.players) {
    if (!areEnemies(state, attackingPlayer.id, defender.id)) {
      continue;
    }

    if (consumeStatus(defender.hero, "snareTrap") <= 0) {
      continue;
    }

    attacker.hp = Math.max(0, attacker.hp - 3);
    pushEvent(state, "snareTrap", {
      target: { type: "monster", playerId: attackingPlayer.id, slotIndex: attackerSlotIndex },
      amount: 3,
      label: "Snare Trap",
    });
    pushLog(state, `${defender.name}'s Snare Trap deals 3 damage to ${attacker.name}.`);

    if (attacker.hp <= 0) {
      defeatMonster(state, { type: "monster", playerId: attackingPlayer.id, slotIndex: attackerSlotIndex });
      return true;
    }
  }

  return false;
}

function defeatMonster(state, target) {
  const owner = getPlayer(state, target.playerId);
  const monster = owner.field[target.slotIndex];
  if (!monster) {
    return;
  }

  owner.discard.push({ instanceId: monster.instanceId, cardId: monster.cardId });
  owner.field[target.slotIndex] = null;
  pushEvent(state, "defeat", {
    target,
    label: monster.name,
  });
  pushLog(state, `${monster.name} is defeated.`);
}

function shouldResolveAction(player, action) {
  if (action.ifPolarity && player.counters.polarity !== action.ifPolarity) {
    return false;
  }
  if (action.ifPolarityChanged && !player.flags.polarityChangedThisTurn) {
    return false;
  }

  return true;
}

function getActionDamageAmount(state, player, action, target, sourceName) {
  let amount = action.amount + getRace(player).damageBonus;

  if (action.scalingCounter) {
    amount += getCounter(player, action.scalingCounter) * action.scalingAmount;
  }

  if (action.bonusIfHeroStatus && hasStatus(player.hero, action.bonusIfHeroStatus)) {
    amount += action.bonusAmount;
  }

  amount = prepareOutgoingDamage(state, player, amount, sourceName, target);

  if (action.spendCounter && action.scalingCounter) {
    setCounter(state, player, action.scalingCounter, 0);
  }

  return amount;
}

function prepareOutgoingDamage(state, player, amount, sourceName, target) {
  const storedDamage = getCounter(player, "storedDamage");
  let modifiedAmount = amount;

  if (storedDamage > 0) {
    setCounter(state, player, "storedDamage", 0);
    modifiedAmount += storedDamage;
    pushLog(state, `${player.name} releases ${storedDamage} stored damage through ${sourceName}.`);
  }

  if (target && consumeStatus(player.hero, "criticalLine") > 0) {
    const targetEntity = getTargetEntity(state, target);
    if (targetEntity.hp <= 6) {
      modifiedAmount *= 2;
      pushEvent(state, "criticalLine", {
        target,
        amount: modifiedAmount,
        label: sourceName,
      });
      pushLog(state, `${player.name}'s Critical Line doubles ${sourceName}.`);
    } else {
      pushLog(state, `${player.name}'s Critical Line finds no weak point.`);
    }
  }

  return modifiedAmount;
}

function discardRandomCards(state, player, count) {
  for (let i = 0; i < count; i += 1) {
    if (!player.hand.length) {
      return;
    }

    const handIndex = randomInt(0, player.hand.length - 1);
    const [discardedCard] = player.hand.splice(handIndex, 1);
    player.discard.push(discardedCard);
    const card = getCardDefinition(discardedCard.cardId);
    pushEvent(state, "discard", {
      target: { type: "hero", playerId: player.id },
      label: card.name,
    });
    pushLog(state, `${player.name} discards ${card.name}.`);
  }
}

function rollDamage(state, player, min, max) {
  const firstRoll = randomInt(min, max);
  if (consumeStatus(player.hero, "advantageRoll") <= 0) {
    return firstRoll;
  }

  const secondRoll = randomInt(min, max);
  const result = Math.max(firstRoll, secondRoll);
  pushEvent(state, "dice", {
    target: { type: "hero", playerId: player.id },
    amount: result,
  });
  pushLog(state, `${player.name} rolls twice and keeps ${result}.`);
  return result;
}

function addCounter(state, player, counter, amount) {
  setCounter(state, player, counter, getCounter(player, counter) + amount);
}

function setCounter(state, player, counter, value) {
  player.counters[counter] = value;
  pushEvent(state, counter, {
    target: { type: "hero", playerId: player.id },
    amount: typeof value === "number" ? value : undefined,
    label: counter,
  });
  pushLog(state, `${player.name}'s ${formatCounterName(counter)} is now ${value}.`);
}

function getCounter(player, counter) {
  return Number(player.counters[counter] ?? 0);
}

function setPolarity(state, player, value) {
  if (player.counters.polarity !== value) {
    player.flags.polarityChangedThisTurn = true;
    addCounter(state, player, "polarityChanges", 1);
  }
  player.counters.polarity = value;
  pushEvent(state, "polarity", {
    target: { type: "hero", playerId: player.id },
    label: value,
  });
  pushLog(state, `${player.name}'s Polarity becomes ${value}.`);
}

function damageRandomEnemy(state, player, amount, sourceName) {
  const targets = getAllEnemyTargets(state, player.id);
  if (!targets.length) {
    return;
  }

  applyDamage(state, player, targets[randomInt(0, targets.length - 1)], amount, sourceName, "spellHit");
}

function damageAllEnemies(state, player, amount, sourceName) {
  for (const target of getAllEnemyTargets(state, player.id)) {
    const targetStillExists = target.type === "hero" || getPlayer(state, target.playerId).field[target.slotIndex];
    if (targetStillExists) {
      applyDamage(state, player, target, amount, sourceName, "spellHit");
    }
  }
}

function resolveChaosCatastrophe(state, player, action, sourceName) {
  for (let i = 0; i < action.rolls; i += 1) {
    const amount = rollDamage(state, player, action.min, action.max);
    damageRandomEnemy(state, player, amount, `${sourceName} rolls ${amount}`);
    if (amount === action.max) {
      applyDirectHeroDamage(state, player, action.selfDamageOnMax, sourceName);
    }
  }
}

function applyDirectHeroDamage(state, player, amount, sourceName) {
  player.hero.hp = Math.max(0, player.hero.hp - amount);
  pushEvent(state, "selfHit", {
    target: { type: "hero", playerId: player.id },
    amount,
    label: sourceName,
  });
  pushLog(state, `${player.name} takes ${amount} backlash damage from ${sourceName}.`);
}

function getAllEnemyTargets(state, playerId) {
  const targets = [];
  for (const otherPlayer of state.players) {
    if (!areEnemies(state, playerId, otherPlayer.id)) {
      continue;
    }

    targets.push({ type: "hero", playerId: otherPlayer.id });
    otherPlayer.field.forEach((monster, slotIndex) => {
      if (monster) {
        targets.push({ type: "monster", playerId: otherPlayer.id, slotIndex });
      }
    });
  }

  return targets;
}

function getMonsterTemplate(player, card) {
  if (card.monster.variants?.length) {
    const variant = card.monster.variants[randomInt(0, card.monster.variants.length - 1)];
    return {
      ...variant,
      name: `${card.name}: ${variant.nameSuffix}`,
      traits: variant.traits ?? card.monster.traits ?? [],
    };
  }

  const monster = { ...card.monster, traits: [...(card.monster.traits ?? [])] };
  if (monster.ifPolarity?.value === player.counters.polarity) {
    monster.attack += monster.ifPolarity.attackBonus ?? 0;
    monster.hp += monster.ifPolarity.hpBonus ?? 0;
  }

  return monster;
}

function hasStatus(entity, type) {
  return entity.statuses.some((status) => status.type === type);
}

function formatCounterName(counter) {
  const names = {
    comboCharge: "Combo Charge",
    instability: "Instability",
    loot: "Loot",
    polarityChanges: "Polarity Changes",
    pressure: "Pressure",
    storedDamage: "Stored Damage",
  };

  return names[counter] ?? counter;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getTargetEntity(state, target) {
  if (!target) {
    throw new Error("Missing target.");
  }

  const player = getPlayer(state, target.playerId);
  if (target.type === "hero") {
    return player.hero;
  }

  const monster = player.field[target.slotIndex];
  if (!monster) {
    throw new Error("The targeted monster no longer exists.");
  }

  return monster;
}

function isValidEnemyTarget(state, playerId, target, card) {
  if (!target) {
    return false;
  }

  const player = getPlayer(state, playerId);
  const targetPlayer = getPlayer(state, target.playerId);
  if (!areEnemies(state, player.id, targetPlayer.id)) {
    return false;
  }

  if (target.type === "monster") {
    return Boolean(targetPlayer.field[target.slotIndex]);
  }

  if (target.type !== "hero") {
    return false;
  }

  return card.ignoresGuard || !hasGuardMonster(targetPlayer);
}

function areEnemies(state, playerId, targetPlayerId) {
  if (playerId === targetPlayerId) {
    return false;
  }

  if (state.mode === "duel") {
    return true;
  }

  const player = getPlayer(state, playerId);
  const targetPlayer = getPlayer(state, targetPlayerId);
  return player.teamId !== targetPlayer.teamId;
}

function hasGuardMonster(player) {
  return player.field.some((monster) => monster?.traits.includes("guard"));
}

function getNextPlayer(state, playerId) {
  const currentIndex = state.players.findIndex((player) => player.id === playerId);
  return state.players[(currentIndex + 1) % state.players.length];
}

function canApplyStatus(action, target) {
  if (action.targetOverride === "self") {
    return true;
  }
  if (!target) {
    return false;
  }

  return action.targetKinds.includes(target.type);
}

function addStatus(entity, type, duration) {
  const existingStatus = entity.statuses.find((status) => status.type === type);
  if (existingStatus) {
    existingStatus.duration += duration;
    return;
  }

  entity.statuses.push({ type, duration });
}

function consumeStatus(entity, type) {
  const status = entity.statuses.find((candidate) => candidate.type === type);
  if (!status) {
    return 0;
  }

  const stacks = status.duration;
  entity.statuses = entity.statuses.filter((candidate) => candidate.type !== type);
  return stacks;
}

function checkWinCondition(state) {
  const livingPlayers = state.players.filter((player) => player.hero.hp > 0);
  if (livingPlayers.length === 1) {
    state.winnerId = livingPlayers[0].id;
    pushLog(state, `${livingPlayers[0].name} wins the match.`);
  }
}

function ensureActivePlayer(state, player) {
  if (state.activePlayerId !== player.id) {
    throw new Error(`It is not ${player.name}'s turn.`);
  }
}

function ensureGameActive(state) {
  if (state.winnerId) {
    throw new Error("The match is already over.");
  }
}

function getRace(player) {
  return raceDefinitions[player.raceId];
}

function shuffle(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function pushLog(state, message) {
  state.log.unshift(message);
  state.log = state.log.slice(0, 12);
}

function pushEvent(state, type, payload) {
  state.events.push({
    id: state.nextEventId,
    type,
    ...payload,
  });
  state.nextEventId += 1;
  state.events = state.events.slice(-40);
}

function cloneState(state) {
  return structuredClone(state);
}
