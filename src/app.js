import { classDefinitions, selectableClasses } from "./content/classes.js";
import { getCardImage } from "./content/card-sheets.js";
import { getCardArtDefinition } from "./content/card-art.js";
import { getCardDefinition } from "./content/cards.js";
import { getEffectDuration, getEffectName, shouldShowEffectAmount } from "./effects/effect-library.js";
import {
  attackWithMonster,
  createLocalDuel,
  endTurn,
  getActivePlayer,
  getCardCost,
  getValidMonsterTargets,
  getValidTargets,
  playCard,
  targetKey,
} from "./engine/game.js";

const app = document.querySelector("#app");

let setup = {
  playerOneClass: "arian",
  playerTwoClass: "geert",
};

let gameState = null;
let pendingAction = null;
let message = "";
let lastSeenEventId = 0;
let activeEffects = [];
let effectInstanceId = 1;

render();

app.addEventListener("change", (event) => {
  const field = event.target.dataset.setupField;
  if (!field) {
    return;
  }

  setup = { ...setup, [field]: event.target.value };
  render();
});

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  try {
    handleAction(button);
  } catch (error) {
    message = error.message;
    render();
  }
});

function handleAction(element) {
  const action = element.dataset.action;

  if (action === "start-game") {
    gameState = createLocalDuel({
      players: [
        {
          id: "player-1",
          name: classDefinitions[setup.playerOneClass].shortName,
          classId: setup.playerOneClass,
          raceId: classDefinitions[setup.playerOneClass].raceId,
        },
        {
          id: "player-2",
          name: classDefinitions[setup.playerTwoClass].shortName,
          classId: setup.playerTwoClass,
          raceId: classDefinitions[setup.playerTwoClass].raceId,
        },
      ],
    });
    lastSeenEventId = getLatestEventId(gameState);
    activeEffects = [];
    pendingAction = null;
    message = "Opening hand drawn.";
    render();
    return;
  }

  if (action === "new-game") {
    gameState = null;
    pendingAction = null;
    message = "";
    lastSeenEventId = 0;
    activeEffects = [];
    render();
    return;
  }

  if (action === "cancel-pending") {
    pendingAction = null;
    message = "";
    render();
    return;
  }

  if (!gameState) {
    return;
  }

  const activePlayer = getActivePlayer(gameState);

  if (action === "end-turn") {
    gameState = endTurn(gameState, activePlayer.id);
    enqueueEffectsFromState(gameState);
    pendingAction = null;
    message = "";
    render();
    return;
  }

  if (action === "play-card") {
    const cardInstance = activePlayer.hand.find((card) => card.instanceId === element.dataset.instanceId);
    const card = getCardDefinition(cardInstance.cardId);

    if (card.target === "none") {
      gameState = playCard(gameState, {
        playerId: activePlayer.id,
        instanceId: cardInstance.instanceId,
        target: null,
      });
      enqueueEffectsFromState(gameState);
      pendingAction = null;
      message = "";
      render();
      return;
    }

    if (card.target === "self") {
      gameState = playCard(gameState, {
        playerId: activePlayer.id,
        instanceId: cardInstance.instanceId,
        target: { type: "hero", playerId: activePlayer.id },
      });
      enqueueEffectsFromState(gameState);
      pendingAction = null;
      message = "";
      render();
      return;
    }

    pendingAction = {
      type: "card",
      playerId: activePlayer.id,
      instanceId: cardInstance.instanceId,
      label: card.name,
      targets: getValidTargets(gameState, activePlayer.id, card).map(targetKey),
    };
    message = `Choose a target for ${card.name}.`;
    render();
    return;
  }

  if (action === "monster-attack") {
    const slotIndex = Number(element.dataset.slotIndex);
    const monster = activePlayer.field[slotIndex];
    pendingAction = {
      type: "monster",
      playerId: activePlayer.id,
      slotIndex,
      label: monster.name,
      targets: getValidMonsterTargets(gameState, activePlayer.id).map(targetKey),
    };
    message = `Choose a target for ${monster.name}.`;
    render();
    return;
  }

  if (action === "target-hero" || action === "target-monster") {
    if (!pendingAction) {
      return;
    }

    const target =
      action === "target-hero"
        ? { type: "hero", playerId: element.dataset.playerId }
        : {
            type: "monster",
            playerId: element.dataset.playerId,
            slotIndex: Number(element.dataset.slotIndex),
          };

    if (!pendingAction.targets.includes(targetKey(target))) {
      message = "That target is protected or invalid.";
      render();
      return;
    }

    if (pendingAction.type === "card") {
      gameState = playCard(gameState, {
        playerId: pendingAction.playerId,
        instanceId: pendingAction.instanceId,
        target,
      });
      enqueueEffectsFromState(gameState);
    }

    if (pendingAction.type === "monster") {
      gameState = attackWithMonster(gameState, {
        playerId: pendingAction.playerId,
        slotIndex: pendingAction.slotIndex,
        target,
      });
      enqueueEffectsFromState(gameState);
    }

    pendingAction = null;
    message = "";
    render();
  }
}

function render() {
  app.innerHTML = gameState ? renderGame() : renderSetup();
}

function renderSetup() {
  return `
    <section class="setup-shell">
      <div class="topbar">
        <div>
          <p class="eyebrow">Local prototype</p>
          <h1>The Fracture of Aetherfall</h1>
        </div>
        <span class="status-pill">1v1 hotseat</span>
      </div>

      <div class="setup-grid">
        ${renderSetupPlayer("Player 1", "playerOneClass")}
        ${renderSetupPlayer("Player 2", "playerTwoClass")}
      </div>

      <div class="mode-row">
        <button class="mode-button active" type="button">1v1</button>
        <button class="mode-button" type="button" disabled>2v2 planned</button>
        <button class="mode-button" type="button" disabled>FFA planned</button>
      </div>

      <div class="action-row">
        <button class="primary-button" type="button" data-action="start-game">Start local match</button>
      </div>
    </section>
  `;
}

function renderSetupPlayer(label, classField) {
  const selectedChampion = classDefinitions[setup[classField]];
  return `
    <section class="setup-panel">
      <h2>${label}</h2>
      <label>
        Champion Deck
        <select data-setup-field="${classField}">
          ${selectableClasses
            .map(
              (classDef) => `
                <option value="${classDef.id}" ${setup[classField] === classDef.id ? "selected" : ""} ${
                  classDef.implemented ? "" : "disabled"
                }>
                  ${classDef.shortName} - ${classDef.aspect}${classDef.implemented ? "" : " (planned)"}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
      <div class="champion-summary">
        <strong>${selectedChampion.raceName}</strong>
        <span>${selectedChampion.summary}</span>
        <small>${selectedChampion.resourceName}: ${selectedChampion.personality}</small>
      </div>
    </section>
  `;
}

function renderGame() {
  const activePlayer = getActivePlayer(gameState);
  const opponent = getOpponent(activePlayer.id);
  const winner = gameState.winnerId ? gameState.players.find((player) => player.id === gameState.winnerId) : null;
  const nextPlayer = getOpponent(activePlayer.id);

  return `
    <section class="game-table">
      <div class="table-topbar">
        <div>
          <p class="eyebrow">Turn ${gameState.turnNumber}</p>
          <h1>${winner ? `${winner.name} wins` : `${activePlayer.name}'s turn`}</h1>
        </div>
        <div class="topbar-actions">
          <span class="status-pill">Next ${nextPlayer.name}</span>
          <button class="end-turn-button" type="button" data-action="end-turn" ${winner ? "disabled" : ""}>End turn</button>
          <button class="secondary-button" type="button" data-action="new-game">New match</button>
        </div>
      </div>

      ${message ? `<div class="message-bar">${message} ${pendingAction ? `<button type="button" data-action="cancel-pending">Cancel</button>` : ""}</div>` : ""}

      <div class="playmat">
        <section class="player-zone opponent-zone">
          ${renderHiddenHand(opponent)}
          ${renderHero(opponent, "opponent")}
          ${renderFieldRow(opponent, false)}
        </section>

        <section class="center-lane">
          <div class="pile-stack opponent-pile">
            <span>Deck</span>
            <strong>${opponent.deck.length}</strong>
          </div>
          <div class="turn-orb">
            <span>${activePlayer.name}</span>
            <strong>${activePlayer.mana}/${activePlayer.manaCrystals}</strong>
          </div>
          <div class="pile-stack active-pile">
            <span>Deck</span>
            <strong>${activePlayer.deck.length}</strong>
          </div>
        </section>

        <section class="player-zone active-zone">
          ${renderFieldRow(activePlayer, true)}
          ${renderHero(activePlayer, "active")}
          ${renderManaCrystals(activePlayer)}
          ${renderHand(activePlayer, Boolean(winner))}
        </section>
      </div>

      <section class="log-drawer">
        <h2>Match log</h2>
        <ol>
          ${gameState.log.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
        </ol>
      </section>
    </section>
  `;
}

function renderHero(player, seat) {
  const classDef = selectableClasses.find((candidate) => candidate.id === player.classId);
  const heroTarget = { type: "hero", playerId: player.id };
  const targetable = isPendingTarget(heroTarget);
  const healthPercent = Math.max(0, Math.round((player.hero.hp / player.hero.maxHp) * 100));

  return `
    <button
      class="hero-portrait ${seat} ${targetable ? "targetable" : ""}"
      type="button"
      data-action="target-hero"
      data-player-id="${player.id}"
    >
      <span class="hero-name">${player.name}</span>
      <span class="hero-class">${classDef.aspect} | ${classDef.raceName}</span>
      <span class="hero-life">
        <strong>${player.hero.hp}</strong>
        <em>${player.hero.block}</em>
      </span>
      <span class="health-track"><span style="width: ${healthPercent}%"></span></span>
      <span class="hero-status">${renderHeroStatuses(player)}</span>
      ${renderEffectSprites(heroTarget)}
    </button>
  `;
}

function renderHeroStatuses(player) {
  const statuses = player.hero.statuses.map((status) => `${status.type} ${status.duration}`);
  const counters = renderCounterSummary(player);
  if (counters) {
    statuses.push(counters);
  }
  statuses.push(`Ult ${player.hero.ultimateCharge}/10`);
  return statuses.join(" | ");
}

function renderCounterSummary(player) {
  if (!player.counters) {
    return "";
  }

  if (player.classId === "arian") {
    return `Pressure ${player.counters.pressure} / Stored ${player.counters.storedDamage}`;
  }
  if (player.classId === "geert") {
    return `Polarity ${player.counters.polarity} / Changes ${player.counters.polarityChanges} / Combo ${player.counters.comboCharge}`;
  }
  if (player.classId === "wouter") {
    return `Loot ${player.counters.loot}`;
  }
  if (player.classId === "noah") {
    return `Instability ${player.counters.instability}`;
  }

  return "";
}

function renderFieldRow(player, isActivePlayer) {
  return `
    <div class="minion-row">
      ${player.field.map((monster, slotIndex) => renderFieldSlot(player, monster, slotIndex, isActivePlayer)).join("")}
    </div>
  `;
}

function renderFieldSlot(player, monster, slotIndex, isActivePlayer) {
  if (!monster) {
    return `
      <div class="board-slot empty">
        <span class="empty-slot-mark"></span>
        ${renderEffectSprites({ type: "monster", playerId: player.id, slotIndex })}
      </div>
    `;
  }

  const monsterTarget = { type: "monster", playerId: player.id, slotIndex };
  const card = getCardDefinition(monster.cardId);
  const art = getCardArtDefinition(card);
  const targetable = isPendingTarget(monsterTarget);

  return `
    <div class="board-slot ${targetable ? "targetable" : ""}">
      <button
        class="minion-token ${monster.ready ? "ready" : ""}"
        type="button"
        data-action="target-monster"
        data-player-id="${player.id}"
        data-slot-index="${slotIndex}"
      >
        <strong>${monster.name}</strong>
        <span class="minion-art ${art.className}">
          <span>${monster.traits.includes("guard") ? "Guard" : art.label}</span>
        </span>
        <span class="minion-stats">
          <em>${monster.attack}</em>
          <em>${monster.hp}</em>
        </span>
      </button>
      ${
        isActivePlayer
          ? `<button class="attack-button" type="button" data-action="monster-attack" data-slot-index="${slotIndex}" ${
              monster.ready ? "" : "disabled"
            }>Attack</button>`
          : ""
      }
      ${renderEffectSprites(monsterTarget)}
    </div>
  `;
}

function renderManaCrystals(player) {
  return `
    <div class="mana-bar" aria-label="Mana ${player.mana} of ${player.manaCrystals}">
      <strong>${player.mana}/${player.manaCrystals}</strong>
      <div class="mana-crystals">
        ${Array.from({ length: player.maxManaCrystals }, (_, index) => {
          const crystalNumber = index + 1;
          const className =
            crystalNumber <= player.mana
              ? "filled"
              : crystalNumber <= player.manaCrystals
                ? "empty"
                : "locked";
          return `<span class="mana-crystal ${className}"></span>`;
        }).join("")}
      </div>
    </div>
  `;
}

function renderHand(player, disabled) {
  return `
    <div class="hand-zone">
      ${player.hand.map((cardInstance, index) => renderHandCard(player, cardInstance, disabled, index, player.hand.length)).join("")}
      ${player.hand.length === 0 ? `<div class="empty-hand">No cards in hand.</div>` : ""}
    </div>
  `;
}

function renderHiddenHand(player) {
  return `
    <div class="hidden-hand" aria-label="${player.name} has ${player.hand.length} cards">
      ${player.hand.map(() => `<span class="card-back"></span>`).join("")}
    </div>
  `;
}

function renderHandCard(player, cardInstance, disabled, index, handSize) {
  const card = getCardDefinition(cardInstance.cardId);
  const art = getCardArtDefinition(card);
  const cardImage = getCardImage(card.id);
  const usesCardImage = Boolean(cardImage);
  const cost = getCardCost(player, card);
  const cannotAfford = player.mana < cost;
  const offset = index - (handSize - 1) / 2;
  const rotation = Math.max(-8, Math.min(8, offset * 3));
  const lift = Math.abs(offset) * 3;
  const fullCardStyle = usesCardImage ? `--full-card-aspect: ${cardImage.aspectRatio ?? "2 / 3"};` : "";

  return `
    <button
      class="hand-card ${card.kind} class-${card.classId} ${usesCardImage ? "full-card-image" : ""} ${
        cannotAfford ? "unplayable" : "playable"
      }"
      style="--card-rotation: ${rotation}deg; --card-lift: ${lift}px; ${fullCardStyle}"
      type="button"
      data-action="play-card"
      data-instance-id="${cardInstance.instanceId}"
      ${disabled || cannotAfford ? "disabled" : ""}
    >
      ${
        usesCardImage
          ? renderCardImage(card, cardImage)
          : renderProceduralHandCard(card, art, cost)
      }
    </button>
  `;
}

function renderProceduralHandCard(card, art, cost) {
  return `
    <span class="card-cost">${cost}</span>
    <span class="card-name">${card.name}</span>
    <span class="card-art ${art.className}">
      <span class="art-symbol">${art.symbol}</span>
      <span class="art-label">${art.label}</span>
    </span>
    <span class="card-type">
      <span>${card.classId}</span>
      <span>${card.type ?? card.kind}</span>
    </span>
    <span class="card-text">${card.text}</span>
    ${card.kind === "monster" ? `<span class="card-stats"><em>${card.monster.attack}</em><em>${card.monster.hp}</em></span>` : ""}
  `;
}

function renderCardImage(card, cardImage) {
  return `
    <img
      class="full-card-face"
      src="${cardImage.src}"
      alt=""
      aria-hidden="true"
    />
    <span class="visually-hidden">${card.name}. ${card.text}</span>
  `;
}

function getOpponent(activePlayerId) {
  return gameState.players.find((player) => player.id !== activePlayerId);
}

function enqueueEffectsFromState(state) {
  const newEvents = state.events.filter((event) => event.id > lastSeenEventId);
  if (newEvents.length === 0) {
    return;
  }

  lastSeenEventId = Math.max(...newEvents.map((event) => event.id));

  for (const event of newEvents) {
    if (!event.target) {
      continue;
    }

    const effect = {
      instanceId: effectInstanceId,
      type: event.type,
      target: targetKey(event.target),
      amount: event.amount,
      label: event.label,
    };
    effectInstanceId += 1;
    activeEffects.push(effect);

    window.setTimeout(() => {
      activeEffects = activeEffects.filter((candidate) => candidate.instanceId !== effect.instanceId);
      render();
    }, getEffectDuration(effect.type));
  }

  activeEffects = activeEffects.slice(-24);
}

function getLatestEventId(state) {
  if (!state.events.length) {
    return 0;
  }

  return Math.max(...state.events.map((event) => event.id));
}

function renderEffectSprites(target) {
  const effects = activeEffects.filter((effect) => effect.target === targetKey(target));
  if (!effects.length) {
    return "";
  }

  return `
    <span class="effect-stack" aria-hidden="true">
      ${effects.map(renderEffectSprite).join("")}
    </span>
  `;
}

function renderEffectSprite(effect) {
  return `
    <span class="effect-sprite effect-${effect.type}">
      <span class="effect-core"></span>
      <span class="effect-burst"></span>
      <span class="effect-label">${getEffectLabel(effect)}</span>
    </span>
  `;
}

function getEffectLabel(effect) {
  if (effect.amount && shouldShowEffectAmount(effect.type)) {
    return `${getEffectName(effect.type)} ${effect.amount}`;
  }

  return getEffectName(effect.type);
}

function isPendingTarget(target) {
  return pendingAction?.targets.includes(targetKey(target));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
