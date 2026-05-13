import { classDefinitions } from "../content/classes.js";
import { DECK_SIZE, getCardDefinition, starterDecks } from "../content/cards.js";
import {
  DEFAULT_MONSTER_ID,
  createMonsterById,
  phaseHooks,
} from "../content/monsters.js";
import {
  partyDeckCards,
  getPartyDeckCard,
} from "../content/party-deck.js";
import { getRelic } from "../content/relics.js";

export const DRAW_PER_ROUND = 5;
// Canonical energy: 4 per turn, no raw carryover. Unused energy at the
// end of the player phase converts to "surge" stacks (+1 damage on the
// next damage action, capped at SURGE_CAP per turn — diminishing returns).
export const STARTING_ENERGY = 4;
export const MAX_ENERGY = 4;
export const SURGE_CAP = 3;
export const THREAT_DECAY = 2;
export const FIXATE_THREAT_THRESHOLD = 15;
export const FIXATE_DURATION = 2;
// Canonical Party Deck: each round draws 1-2 random Party Cards. Anyone
// can play them; cost is paid from the playing player's energy. Auras
// (persistent effects) move to `state.activeAuras` instead of being
// discarded after play.
export const PARTY_CARDS_PER_ROUND = 2;

export function createCoopBattle(config = {}) {
  const playerConfigs =
    config.players ??
    [
      { id: "player-1", classId: "rook" },
      { id: "player-2", classId: "lyra" },
    ];

  const players = playerConfigs.map((playerConfig, index) => createPlayer(playerConfig, index + 1));
  // Multi-monster support: config.monsterIds (array) takes precedence; if
  // only `monsterId` (singular) is given, fall back to a single-monster
  // encounter. `state.monster` continues to alias the primary monster for
  // backward compat with existing single-monster code paths.
  const monsterIds = Array.isArray(config.monsterIds) && config.monsterIds.length > 0
    ? config.monsterIds
    : [config.monsterId ?? DEFAULT_MONSTER_ID];
  const playerIds = players.map((p) => p.id);
  const monsters = monsterIds.map((id) => createMonsterById(id, players.length, playerIds));

  const state = {
    mode: "coop-boss",
    phase: "planning",
    roundNumber: 1,
    players,
    monsters,
    monster: monsters[0], // alias for backward compat (primary monster)
    winner: null,
    log: [],
    events: [],
    nextEventId: 1,
    // Canonical Party Deck (replaces the old per-fight blessing draft):
    //   partyHand     — cards drawn this round, available for any player to play
    //   activeAuras   — persistent Aura cards still in effect
    //   partyPlayedThisTurn — count of Party Cards played this round (chain
    //                         scaling)
    partyHand: [],
    activeAuras: [],
    partyPlayedThisTurn: 0,
    // Arena-wide flag bag for one-shot or persistent global effects that
    // don't fit on a single player. Examples: { mutationZone: { per: 5,
    // bonus: 1 } } applies +bonus damage per `per` total threat to every
    // damage hit. Cleared/decayed by the cards that set them or at round
    // end via decay rules where appropriate.
    flags: {},
    // Run-progression state — survives across encounters within a run.
    // run.encounters: ordered list of encounter ids the party will face.
    // run.currentIndex: 0-based index into that list (this fight = N).
    // run.crystals: accumulated currency (cosmetic for v1; future shops).
    // run.runDeckAdds: { [playerId]: cardId[] } cards added to each
    //                  player's deck via reward picks this run.
    // run.relics: array of relic ids the party has picked up (v1 only
    //             tracks them; engine hooks land in Phase 4).
    run: config.run ?? null,
  };

  // Apply run-scoped player overrides: HP carryover (run.players[id].hp)
  // so a battered party isn't auto-healed between encounters, and run
  // deck additions appended to each player's draw pile after the
  // initial DRAW_PER_ROUND has been dealt below.
  if (config.run?.players) {
    for (const p of state.players) {
      const carry = config.run.players[p.id];
      if (carry && typeof carry.hp === "number") {
        p.hp = Math.min(p.maxHp, Math.max(0, carry.hp));
      }
    }
  }

  for (const player of state.players) {
    drawCards(state, player, DRAW_PER_ROUND);
  }

  // Round 1: draw the opening Party hand.
  drawPartyCards(state, PARTY_CARDS_PER_ROUND);

  // Apply relic onBattleStart hooks. Relics that grant tokens, heal,
  // tweak max HP, or grant extra-draw fire here — once per encounter
  // before the round-1 banner. We pass `helpers` so relics can call
  // `drawCards` without depending on the engine import path.
  applyRelicHook("onBattleStart", state, { drawCards });
  // Round-1 also needs onRoundStart hooks (Networked Inverter etc.)
  // since startNextRound doesn't run on the opening round. Without
  // this, relics gated on onRoundStart would skip the first fight.
  applyRelicHook("onRoundStart", state, { drawCards });

  const arenaName = monsters.length === 1 ? monsters[0].name : `${monsters.map((m) => m.name).join(" + ")}`;
  pushLog(state, {
    kind: "round-start",
    round: 1,
    text: `Round 1 begins. ${arenaName} step${monsters.length === 1 ? "s" : ""} into the arena. Plan your opening moves together.`,
  });
  return state;
}

// Walk the run's relic list and invoke the named hook on each.
// Hooks read directly from state.run.relics (array of relic ids).
// Helpers is a small bag of engine functions relics can call without
// re-importing the engine module.
function applyRelicHook(hookName, state, helpers) {
  const ids = state.run?.relics ?? [];
  for (const id of ids) {
    const relic = getRelic(id);
    if (!relic || typeof relic[hookName] !== "function") continue;
    try {
      relic[hookName](state, helpers ?? {});
    } catch (err) {
      // Don't let a buggy relic kill the fight — log and move on.
      pushLog(state, {
        kind: "info",
        text: `Relic '${relic.name}' hook ${hookName} threw: ${err.message}`,
      });
    }
  }
}

// Build a fresh battle state for the next encounter in a run.
// Carries forward: player class + name, current HP, run state with
// updated currentIndex, accumulated crystals + relics + deck adds.
// Resets: per-fight monsters, deck shuffle, hand, discard, block,
// energy, party deck, statuses, threat. Returns a brand-new state
// ready to plug into the same render flow.
export function advanceToNextEncounter(currentState, options = {}) {
  if (!currentState.run) {
    throw new Error("advanceToNextEncounter: state has no run object.");
  }
  const run = { ...currentState.run };
  run.currentIndex = (run.currentIndex ?? 0) + 1;
  // Crystals reward (default 5 per cleared encounter; future shop
  // encounters and elite kills will pass higher amounts via options).
  if (typeof options.crystalsEarned === "number" && options.crystalsEarned > 0) {
    run.crystals = (run.crystals ?? 0) + options.crystalsEarned;
  }
  // Crystals spent at the post-fight shop. Subtracted AFTER the earn
  // so the player can spend up to the full new pool.
  if (typeof options.crystalsSpent === "number" && options.crystalsSpent > 0) {
    run.crystals = Math.max(0, (run.crystals ?? 0) - options.crystalsSpent);
  }
  // Apply card picks from the reward screen. options.picks is keyed
  // by playerId, value is a single card-id string. Future multi-pick
  // rewards can swap to arrays without breaking this shape.
  if (options.picks) {
    const adds = { ...(run.runDeckAdds ?? {}) };
    for (const [playerId, cardId] of Object.entries(options.picks)) {
      if (!cardId) continue;
      const existing = adds[playerId] ?? [];
      adds[playerId] = existing.concat([cardId]);
    }
    run.runDeckAdds = adds;
  }
  // Apply relic pick from a boss-clear reward.
  if (options.relicPick) {
    const list = (run.relics ?? []).slice();
    if (!list.includes(options.relicPick)) list.push(options.relicPick);
    run.relics = list;
  }
  // Bonus relics granted via the post-fight shop (or future "elite
  // drops both") arrive as an array. Dedupe and merge.
  if (Array.isArray(options.extraRelics) && options.extraRelics.length > 0) {
    const list = (run.relics ?? []).slice();
    for (const rid of options.extraRelics) {
      if (rid && !list.includes(rid)) list.push(rid);
    }
    run.relics = list;
  }
  // HP carryover snapshot. We persist this on run.players so create-
  // CoopBattle can reapply it when it builds the next fight.
  const hpCarry = {};
  for (const p of currentState.players) {
    hpCarry[p.id] = { hp: p.hp };
  }
  run.players = hpCarry;

  // If we've cleared the last encounter, return a "run-complete"
  // state without spinning up combat. The app reads this and shows
  // the run-complete screen.
  if (run.currentIndex >= run.encounters.length) {
    return {
      ...currentState,
      run,
      phase: "run-complete",
      winner: "players",
    };
  }

  // Otherwise, build a fresh battle for the next encounter id. Pull
  // the encounter's monsterIds via the registry import in app-side
  // glue (the engine doesn't depend on the encounter registry — the
  // caller passes monsterIds in options).
  const playerConfigs = currentState.players.map((p) => ({
    id: p.id,
    name: p.name,
    classId: p.classId,
    runDeckAdds: run.runDeckAdds?.[p.id] ?? [],
  }));
  const battleConfig = {
    players: playerConfigs,
    run,
  };
  if (options.monsterIds && options.monsterIds.length > 1) {
    battleConfig.monsterIds = options.monsterIds;
  } else if (options.monsterIds && options.monsterIds.length === 1) {
    battleConfig.monsterId = options.monsterIds[0];
  } else if (options.monsterId) {
    battleConfig.monsterId = options.monsterId;
  }
  return createCoopBattle(battleConfig);
}

// Helpers for the multi-monster schema. `primaryMonster` returns the first
// living monster (or the first if all are dead) for legacy single-monster
// reads. `livingMonsters` is for iteration.
export function primaryMonster(state) {
  const list = state.monsters ?? (state.monster ? [state.monster] : []);
  return list.find((m) => m.hp > 0) ?? list[0];
}

export function livingMonsters(state) {
  const list = state.monsters ?? (state.monster ? [state.monster] : []);
  return list.filter((m) => m.hp > 0);
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
  // Cost modifiers applied at queue time:
  //   firstCardDiscount — first queued card this round costs −N (Network
  //                       Efficiency). Cleared after the discount applies
  //                       so only the literal first card benefits.
  //   nextCardCostExtra — next queued card costs +N (System Lag). Cleared
  //                       after queueing.
  let effectiveCost = card.cost;
  let consumeDiscount = false;
  let consumeExtra = false;
  if (player.planned.length === 0) {
    const discount = player.statuses?.firstCardDiscount ?? 0;
    if (discount > 0) {
      effectiveCost = Math.max(0, effectiveCost - discount);
      consumeDiscount = true;
    }
  }
  const extra = player.statuses?.nextCardCostExtra ?? 0;
  if (extra > 0) {
    effectiveCost += extra;
    consumeExtra = true;
  }
  if (getRemainingEnergy(player) < effectiveCost) {
    throw new Error(`${player.name} does not have enough energy for ${card.name}.`);
  }
  player.hand.splice(handIndex, 1);
  // Stash the negotiated cost on the card instance so resolveRound spends
  // the modified amount. Default `cost` on the definition is read-only.
  cardInstance.discountedCost = effectiveCost;
  // Multi-monster targeting: if the player picked a specific monster,
  // store that on the card instance. resolveRound swaps state.monster
  // to this target while the card resolves. Falls back to primary if
  // unset or if the named target is dead by resolve time.
  if (command.targetMonsterId) {
    cardInstance.targetMonsterId = command.targetMonsterId;
  }
  player.planned.push(cardInstance);
  if (consumeDiscount) {
    clearBuff(state, player.id, "firstCardDiscount");
  }
  if (consumeExtra) {
    clearBuff(state, player.id, "nextCardCostExtra");
  }
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

  pushLog(state, {
    kind: "phase-banner",
    phase: "player",
    round: state.roundNumber,
    text: `Round ${state.roundNumber} · Player phase`,
  });

  for (const player of state.players) {
    for (const cardInstance of player.planned) {
      const card = getCardDefinition(cardInstance.cardId);
      // Honor a per-instance discountedCost (set by queueCard when buffs
      // like firstCardDiscount or System Lag adjust the cost). Falls back
      // to the definition cost for cards queued before buffs existed.
      const cost = typeof cardInstance.discountedCost === "number"
        ? cardInstance.discountedCost
        : card.cost;
      player.energy -= cost;
      // Per-card monster targeting: if the player picked a specific
      // monster at queue time, swap state.monster to that target while
      // the card resolves so all damage / threat actions land on it.
      // Restored after so the alias is back to the primary for any
      // post-card bookkeeping. Skip the swap if the target is dead — we
      // fall through to the primary so the action isn't wasted.
      const previousPrimary = state.monster;
      const target = cardInstance.targetMonsterId
        ? (state.monsters ?? []).find((m) => m.monsterId === cardInstance.targetMonsterId && m.hp > 0)
        : null;
      if (target) {
        state.monster = target;
      }
      const monsterHpBefore = state.monster.hp;
      resolveCard(state, player, card);
      player.discard.push(cardInstance);
      const damageDealt = monsterHpBefore - state.monster.hp;
      // Restore primary alias. dealMonsterDamage may have advanced it on
      // a kill; only restore if the original primary is still alive, so
      // we don't accidentally point back at a dead monster.
      if (state.monster !== previousPrimary && previousPrimary.hp > 0) {
        state.monster = previousPrimary;
      }
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

  // Canonical energy rule: unused energy at the end of the player phase
  // converts to surge stacks (+1 damage on the next damage action, capped
  // at SURGE_CAP per turn — diminishing returns). No raw carryover.
  for (const player of state.players) {
    if (player.hp <= 0) continue;
    const unused = Math.max(0, player.energy);
    // Per-player flags read by Auras (Growth Protocol) and buffs (Overclock
    // Sync, Bio Surge) the next round. Survive the surge-decay that runs
    // at the top of the next round.
    //   hadUnusedEnergy — boolean: did this player end with unused energy?
    //   unusedEnergyLastTurn — exact amount, summed across players for
    //                          Bio Surge's strength-stack count.
    player.hadUnusedEnergy = unused > 0;
    player.unusedEnergyLastTurn = unused;
    if (unused > 0) {
      const gained = Math.min(unused, SURGE_CAP);
      addPlayerStatus(state, player.id, "surge", gained, { mode: "max", decay: SURGE_CAP });
      pushLog(state, {
        kind: "info",
        text: `${player.name} converts ${unused} unused energy into +${gained} surge.`,
      });
    }
    player.energy = 0;
    // Storm Charge "Overload" generation is intentionally disabled per
    // Noah's call — gaining 5+ threat in a turn no longer auto-grants a
    // Storm Charge token. The `threatGainedThisTurn` counter still ticks
    // (kept for compatibility with element combinations / future rules)
    // but the auto-grant block is removed.
  }

  // Victory when every monster in the encounter is dead. For single-
  // monster fights this is just `state.monster.hp <= 0`; for the
  // Bruiser Duo / Synthetic Hunter Squad each squadmate must fall.
  const allDead = (state.monsters ?? [state.monster]).every((m) => m.hp <= 0);
  if (allDead) {
    // If there's a run with more encounters queued, this is a "fight
    // cleared" event, not a "game over". Mark phase=rewards so the
    // app can show the reward screen and call advanceToNextEncounter
    // afterwards. If no run, or this was the final encounter, fall
    // through to the regular victory ending.
    const run = state.run;
    const hasMoreEncounters =
      run && Array.isArray(run.encounters) && run.currentIndex + 1 < run.encounters.length;
    // Three terminal states on victory:
    //   `rewards`      — non-final fight in a run; reward screen next.
    //   `run-complete` — final fight in a run; meta-progression fires.
    //   `game-over`    — single-fight game (no run wrapper).
    if (hasMoreEncounters) {
      state.phase = "rewards";
    } else if (run) {
      state.phase = "run-complete";
      state.winner = "players";
    } else {
      state.phase = "game-over";
      state.winner = "players";
    }
    const finalName = state.monster?.name ?? "The encounter";
    pushEvent(state, "defeat", {
      target: { type: "monster" },
      label: finalName,
    });
    const arenaLabel = (state.monsters ?? [state.monster]).map((m) => m.name).join(" and ");
    pushLog(state, {
      kind: "outcome",
      outcome: hasMoreEncounters ? "encounter-cleared" : "victory",
      text: hasMoreEncounters
        ? `${arenaLabel} fall. Choose your reward.`
        : `${arenaLabel} fall. The party wins.`,
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
    // Use the negotiated cost if queueCard applied a buff/debuff to this
    // card instance; otherwise fall back to the card definition's cost.
    if (typeof cardInstance.discountedCost === "number") {
      return total + cardInstance.discountedCost;
    }
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
  // Run deck additions: reward-screen card picks accumulated across
  // earlier encounters in the same run. Append AFTER the starter list
  // so the deck-size invariant ('starter must equal DECK_SIZE') stays
  // intact, then the whole pile is shuffled together.
  const runAdds = Array.isArray(playerConfig.runDeckAdds)
    ? playerConfig.runDeckAdds
    : [];
  const fullList = deckList.concat(runAdds);
  const deck = shuffle(
    fullList.map((cardId, cardIndex) => ({
      instanceId: `${id}-card-${cardIndex + 1}`,
      cardId,
    })),
  );

  return {
    id,
    name: playerConfig.name ?? classDef.shortName,
    classId: classDef.id,
    role: classDef.role,
    // Surface the class's elemental id (storm-charge / hydroflow /
    // bio-growth) so relics like Stormrunner Anchor can grant the
    // right token without re-importing classDefinitions.
    element: classDef.element ?? null,
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
    // Canonical element tokens. Held tokens drive always-on passives:
    //   bioGrowth   — your healing actions heal +1 (any held)
    //   hydroflow   — when you would gain 2+ threat, reduce by 1 (any held)
    //   stormCharge — your damage actions deal +1 (any held)
    // Generation:
    //   bioGrowth   — gain 1 when targeted by a monster
    //   stormCharge — gain 1 when you gain 5+ threat in your turn (Overload)
    //   hydroflow   — gain 1 when you move 5+ threat from one player to
    //                 another (deferred — needs a `moveThreat` action type)
    tokens: { bioGrowth: 0, hydroflow: 0, stormCharge: 0 },
    // Per-turn threat tally for the Storm Charge "Overload" trigger. Reset
    // at end of player phase so the threshold is per-turn, not cumulative.
    threatGainedThisTurn: 0,
    // Canonical Storm Charge passive: bonus +1 damage on the FIRST damage
    // action per turn only. Set by dealMonsterDamage on first hit, reset
    // at the top of each round in startNextRound.
    stormChargeUsedThisTurn: false,
    // Set by resolveRound at end of player phase. Read next round by buffs
    // that care whether players spent all their energy (Overclock Sync) or
    // need a per-player unused tally (Bio Surge).
    hadUnusedEnergy: false,
    unusedEnergyLastTurn: 0,
  };
}

function resolveCard(state, player, card) {
  for (const action of card.actions) {
    resolveAction(state, player, action);
  }
  // Aura — Data Stream: the first card each player plays per round draws
  // 1 extra card on resolve. Flag is set in applyAuraRoundTicks at round
  // start and cleared here.
  if (player.dataStreamPending) {
    player.dataStreamPending = false;
    drawCards(state, player, 1);
    pushLog(state, {
      kind: "info",
      text: `${player.name} taps Data Stream — draws 1 extra card.`,
    });
  }
}

function resolveAction(state, player, action) {
  if (action.type === "damage") {
    let amount = action.amount;
    if (action.spendToken && spendOneToken(player, action.spendToken.token)) {
      amount += action.spendToken.bonus ?? 1;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: player.id },
        label: `Infuse +${action.spendToken.bonus ?? 1}`,
        amount: action.spendToken.bonus ?? 1,
      });
    }
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
    let amount = action.amount;
    if (action.spendToken && spendOneToken(player, action.spendToken.token)) {
      amount += action.spendToken.bonus ?? 1;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: player.id },
        label: `Infuse +${action.spendToken.bonus ?? 1}`,
        amount: action.spendToken.bonus ?? 1,
      });
    }
    for (const target of getPlayerTargets(state, player, action.target)) {
      target.block += amount;
      pushEvent(state, "block", {
        target: { type: "player", playerId: target.id },
        amount,
      });
    }
    return;
  }

  if (action.type === "heal") {
    // Bio-Growth passive: holding any bio-growth tokens adds +1 to each
    // healing action's amount before clamping at maxHp.
    const bioBonus = (player.tokens?.bioGrowth ?? 0) > 0 ? 1 : 0;
    const healAmount = action.amount + bioBonus;
    for (const target of getPlayerTargets(state, player, action.target)) {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + healAmount);
      const healed = target.hp - before;
      if (healed > 0) {
        addThreat(state, player.id, Math.floor(healed / 2));
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
    // Threat-based targets ("highest" / "lowest-threat") use the threat
    // picker so reduceThreat stays meaningful when no one is taking heat.
    if (action.target === "highest") {
      const top = [...state.players]
        .filter((p) => p.hp > 0)
        .sort((a, b) => getThreat(state, b.id) - getThreat(state, a.id))[0];
      if (top) reduceThreat(state, top.id, action.amount);
      return;
    }
    for (const target of getPlayerTargets(state, player, action.target)) {
      reduceThreat(state, target.id, action.amount);
    }
    return;
  }

  if (action.type === "gainToken") {
    if (!player.tokens) player.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
    const key = action.token === "bio-growth" ? "bioGrowth"
             : action.token === "hydroflow" ? "hydroflow"
             : action.token === "storm-charge" ? "stormCharge"
             : null;
    if (key) {
      const amount = action.amount ?? 1;
      player.tokens[key] = (player.tokens[key] ?? 0) + amount;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: player.id },
        label: `${key === "bioGrowth" ? "Bio-Growth" : key === "hydroflow" ? "Hydroflow" : "Storm Charge"} +${amount}`,
        amount,
      });
    }
    return;
  }

  if (action.type === "moveThreat") {
    // Move threat from one player to another. The "moving" player is the
    // card's owner; `from` and `to` are resolved via getPlayerTargets, but
    // we only honor the first match for each so a single moveThreat action
    // is unambiguous. `highest` and `lowest` extend getPlayerTargets to
    // pick the threat-extreme target if needed.
    const fromPlayer = pickMoveTarget(state, player, action.from, "from");
    const toPlayer = pickMoveTarget(state, player, action.to, "to");
    if (!fromPlayer || !toPlayer || fromPlayer.id === toPlayer.id) {
      return;
    }
    const requested = Math.max(0, action.amount ?? 0);
    const available = getThreat(state, fromPlayer.id);
    const moved = Math.min(requested, available);
    if (moved <= 0) {
      return;
    }
    state.monster.threat[fromPlayer.id] = available - moved;
    pushEvent(state, "evasion", {
      target: { type: "player", playerId: fromPlayer.id },
      amount: moved,
    });
    // Add to `to` directly (bypassing addThreat) so passives/combinations
    // don't re-fire on a transferred amount — moveThreat is a relocation,
    // not a fresh threat source.
    const cap = state.monster.threatMax ?? 20;
    const toBefore = getThreat(state, toPlayer.id);
    state.monster.threat[toPlayer.id] = Math.min(cap, toBefore + moved);
    pushEvent(state, "threat", {
      target: { type: "player", playerId: toPlayer.id },
      amount: moved,
    });
    pushLog(state, {
      kind: "info",
      text: `${player.name} redirects ${moved} threat from ${fromPlayer.name} to ${toPlayer.name}.`,
    });

    // Hydroflow generation (canonical, Step 3 deferral): the moving player
    // gains 1 Hydroflow token whenever they relocate threat with at least
    // one Hydroflow held. We use "any held" rather than "moved 5+" because
    // the canonical Step-3 spec ties generation to the moveThreat action
    // existing — content controls how often it actually fires.
    if (!player.tokens) player.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
    if ((player.tokens.hydroflow ?? 0) > 0) {
      player.tokens.hydroflow = (player.tokens.hydroflow ?? 0) + 1;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: player.id },
        label: "Hydroflow +1",
        amount: 1,
      });
    }

    // bonusToken: card-driven token grant when the relocation moved at
    // least `threshold` threat. Used by Flow Shift ("If 3 or more threat
    // is moved, gain 1 Hydroflow token").
    if (action.bonusToken && moved >= (action.bonusToken.threshold ?? 1)) {
      const bonus = action.bonusToken;
      const key = bonus.token === "bio-growth" ? "bioGrowth"
               : bonus.token === "hydroflow" ? "hydroflow"
               : bonus.token === "storm-charge" ? "stormCharge"
               : null;
      if (key) {
        const grant = bonus.amount ?? 1;
        player.tokens[key] = (player.tokens[key] ?? 0) + grant;
        pushEvent(state, "criticalLine", {
          target: { type: "player", playerId: player.id },
          label: `${key === "bioGrowth" ? "Bio-Growth" : key === "hydroflow" ? "Hydroflow" : "Storm Charge"} +${grant}`,
          amount: grant,
        });
      }
    }

    // Combination — Conductive Surge (Hydroflow + Storm Charge):
    // deal `moved` damage to the monster; if the dealt damage is 5+, gain
    // 1 Storm Charge token. Damage routes through dealMonsterDamage so
    // element / surge / passives all apply normally.
    if (
      (player.tokens.hydroflow ?? 0) > 0
      && (player.tokens.stormCharge ?? 0) > 0
    ) {
      const monsterHpBefore = state.monster.hp;
      dealMonsterDamage(state, player, moved);
      const dealt = monsterHpBefore - state.monster.hp;
      if (dealt >= 5) {
        player.tokens.stormCharge = (player.tokens.stormCharge ?? 0) + 1;
        pushLog(state, {
          kind: "info",
          text: `${player.name} channels Conductive Surge — ${dealt} damage. +1 Storm Charge.`,
        });
        pushEvent(state, "criticalLine", {
          target: { type: "player", playerId: player.id },
          label: "Conductive Surge",
          amount: dealt,
        });
      } else {
        pushLog(state, {
          kind: "info",
          text: `${player.name} channels Conductive Surge — ${dealt} damage.`,
        });
      }
    }
    return;
  }

}

// Spend one token of the named type from the player's pool. Returns true
// on success, false if the player doesn't have one. Used by `spendToken`
// payloads on damage / block actions to power "Spend 1 token to gain +X"
// rules text on Storm Forge / Hydroflow basics.
function spendOneToken(player, tokenName) {
  if (!player?.tokens) return false;
  const key = tokenName === "bio-growth" ? "bioGrowth"
           : tokenName === "hydroflow" ? "hydroflow"
           : tokenName === "storm-charge" ? "stormCharge"
           : null;
  if (!key) return false;
  if ((player.tokens[key] ?? 0) <= 0) return false;
  player.tokens[key] -= 1;
  return true;
}

// moveThreat target picker — accepts the standard `self` / `ally` /
// `lowest` keywords plus `highest` (highest current threat). Returns a
// single player or null.
function pickMoveTarget(state, player, target, role) {
  if (target === "self") return player;
  if (target === "highest") {
    return [...state.players]
      .filter((p) => p.hp > 0)
      .sort((a, b) => getThreat(state, b.id) - getThreat(state, a.id))[0]
      ?? null;
  }
  if (target === "lowest") {
    // For moveThreat, "lowest" means lowest threat among living players —
    // not lowest HP (which is what getPlayerTargets uses). Disambiguated
    // here so the action vocabulary stays expressive.
    return [...state.players]
      .filter((p) => p.hp > 0)
      .sort((a, b) => getThreat(state, a.id) - getThreat(state, b.id))[0]
      ?? null;
  }
  // ally / all / unknown → first matching ally for both endpoints. The
  // moving player is excluded so `from: ally` and `to: ally` resolve to a
  // teammate, not the actor.
  const list = state.players.filter((p) => p.id !== player.id && p.hp > 0);
  return list[0] ?? null;
}

function dealMonsterDamage(state, player, amount, element) {
  const rawDamage = Math.max(0, amount);
  if (rawDamage === 0) {
    return;
  }
  const el = element ?? "physical";
  // Static Field aura: when a player's damage hits with the overclock
  // element (⚡), they gain +1 threat. Reads `state.activeAuras` for the
  // installed aura entry. Fires once per damage action regardless of
  // amount so chained overclock attacks each cost a tick of threat.
  if (el === "overclock" && Array.isArray(state.activeAuras)) {
    const hasStaticField = state.activeAuras.some((a) => a.id === "static-field");
    if (hasStaticField) {
      addThreat(state, player.id, 1);
    }
  }
  const multiplier = getElementMultiplier(state.monster, el);
  const defense = effectiveMonsterDefense(state, state.monster);
  // Element first, then defense subtraction. Floor at 0.
  const afterElement = Math.ceil(rawDamage * multiplier);
  let finalDamage = Math.max(0, afterElement - defense);
  // Glass Cannon blessing: +1 to any non-zero damage hit, applied after
  // mitigation so the bonus survives even high-defense monsters.
  // Storm Charge passive (canonical): holding any storm-charge tokens adds
  // +1 to the FIRST damage action that lands per turn (not every action).
  // The flag resets at the top of each round in startNextRound.
  if (
    finalDamage > 0
    && (player.tokens?.stormCharge ?? 0) > 0
    && !player.stormChargeUsedThisTurn
  ) {
    finalDamage += 1;
    player.stormChargeUsedThisTurn = true;
  }
  // Aura — Static Field: all Overclock-element damage gets +2.
  if (finalDamage > 0 && el === "overclock" && auraActive(state, "static-field")) {
    finalDamage += 2;
  }
  // Canonical surge: consume 1 stack to add +1 damage to this hit.
  // Each damage action consumes at most one stack.
  if (finalDamage > 0) {
    const stacks = player.statuses?.surge ?? 0;
    if (stacks > 0) {
      player.statuses.surge = stacks - 1;
      if (player.statuses.surge <= 0) delete player.statuses.surge;
      finalDamage += 1;
    }
  }
  // Per-player damage buff: damageBoostThisTurn adds +N to every damage
  // action while the buff is up. Doesn't consume — decays at round end.
  // Source: Overclock Sync (Party Deck buff).
  if (finalDamage > 0) {
    const boost = player.statuses?.damageBoostThisTurn ?? 0;
    if (boost > 0) {
      finalDamage += boost;
    }
  }
  // Strength stacks: consume 1 stack to add +1 damage to this hit. Same
  // shape as surge but separate counter so Bio-Surge windfalls don't
  // collide with the SURGE_CAP. Source: Bio Surge.
  if (finalDamage > 0) {
    const strength = player.statuses?.strength ?? 0;
    if (strength > 0) {
      player.statuses.strength = strength - 1;
      if (player.statuses.strength <= 0) delete player.statuses.strength;
      finalDamage += 1;
    }
  }
  // Global Mutation Zone: +1 damage per `per` total threat across all
  // players. Reads `state.flags.mutationZone = { per, bonus }`. The bonus
  // applies to every damage hit while the flag is set (decays at round end).
  if (finalDamage > 0 && state.flags?.mutationZone) {
    const cfg = state.flags.mutationZone;
    const per = Math.max(1, cfg.per ?? 5);
    const bonus = cfg.bonus ?? 1;
    let totalThreat = 0;
    for (const p of state.players) {
      totalThreat += getThreat(state, p.id);
    }
    const buckets = Math.floor(totalThreat / per);
    if (buckets > 0) {
      finalDamage += buckets * bonus;
    }
  }

  // Relic onDamageDealt hooks — Fixate Lens, future damage relics.
  // Each relic returns a (possibly-modified) amount; we chain them.
  if (finalDamage > 0) {
    for (const relicId of state.run?.relics ?? []) {
      const relic = getRelic(relicId);
      if (relic && typeof relic.onDamageDealt === "function") {
        try {
          const next = relic.onDamageDealt(state, player, finalDamage, null);
          if (typeof next === "number" && next >= 0) finalDamage = next;
        } catch (err) {
          // ignore — buggy relic shouldn't tank the fight
        }
      }
    }
  }

  const hpBefore = state.monster.hp;
  state.monster.hp = Math.max(0, state.monster.hp - finalDamage);
  // Threat tracks the actual damage applied (post-mitigation) so
  // defense doesn't accidentally mute fixate / target priority.
  addThreat(state, player.id, finalDamage);
  pushEvent(state, "physicalHit", {
    target: { type: "monster" },
    amount: finalDamage,
    label: el === "physical" ? undefined : capitalize(el),
  });
  // Canonical Killing Blow: when this hit drops a monster to 0 HP and
  // OTHER monsters are still alive in the encounter, the killing player
  // gains +5 threat on each surviving monster. (Single-monster fights
  // are a no-op since `state.monsters` has only one entry.)
  if (hpBefore > 0 && state.monster.hp <= 0) {
    const others = (state.monsters ?? []).filter((m) => m !== state.monster && m.hp > 0);
    for (const other of others) {
      const cap = other.threatMax ?? 20;
      other.threat[player.id] = Math.min(cap, (other.threat[player.id] ?? 0) + 5);
      pushEvent(state, "threat", {
        target: { type: "player", playerId: player.id },
        amount: 5,
      });
    }
    if (others.length > 0) {
      pushLog(state, {
        kind: "info",
        text: `${player.name} lands the killing blow on ${state.monster.name} — ${others.length} other ${others.length === 1 ? "monster gains" : "monsters gain"} +5 threat.`,
      });
      // Advance the primary-monster alias to the next living squadmate.
      // Player damage routes through `state.monster`, so without this
      // swap the rest of the round (and subsequent rounds) would have
      // nothing to hit. Iteration order matches state.monsters so the
      // squad falls in the order the encounter was authored.
      const nextLiving = others[0];
      state.monster = nextLiving;
      pushLog(state, {
        kind: "info",
        text: `Targeting shifts to ${nextLiving.name}.`,
      });
    }
  }

  // Combination — Overgrowth Chain (Bio-Growth + Storm Charge):
  // when the player deals damage holding both element types, heal half the
  // damage (rounded down) and gain Bio-Growth tokens at 5+ / 10+ damage
  // thresholds. Uses finalDamage (the post-mitigation amount that actually
  // landed) so high-defense monsters don't free-roll the heal.
  if (
    finalDamage > 0
    && (player.tokens?.bioGrowth ?? 0) > 0
    && (player.tokens?.stormCharge ?? 0) > 0
  ) {
    const healAmount = Math.floor(finalDamage / 2);
    if (healAmount > 0) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      const healed = player.hp - before;
      if (healed > 0) {
        pushEvent(state, "heal", {
          target: { type: "player", playerId: player.id },
          amount: healed,
        });
      }
    }
    let bioGain = 0;
    if (finalDamage >= 10) {
      bioGain = 2;
    } else if (finalDamage >= 5) {
      bioGain = 1;
    }
    if (bioGain > 0) {
      if (!player.tokens) player.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
      player.tokens.bioGrowth = (player.tokens.bioGrowth ?? 0) + bioGain;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: player.id },
        label: `Overgrowth +${bioGain}`,
        amount: bioGain,
      });
    }
    pushLog(state, {
      kind: "info",
      text: `${player.name} channels Overgrowth Chain — heal ${healAmount}${bioGain > 0 ? `, +${bioGain} Bio-Growth` : ""}.`,
    });
  }

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
  // Multi-monster turn order. Iterate every living monster in
  // turnPriority order (lowest first; "Attacks Last" monsters like the
  // Execution Drone get a high turnPriority so they fire after the rest
  // of the squad). Single-monster encounters fall through naturally
  // because the array has one element.
  const order = (state.monsters ?? [state.monster])
    .filter((m) => m && m.hp > 0)
    .sort((a, b) => (a.turnPriority ?? 0) - (b.turnPriority ?? 0));

  // Per-turn target hit tracker. Maps playerId -> Set of monsterIds that
  // have hit that player this monster phase. Powers faithful Crossfire
  // ("+1 if another monster already hit the same target this turn"),
  // resets at the start of every monster turn so chains can't leak.
  state.monsterTurnHits = {};

  for (const monster of order) {
    if (state.players.every((player) => player.hp <= 0)) return;
    if (monster.hp <= 0) continue;
    runSingleMonsterTurn(state, monster);
  }
}

// Runs one monster's full turn (pre-turn hook + N attack actions).
// Reads from the passed `monster` rather than the `state.monster`
// alias so multi-monster encounters work without temp-swapping.
function runSingleMonsterTurn(state, monster) {
  if (typeof monster.onMonsterTurnStart === "function") {
    monster.onMonsterTurnStart(state);
  }

  const actions = Math.max(1, monster.actionsPerTurn ?? 1);

  for (let actionIndex = 0; actionIndex < actions; actionIndex += 1) {
    if (state.players.every((player) => player.hp <= 0)) {
      return;
    }

    const target = chooseMonsterTargetFor(state, monster);
    if (!target) {
      return;
    }

    if (!target.tokens) target.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
    // Bio-Growth generation is the canonical Verdant Reach passive ("gain
    // 1 Bio-Growth when targeted by a monster") and should only fire for
    // bio-growth-themed classes — Hydroflow / Storm Forge players don't
    // generate someone else's token just for getting hit. The class's
    // `element` field is the source of truth.
    const targetClass = classDefinitions[target.classId];
    if (targetClass?.element === "bio-growth") {
      target.tokens.bioGrowth = (target.tokens.bioGrowth ?? 0) + 1;
      pushEvent(state, "criticalLine", {
        target: { type: "player", playerId: target.id },
        label: "Bio-Growth +1",
        amount: 1,
      });
    }

    let damage = Math.max(
      1,
      effectiveMonsterAttack(state, monster, target) + Math.floor(state.roundNumber / 2),
    );
    // Fixate damage: monsters with an explicit `fixateAttack` use that
    // flat number on the locked target (Bruiser Duo / Synthetic Squad
    // statline). Otherwise apply the canonical Enrage bonus.
    const fix = monster.fixate;
    if (fix && fix.roundsRemaining > 0 && fix.playerId === target.id) {
      if (typeof monster.fixateAttack === "number") {
        damage = monster.fixateAttack;
      } else {
        damage += monster.enrageDamageBonus ?? 3;
      }
    }

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
        ? `${monster.name} strikes ${target.name} for ${damage} (${blocked > 0 ? `${blocked} blocked, ` : ""}${through} through)`
        : `${monster.name} strikes ${target.name} — ${damage} fully blocked`,
    });
    pushEvent(state, "spellHit", {
      target: { type: "player", playerId: target.id },
      amount: damage,
      label: monster.name,
    });

    // Record this hit for Crossfire's "another monster already hit this
    // target this turn" check. Recorded AFTER the damage call so the
    // monster's own first action doesn't trigger Crossfire on its own
    // second action — we only count distinct monsterIds.
    if (state.monsterTurnHits) {
      const key = target.id;
      const id = monster.monsterId ?? monster.id;
      if (id) {
        (state.monsterTurnHits[key] ??= new Set()).add(id);
      }
    }
  }
}

// Effective attack for a monster, factoring in declarative abilities.
//   packHunter — +1 while any other squadmate is alive (pack tactics).
//   crossfire  — +1 ONLY if another monster has already hit this target
//                this turn (requires `target` arg + state.monsterTurnHits).
//                If state lacks the tracker (preview / older callers),
//                falls back to "any other squadmate alive" so we never
//                under-count the threat preview.
//   targetUplink — +1 from a separate living uplinker.
function effectiveMonsterAttack(state, monster, target = null) {
  let bonus = 0;
  const others = (state.monsters ?? []).filter((m) => m !== monster && m.hp > 0);
  const abilities = monster.abilities ?? [];
  if (abilities.includes("packHunter") && others.length > 0) {
    bonus += 1;
  }
  if (abilities.includes("crossfire")) {
    const myId = monster.monsterId ?? monster.id;
    const hits = target && state.monsterTurnHits ? state.monsterTurnHits[target.id] : null;
    const anotherHit = hits ? Array.from(hits).some((id) => id !== myId) : false;
    if (anotherHit) {
      bonus += 1;
    } else if (!state.monsterTurnHits && others.length > 0) {
      bonus += 1; // legacy/preview fallback
    }
  }
  if (others.some((m) => (m.abilities ?? []).includes("targetUplink"))) {
    bonus += 1;
  }
  return (monster.baseAttack ?? 0) + bonus;
}

// Effective defense for a monster, factoring in declarative abilities.
// `sharedShielding` adds +2 defense while at least one other squadmate
// is alive. Used by dealMonsterDamage when computing damage applied to
// the primary monster alias.
function effectiveMonsterDefense(state, monster) {
  let def = monster.defense ?? 0;
  const others = (state.monsters ?? []).filter((m) => m !== monster && m.hp > 0);
  if ((monster.abilities ?? []).includes("sharedShielding") && others.length > 0) {
    def += 2;
  }
  return def;
}

function chooseMonsterTarget(state) {
  return chooseMonsterTargetFor(state, state.monster);
}

// Per-monster target picker. Reads the threat map and fixate flag off
// the passed monster so multi-monster encounters don't have to swap
// the `state.monster` alias.
function chooseMonsterTargetFor(state, monster) {
  const livingPlayers = state.players.filter((player) => player.hp > 0);
  if (!livingPlayers.length) {
    return null;
  }

  if (monster.targetSelector === "fixate") {
    const fixated = selectTargetWithFixateFor(state, monster, livingPlayers);
    if (fixated) {
      return fixated;
    }
  }

  return defaultTargetSelectorFor(state, monster, livingPlayers);
}

function defaultTargetSelectorFor(state, monster, livingPlayers) {
  return [...livingPlayers].sort((a, b) => {
    const threatDiff = (monster.threat?.[b.id] ?? 0) - (monster.threat?.[a.id] ?? 0);
    if (threatDiff !== 0) {
      return threatDiff;
    }
    return a.hp - b.hp;
  })[0];
}

function selectTargetWithFixateFor(state, monster, livingPlayers) {
  const current = monster.fixate;
  if (current && current.roundsRemaining > 0) {
    const target = livingPlayers.find((p) => p.id === current.playerId);
    if (target) {
      return target;
    }
    monster.fixate = null;
  }

  const threshold = monster.fixateThreshold ?? FIXATE_THREAT_THRESHOLD;
  const candidates = livingPlayers
    .filter((p) => (monster.threat?.[p.id] ?? 0) >= threshold)
    .sort((a, b) => (monster.threat?.[b.id] ?? 0) - (monster.threat?.[a.id] ?? 0));

  if (candidates.length === 0) {
    return defaultTargetSelectorFor(state, monster, livingPlayers);
  }

  const lock = candidates[0];
  monster.fixate = {
    playerId: lock.id,
    roundsRemaining: FIXATE_DURATION,
  };
  return lock;
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
  const threatDecay = THREAT_DECAY;
  // Canonical: base energy is 4 per turn, no carryover.
  for (const player of state.players) {
    player.block = 0;
    player.energy = STARTING_ENERGY;
    player.energyMax = STARTING_ENERGY;
    // Pending energy delta from last round's buffs/debuffs (Overload
    // Protocol's −2, Corrupt Signal's −1). Applied AFTER the energy reset
    // and BEFORE decay, so the delta lands on this turn and not the next.
    if (player.hp > 0) {
      const delta = player.statuses?.nextTurnEnergyDelta ?? 0;
      if (delta !== 0) {
        player.energy = Math.max(0, player.energy + delta);
        // Clear immediately — startNextRound runs before decayPlayerStatuses
        // and we don't want the delta to linger another round.
        if (player.statuses) delete player.statuses.nextTurnEnergyDelta;
        if (player.statusDecay) delete player.statusDecay.nextTurnEnergyDelta;
      }
    }
    // Reset per-turn threat tally so Storm Charge Overload checks fresh
    // each round.
    player.threatGainedThisTurn = 0;
    // Reset Storm Charge passive flag so first attack of new round gets
    // the +1 damage bonus.
    player.stormChargeUsedThisTurn = false;
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
  // One-shot global flags that scope to "this turn" expire at round end.
  // Mutation Zone is the only such flag today; future per-round arena
  // effects can join it here.
  if (state.flags?.mutationZone) {
    delete state.flags.mutationZone;
  }

  state.roundNumber += 1;

  // Canonical Party Deck: draw 1-2 new Party Cards into the shared zone.
  // Reset the per-turn play counter for chain-scaling cards like Chain
  // Reaction.
  state.partyPlayedThisTurn = 0;
  drawPartyCards(state, PARTY_CARDS_PER_ROUND);

  // Aura tick. Function references don't survive structuredClone, so each
  // aura's per-round behavior is dispatched by id rather than stored on
  // the aura object itself.
  applyAuraRoundTicks(state);

  // Apply per-player Regen at the top of the round. Regen is applied AFTER
  // the aura tick so Auras like Growth Protocol (which add regen at end of
  // round) take effect on the very next round.
  for (const player of state.players) {
    if (player.hp <= 0) continue;
    const regen = player.statuses?.regen ?? 0;
    if (regen > 0) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + regen);
      const healed = player.hp - before;
      if (healed > 0) {
        pushLog(state, {
          kind: "info",
          text: `${player.name} regenerates ${healed} HP.`,
        });
      }
    }
  }

  // Run-scoped relic onRoundStart hooks (Networked Inverter etc.).
  applyRelicHook("onRoundStart", state, { drawCards });

  const threatSummary = state.players
    .map((p) => `${p.name} ${getThreat(state, p.id)}`)
    .join(" / ");
  pushLog(state, {
    kind: "round-start",
    round: state.roundNumber,
    text: `Round ${state.roundNumber} · Energy ${STARTING_ENERGY}/${MAX_ENERGY} · Threat: ${threatSummary}`,
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

// ===== Buff / debuff helpers =====
//
// Buff stacks live on `player.statuses` (the same bag used for marked,
// surge, frenzy, ...). `addBuff` and `clearBuff` are thin aliases over
// addPlayerStatus that read more clearly at the call site. Global, arena-
// wide flags live on `state.flags` and use `globalBuff` / `clearGlobalBuff`.
//
// Canonical buff status keys (decay 1 per round end unless noted):
//   damageBoostThisTurn — +1 damage on every damage action this turn
//                          (Overclock Sync). Decay 1.
//   firstCardDiscount    — first queued card next turn costs −1 energy
//                          (Network Efficiency). Decay 1, cleared on use.
//   nextCardCostExtra    — next queued card costs +N energy
//                          (System Lag). Decay 1, cleared on use.
//   nextTurnEnergyDelta  — energy delta applied at start of next round
//                          (Overload Protocol, Corrupt Signal). Decay 1
//                          but applied first at startNextRound.
//   strength             — +1 damage per stack on the next damage action
//                          (Bio Surge). Consumes one stack per damage
//                          action (mirrors surge). Decay 1.
//
// Note: `surge` is the Step-2 unused-energy buff and stays separate
// (capped at SURGE_CAP = 3). `strength` is the Bio-Surge stack and has
// no cap so multi-player unused-energy windfalls aren't squashed.
export function addBuff(state, playerId, key, amount = 1, options = {}) {
  return addPlayerStatus(state, playerId, key, amount, options);
}

export function clearBuff(state, playerId, key) {
  const player = getPlayer(state, playerId);
  if (player.statuses && key in player.statuses) {
    delete player.statuses[key];
  }
  if (player.statusDecay && key in player.statusDecay) {
    delete player.statusDecay[key];
  }
}

export function globalBuff(state, key, value = true) {
  if (!state.flags) state.flags = {};
  state.flags[key] = value;
}

export function clearGlobalBuff(state, key) {
  if (state.flags && key in state.flags) {
    delete state.flags[key];
  }
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
  const player = state.players.find((p) => p.id === playerId);
  // Canonical rule: while a monster is fixated on someone else, every other
  // player's positive threat gain is reduced by 1 (floor 0). The fixated
  // player themselves is unaffected.
  let reduction = 0;
  const fix = state.monster.fixate;
  if (amount > 0 && fix && fix.roundsRemaining > 0 && fix.playerId !== playerId) {
    reduction = 1;
  }
  // Hydroflow passive: holding any hydroflow tokens reduces gains of 2+ by 1.
  if (amount >= 2 && (player?.tokens?.hydroflow ?? 0) > 0) {
    reduction += 1;
  }
  let adjusted = Math.max(0, amount - reduction);
  // Combination — Adaptive Control (Bio-Growth + Hydroflow):
  // when the player would gain 5+ threat from a single source (post the
  // standard Hydroflow −1 reduction), clamp it to 2 and grant 1 Bio-Growth.
  // The full canonical rule also lets the holder convert up to 4 threat into
  // healing, but that's a card-level action — handled by content, not engine.
  if (
    player
    && adjusted >= 5
    && (player.tokens?.bioGrowth ?? 0) > 0
    && (player.tokens?.hydroflow ?? 0) > 0
  ) {
    const prevented = adjusted - 2;
    adjusted = 2;
    if (!player.tokens) player.tokens = { bioGrowth: 0, hydroflow: 0, stormCharge: 0 };
    player.tokens.bioGrowth = (player.tokens.bioGrowth ?? 0) + 1;
    pushLog(state, {
      kind: "info",
      text: `${player.name} channels Adaptive Control — threat clamped to 2 (prevented ${prevented}). +1 Bio-Growth.`,
    });
    pushEvent(state, "criticalLine", {
      target: { type: "player", playerId: player.id },
      label: "Adaptive Control",
      amount: prevented,
    });
  }
  const before = getThreat(state, playerId);
  const after = Math.min(cap, before + adjusted);
  state.monster.threat[playerId] = after;
  // Track per-turn threat gain for Storm Charge "Overload" trigger.
  if (player && adjusted > 0) {
    player.threatGainedThisTurn = (player.threatGainedThisTurn ?? 0) + adjusted;
  }
  pushEvent(state, "threat", {
    target: { type: "player", playerId },
    amount: adjusted,
  });
  // Canonical Dual Punishment: while a fixate is active on player A, if
  // player B (B != A) crosses the fixate threshold this gain, fire the
  // monster's dualPunishment payload. Stacks per player.
  if (
    fix
    && fix.roundsRemaining > 0
    && fix.playerId !== playerId
    && before < FIXATE_THREAT_THRESHOLD
    && after >= FIXATE_THREAT_THRESHOLD
  ) {
    triggerDualPunishment(state, playerId);
  }
}

function triggerDualPunishment(state, triggerPlayerId) {
  const monster = state.monster;
  const target = state.players.find((p) => p.id === triggerPlayerId);
  if (!target || target.hp <= 0) return;
  // Default punishment: deal 4 damage to the triggering player. Monsters
  // can override by setting `monster.dualPunishment = (state, target) => {...}`.
  if (typeof monster.dualPunishment === "function") {
    monster.dualPunishment(state, target);
  } else {
    applyPlayerDamage(state, target, 4);
  }
  pushLog(state, {
    kind: "info",
    text: `${monster.name} unleashes Dual Punishment on ${target.name}.`,
  });
  pushEvent(state, "criticalLine", {
    target: { type: "player", playerId: target.id },
    label: "Dual Punishment",
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

// ===== Canonical Party Deck =====
//
// Per `docs/canonical-rules.md` §6, each round draws 1-2 cards into a
// shared `partyHand` that any player may play (paying the cost from
// their own energy). Cards with `category: "aura"` move to
// `state.activeAuras` instead of being discarded after play.
//
// This is the engine entry point. App-level code calls `playPartyCard`
// when a player clicks a Party Card; `drawPartyCards` is invoked by the
// engine itself (createCoopBattle + startNextRound).

const PARTY_CARDS_DRAWABLE_REQUIRES_OK = new Set([
  // List the engine systems that ARE built. Cards whose `requires` lists
  // anything outside this set are filtered from draws so the Party Deck
  // never offers a card whose effect can't fire.
  "aura-system",
  // Buff/debuff stack engine (this PR):
  "buff-stack",
  "next-card-flag",
  "next-turn-flag",
  "per-turn-energy-tracking",
  "unused-energy-tracking",
  "strength-stack",
]);

function partyCardIsPlayableNow(card) {
  if (!Array.isArray(card.requires) || card.requires.length === 0) return true;
  return card.requires.every((req) => PARTY_CARDS_DRAWABLE_REQUIRES_OK.has(req));
}

export function drawPartyCards(state, count = PARTY_CARDS_PER_ROUND) {
  const pool = partyDeckCards.filter(partyCardIsPlayableNow);
  if (pool.length === 0) return;
  if (!Array.isArray(state.partyHand)) state.partyHand = [];
  for (let i = 0; i < count; i += 1) {
    const card = pool[Math.floor(Math.random() * pool.length)];
    state.partyHand.push({
      partyInstanceId: `party-${state.roundNumber}-${i}-${state.partyHand.length}`,
      cardId: card.id,
    });
  }
  pushLog(state, {
    kind: "info",
    text: `Party Deck draws ${count} card${count === 1 ? "" : "s"}.`,
  });
}

export function playPartyCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);
  const player = getPlayer(state, command.playerId);
  if (player.hp <= 0) {
    throw new Error(`${player.name} cannot play a Party Card while defeated.`);
  }
  const handIndex = (state.partyHand ?? []).findIndex(
    (entry) => entry.partyInstanceId === command.partyInstanceId,
  );
  if (handIndex < 0) {
    throw new Error("That Party Card is no longer in the deck.");
  }
  const entry = state.partyHand[handIndex];
  const card = getPartyDeckCard(entry.cardId);
  if (!card) {
    throw new Error(`Unknown Party Card: ${entry.cardId}`);
  }
  if (getRemainingEnergy(player) < card.cost) {
    throw new Error(`${player.name} cannot afford ${card.name} (cost ${card.cost}).`);
  }
  player.energy -= card.cost;
  applyPartyCardEffects(state, player, card);
  state.partyPlayedThisTurn = (state.partyPlayedThisTurn ?? 0) + 1;
  if (card.persistent) {
    if (!Array.isArray(state.activeAuras)) state.activeAuras = [];
    state.activeAuras.push({ id: card.id, name: card.name, description: card.description });
  }
  state.partyHand.splice(handIndex, 1);
  pushLog(state, {
    kind: "info",
    text: `${player.name} plays Party Card "${card.name}".`,
  });
  pushEvent(state, "plan", {
    target: { type: "player", playerId: player.id },
    label: card.name,
  });
  return state;
}

// ===== Party Deck Interactions =====
//
// Per `docs/canonical-rules.md` §6, the Party Deck supports four player
// interactions: Peek Ahead, Discard, Duplicate, Infuse. Each costs 1 energy
// (paid by the acting player) and is independent of playing the card itself.
// `Infuse` is intentionally not exported yet — the canonical Infusion
// mechanic isn't built — so the UI surfaces it as a disabled affordance.
const PARTY_INTERACTION_COST = 1;

function spendInteractionEnergy(player, label) {
  if (getRemainingEnergy(player) < PARTY_INTERACTION_COST) {
    throw new Error(
      `${player.name} cannot afford to ${label} (need ${PARTY_INTERACTION_COST} energy).`,
    );
  }
  player.energy -= PARTY_INTERACTION_COST;
}

export function peekNextPartyCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);
  const player = getPlayer(state, command.playerId);
  if (player.hp <= 0) {
    throw new Error(`${player.name} cannot peek while defeated.`);
  }
  spendInteractionEnergy(player, "peek the Party Deck");
  // Pick a random eligible card from the playable pool — represents a
  // glimpse of what the deck might draw next. Deterministic given the same
  // RNG seed; production runs use Math.random.
  const pool = partyDeckCards.filter(partyCardIsPlayableNow);
  if (pool.length === 0) {
    state.partyPeek = null;
    pushLog(state, {
      kind: "info",
      text: `${player.name} peeks — the deck is empty.`,
    });
    return state;
  }
  const next = pool[Math.floor(Math.random() * pool.length)];
  state.partyPeek = { cardId: next.id };
  pushLog(state, {
    kind: "info",
    text: `${player.name} peeks: ${next.name}.`,
  });
  return state;
}

export function discardPartyCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);
  const player = getPlayer(state, command.playerId);
  if (player.hp <= 0) {
    throw new Error(`${player.name} cannot discard while defeated.`);
  }
  const handIndex = (state.partyHand ?? []).findIndex(
    (entry) => entry.partyInstanceId === command.partyInstanceId,
  );
  if (handIndex < 0) {
    throw new Error("That Party Card is no longer in the deck.");
  }
  const entry = state.partyHand[handIndex];
  const card = getPartyDeckCard(entry.cardId);
  spendInteractionEnergy(player, "discard a Party Card");
  state.partyHand.splice(handIndex, 1);
  // Reuse the engine's drawPartyCards so future scaling/balance logic is
  // shared with regular round draws.
  drawPartyCards(state, 1);
  pushLog(state, {
    kind: "info",
    text: `${player.name} discards Party Card "${card?.name ?? entry.cardId}" and draws a fresh one.`,
  });
  return state;
}

export function duplicatePartyCard(currentState, command) {
  const state = cloneState(currentState);
  ensurePlanning(state);
  const player = getPlayer(state, command.playerId);
  if (player.hp <= 0) {
    throw new Error(`${player.name} cannot duplicate while defeated.`);
  }
  const entry = (state.partyHand ?? []).find(
    (e) => e.partyInstanceId === command.partyInstanceId,
  );
  if (!entry) {
    throw new Error("That Party Card is no longer in the deck.");
  }
  const card = getPartyDeckCard(entry.cardId);
  if (!card) {
    throw new Error(`Unknown Party Card: ${entry.cardId}`);
  }
  spendInteractionEnergy(player, `duplicate ${card.name}`);
  // Run effects through the same dispatcher used by playPartyCard so any
  // future card type is automatically supported. The card stays in the
  // shared hand for someone to actually play on its own.
  applyPartyCardEffects(state, player, card);
  pushLog(state, {
    kind: "info",
    text: `${player.name} duplicates the effect of "${card.name}".`,
  });
  pushEvent(state, "plan", {
    target: { type: "player", playerId: player.id },
    label: `Duplicate: ${card.name}`,
  });
  return state;
}

function applyPartyCardEffects(state, player, card) {
  for (const effect of card.effects ?? []) {
    applyPartyEffect(state, player, effect, card);
  }
}

function applyPartyEffect(state, player, effect, card) {
  switch (effect.type) {
    case "block": {
      // Reuse the standard target resolver.
      for (const target of getPlayerTargets(state, player, effect.target ?? "self")) {
        target.block += effect.amount;
      }
      return;
    }
    case "heal": {
      for (const target of getPlayerTargets(state, player, effect.target ?? "self")) {
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + effect.amount);
        const healed = target.hp - before;
        if (healed > 0) {
          addThreat(state, player.id, Math.floor(healed / 2));
        }
      }
      return;
    }
    case "draw": {
      for (const target of getPlayerTargets(state, player, effect.target ?? "self")) {
        drawCards(state, target, effect.count ?? 1);
      }
      return;
    }
    case "threat": {
      const targets = getPlayerTargets(state, player, effect.target ?? "self");
      for (const target of targets) {
        addThreat(state, target.id, effect.amount);
      }
      return;
    }
    case "energy": {
      const targets = getPlayerTargets(state, player, effect.target ?? "self");
      for (const target of targets) {
        target.energy = Math.max(0, target.energy + effect.amount);
      }
      return;
    }
    case "blockHighestThreatEqualToThreat": {
      const living = state.players.filter((p) => p.hp > 0);
      if (living.length === 0) return;
      const top = [...living].sort(
        (a, b) => (state.monster.threat[b.id] ?? 0) - (state.monster.threat[a.id] ?? 0),
      )[0];
      const threat = state.monster.threat[top.id] ?? 0;
      top.block += threat;
      return;
    }
    case "forceFixateHighestThreat": {
      const living = state.players.filter((p) => p.hp > 0);
      if (living.length === 0) return;
      const top = [...living].sort(
        (a, b) => (state.monster.threat[b.id] ?? 0) - (state.monster.threat[a.id] ?? 0),
      )[0];
      state.monster.fixate = {
        playerId: top.id,
        roundsRemaining: effect.duration ?? 1,
      };
      addPlayerStatus(state, top.id, "marked", effect.duration ?? 1);
      return;
    }
    case "damageAllPlayers": {
      for (const target of state.players) {
        if (target.hp <= 0) continue;
        applyPlayerDamage(state, target, effect.amount);
      }
      return;
    }
    case "damageMonster": {
      // Single-monster shortcut for Party damage cards (until multi-monster lands).
      dealMonsterDamage(state, player, effect.amount, effect.element);
      return;
    }
    case "buffAllDamageThisTurn": {
      // Overclock Sync: +N damage to every player's damage actions this
      // turn. If everyone spent all their energy last turn (no unused
      // energy on any living player), grant the bonus too.
      const living = state.players.filter((p) => p.hp > 0);
      let amount = effect.amount ?? 1;
      if (
        typeof effect.bonusIfAllSpentAllEnergy === "number"
        && living.length > 0
        && living.every((p) => p.hadUnusedEnergy === false)
      ) {
        amount += effect.bonusIfAllSpentAllEnergy;
      }
      for (const target of living) {
        addBuff(state, target.id, "damageBoostThisTurn", amount, { decay: 1 });
      }
      pushLog(state, {
        kind: "info",
        text: `${card.name} — all players gain +${amount} damage this turn.`,
      });
      return;
    }
    case "discountFirstCardNextTurn": {
      // Network Efficiency: each player's first queued card next turn
      // costs −N. Clears on use (queueCard consumes when first planned
      // card resolves through the discount). Decay 1 so it expires if
      // unused.
      const targets = getPlayerTargets(state, player, effect.target ?? "all");
      for (const target of targets) {
        addBuff(state, target.id, "firstCardDiscount", effect.amount ?? 1, {
          mode: "set",
          decay: 1,
        });
      }
      return;
    }
    case "buffStrengthFromUnusedEnergy": {
      // Bio Surge: stacks of strength scale with total unused energy
      // among all living players (sum of `unusedEnergyLastTurn`). Capped
      // at 6 so a 4-player full-skip doesn't trivialize a fight.
      const living = state.players.filter((p) => p.hp > 0);
      const totalUnused = living.reduce(
        (sum, p) => sum + Math.max(0, p.unusedEnergyLastTurn ?? 0),
        0,
      );
      const stacks = Math.min(6, totalUnused * (effect.amount ?? 1));
      if (stacks > 0) {
        addBuff(state, player.id, "strength", stacks, { decay: 1 });
        pushLog(state, {
          kind: "info",
          text: `${player.name} channels Bio Surge — +${stacks} strength.`,
        });
      }
      return;
    }
    case "debuffNextCardCost": {
      // System Lag: each player's next queued card costs +N energy.
      // Cleared on first queue (queueCard handles consumption).
      const targets = getPlayerTargets(state, player, effect.target ?? "all");
      for (const target of targets) {
        addBuff(state, target.id, "nextCardCostExtra", effect.amount ?? 1, {
          mode: "set",
          decay: 1,
        });
      }
      return;
    }
    case "debuffRandomPlayerEnergy": {
      // Corrupt Signal: a random living player has their next-turn energy
      // reduced by N. Encoded as a negative `nextTurnEnergyDelta`, applied
      // and cleared at startNextRound.
      const living = state.players.filter((p) => p.hp > 0);
      if (living.length === 0) return;
      const idx = Math.floor(Math.random() * living.length);
      const victim = living[idx];
      addBuff(state, victim.id, "nextTurnEnergyDelta", -(effect.amount ?? 1), {
        decay: 1,
      });
      pushLog(state, {
        kind: "info",
        text: `${card.name} — ${victim.name} loses ${effect.amount ?? 1} energy next turn.`,
      });
      return;
    }
    case "buffAllDamagePerThreatBucket": {
      // Mutation Zone: +bonus damage per `per` total threat across all
      // players. Set as a state-level flag — read by dealMonsterDamage on
      // every damage hit. Cleared at end of round in startNextRound.
      globalBuff(state, "mutationZone", {
        per: effect.per ?? 5,
        bonus: effect.bonus ?? 1,
      });
      pushLog(state, {
        kind: "info",
        text: `${card.name} — Mutation Zone is active (+${effect.bonus ?? 1} damage per ${effect.per ?? 5} total threat).`,
      });
      return;
    }
    case "debuffNextTurnEnergy": {
      // Overload Protocol payload: queue a per-player energy delta that
      // applies at startNextRound. `effect.amount` is signed (negative
      // for the canonical "lose 2 energy" case).
      const targets = getPlayerTargets(state, player, effect.target ?? "all");
      for (const target of targets) {
        addBuff(state, target.id, "nextTurnEnergyDelta", effect.amount ?? 0, {
          decay: 1,
        });
      }
      return;
    }
    case "randomBuffOrDebuff": {
      // Jackpot Cache: 50/50 a powerful buff or a massive debuff.
      // Buff pool:
      //   - +5 block to all living players
      //   - +2 strength to the player who played the card
      //   - +1 damageBoostThisTurn to all living players
      // Debuff pool:
      //   - +3 threat to all living players
      //   - random living player loses 2 energy next turn
      //   - all players' next card costs +1 energy
      const living = state.players.filter((p) => p.hp > 0);
      if (living.length === 0) return;
      const isBuff = Math.random() < 0.5;
      if (isBuff) {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
          for (const p of living) p.block += 5;
          pushLog(state, { kind: "info", text: `${card.name} — Jackpot! All players gain 5 block.` });
        } else if (roll === 1) {
          addBuff(state, player.id, "strength", 2, { decay: 1 });
          pushLog(state, { kind: "info", text: `${card.name} — Jackpot! ${player.name} gains +2 strength.` });
        } else {
          for (const p of living) {
            addBuff(state, p.id, "damageBoostThisTurn", 1, { decay: 1 });
          }
          pushLog(state, { kind: "info", text: `${card.name} — Jackpot! All players gain +1 damage this turn.` });
        }
      } else {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
          for (const p of living) addThreat(state, p.id, 3);
          pushLog(state, { kind: "info", text: `${card.name} — Bust! All players gain 3 threat.` });
        } else if (roll === 1) {
          const victim = living[Math.floor(Math.random() * living.length)];
          addBuff(state, victim.id, "nextTurnEnergyDelta", -2, { decay: 1 });
          pushLog(state, { kind: "info", text: `${card.name} — Bust! ${victim.name} loses 2 energy next turn.` });
        } else {
          for (const p of living) {
            addBuff(state, p.id, "nextCardCostExtra", 1, { mode: "set", decay: 1 });
          }
          pushLog(state, { kind: "info", text: `${card.name} — Bust! All players' next card costs +1.` });
        }
      }
      return;
    }
    default: {
      // Unsupported effects (multi-monster damage, infusion, fusion, buff
      // stacks, next-card flags, randomization) become no-ops with a log.
      pushLog(state, {
        kind: "info",
        text: `[${card.name}] effect "${effect.type}" not yet wired (deferred).`,
      });
    }
  }
}

// ===== Aura helpers + per-round dispatcher =====
//
// Function references can't be stored on `state.activeAuras` because
// structuredClone strips them. Instead, the engine keeps each aura's
// per-round behavior here and dispatches by id at the top of every round.

function auraActive(state, auraId) {
  return Array.isArray(state.activeAuras)
    && state.activeAuras.some((a) => a.id === auraId);
}

function applyAuraRoundTicks(state) {
  if (!Array.isArray(state.activeAuras) || state.activeAuras.length === 0) return;
  for (const aura of state.activeAuras) {
    switch (aura.id) {
      case "growth-protocol": {
        // Players who had unused energy last turn gain 2 Regen at the top
        // of the new round. Reads the stable `hadUnusedEnergy` flag set in
        // resolveRound (surge stacks would have already decayed by now).
        for (const player of state.players) {
          if (player.hp <= 0) continue;
          if (player.hadUnusedEnergy) {
            addPlayerStatus(state, player.id, "regen", 2, { mode: "max", decay: 1 });
          }
        }
        break;
      }
      case "data-stream": {
        // Set a flag on each living player; the first card they queue this
        // round draws +1 card on resolve. Cleared in resolveCard.
        for (const player of state.players) {
          if (player.hp <= 0) continue;
          player.dataStreamPending = true;
        }
        break;
      }
      // static-field is checked inline in dealMonsterDamage (Overclock+2).
      // chaos-field is gated on Infusion which is not yet implemented.
      default:
        break;
    }
  }
}
