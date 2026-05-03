import { classDefinitions, selectableClasses } from "./content/classes.js";
import { getCardDefinition } from "./content/cards.js";
import { getChampionVisual, getEffectVisual } from "./content/game-assets.js";
import { getEffectDuration, getEffectName, shouldShowEffectAmount } from "./effects/effect-library.js";
import {
  createCoopBattle,
  getRemainingEnergy,
  queueCard,
  resolveRound,
  targetKey,
  unqueueCard,
} from "./engine/game.js";
import {
  broadcastLocalAction,
  installMultiplayerHooks,
  pushSnapshotIfHost,
} from "./multiplayer/app-hooks.js";

const app = document.querySelector("#app");

let setup = {
  playerOneClass: "rook",
  playerTwoClass: "lyra",
};

let gameState = null;
let message = "";
let lastSeenEventId = 0;
let activeEffects = [];
let effectInstanceId = 1;

installMultiplayerHooks({
  runAction: (action) => {
    if (!action || typeof action !== "object") {
      return;
    }
    const fakeElement = {
      dataset: { action: action.type, ...(action.dataset ?? {}) },
    };
    try {
      handleAction(fakeElement);
    } catch (error) {
      message = error.message;
      render();
    }
  },
  getState: () => gameState,
  applyState: (state) => {
    gameState = state;
    activeEffects = [];
    lastSeenEventId = state ? getLatestEventId(state) : 0;
    message = "";
    render();
  },
});

render();

function notifyMultiplayer(action) {
  broadcastLocalAction(action);
  pushSnapshotIfHost(gameState);
}

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
    gameState = createCoopBattle({
      players: [
        {
          id: "player-1",
          name: classDefinitions[setup.playerOneClass].shortName,
          classId: setup.playerOneClass,
        },
        {
          id: "player-2",
          name: classDefinitions[setup.playerTwoClass].shortName,
          classId: setup.playerTwoClass,
        },
      ],
    });
    lastSeenEventId = getLatestEventId(gameState);
    activeEffects = [];
    message = "Plan together. Queue cards for both players, then resolve the round.";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "new-game") {
    gameState = null;
    message = "";
    activeEffects = [];
    lastSeenEventId = 0;
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (!gameState) {
    return;
  }

  if (action === "queue-card") {
    gameState = queueCard(gameState, {
      playerId: element.dataset.playerId,
      instanceId: element.dataset.instanceId,
    });
    enqueueEffectsFromState(gameState);
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "unqueue-card") {
    gameState = unqueueCard(gameState, {
      playerId: element.dataset.playerId,
      instanceId: element.dataset.instanceId,
    });
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "resolve-round") {
    gameState = resolveRound(gameState);
    enqueueEffectsFromState(gameState);
    message =
      gameState.phase === "game-over"
        ? gameState.winner === "players"
          ? "The monster is defeated. Victory."
          : "The party fell. Try a different plan."
        : "New round. Draw 5, energy increases, threat decays.";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
  }
}

function render() {
  app.innerHTML = gameState ? renderGame() : renderSetup();
}

function renderSetup() {
  return `
    <section class="setup-shell coop-setup">
      <div class="topbar">
        <div>
          <p class="eyebrow">Co-op boss prototype</p>
          <h1>The Fracture of Aetherfall</h1>
        </div>
        <span class="status-pill">2 players vs 1 monster</span>
      </div>

      <div class="setup-grid">
        ${renderSetupPlayer("Player 1", "playerOneClass")}
        ${renderSetupPlayer("Player 2", "playerTwoClass")}
      </div>

      <section class="rules-panel">
        <h2>New Battle Rules</h2>
        <div class="rules-grid">
          <span>15-card deck per player</span>
          <span>Draw 5 cards each round</span>
          <span>Start at 3 energy</span>
          <span>+1 max energy per round, max 10</span>
          <span>Players plan actions together</span>
          <span>Monster attacks highest threat</span>
        </div>
      </section>

      <div class="action-row">
        <button class="primary-button" type="button" data-action="start-game">Start boss fight</button>
      </div>
    </section>
  `;
}

function renderSetupPlayer(label, classField) {
  const selectedClass = classDefinitions[setup[classField]];
  const championVisual = getChampionVisual(selectedClass.id);
  return `
    <section class="setup-panel class-${selectedClass.id}">
      <div class="setup-panel-header">
        <img class="setup-champion-portrait" src="${championVisual.portrait}" alt="" aria-hidden="true" />
        <div>
          <h2>${label}</h2>
          <strong>${selectedClass.shortName}</strong>
        </div>
      </div>
      <label>
        Character Deck
        <select data-setup-field="${classField}">
          ${selectableClasses
            .map(
              (classDef) => `
                <option value="${classDef.id}" ${setup[classField] === classDef.id ? "selected" : ""}>
                  ${classDef.shortName} - ${classDef.role}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
      <div class="champion-summary">
        <strong>${selectedClass.aspect}</strong>
        <span>${selectedClass.summary}</span>
        <small>${selectedClass.personality}</small>
      </div>
    </section>
  `;
}

function renderGame() {
  const totalQueued = gameState.players.reduce((total, player) => total + player.planned.length, 0);
  const gameOver = gameState.phase === "game-over";

  return `
    <section class="game-table coop-table">
      <div class="table-topbar">
        <div>
          <p class="eyebrow">Round ${gameState.roundNumber}</p>
          <h1>${gameOver ? renderWinnerTitle() : "Plan the round"}</h1>
        </div>
        <div class="topbar-actions">
          <span class="status-pill">${totalQueued} queued actions</span>
          <button class="end-turn-button" type="button" data-action="resolve-round" ${gameOver ? "disabled" : ""}>Resolve round</button>
          <button class="secondary-button" type="button" data-action="new-game">New fight</button>
        </div>
      </div>

      ${message ? `<div class="message-bar">${escapeHtml(message)}</div>` : ""}

      <div class="coop-playmat">
        ${renderMonsterPanel()}
        <section class="coop-player-grid">
          ${gameState.players.map(renderPlayerPanel).join("")}
        </section>
      </div>

      <section class="log-drawer">
        <h2>Battle log</h2>
        <ol>
          ${gameState.log.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}
        </ol>
      </section>
    </section>
  `;
}

function renderWinnerTitle() {
  if (gameState.winner === "players") {
    return "Victory";
  }

  return "The monster wins";
}

function renderMonsterPanel() {
  const monster = gameState.monster;
  const hpPercent = Math.max(0, Math.round((monster.hp / monster.maxHp) * 100));
  return `
    <section class="boss-panel">
      <div class="boss-core">
        <p class="eyebrow">Threat encounter</p>
        <h2>${monster.name}</h2>
        <div class="boss-hp">
          <strong>${monster.hp}/${monster.maxHp}</strong>
          <span><em style="width: ${hpPercent}%"></em></span>
        </div>
        <div class="boss-statuses">
          <span>Exposed +${monster.statuses.exposed}</span>
          <span>Weakened ${monster.statuses.weakened}</span>
        </div>
        ${renderEffectSprites({ type: "monster" })}
      </div>
      <div class="threat-board">
        <h3>Threat Tracker</h3>
        ${gameState.players.map((player) => renderThreatRow(player)).join("")}
      </div>
    </section>
  `;
}

function renderThreatRow(player) {
  const threat = gameState.monster.threat[player.id] ?? 0;
  const percent = Math.min(100, Math.round((threat / 20) * 100));
  return `
    <div class="threat-row class-${player.classId}">
      <span>${player.name}</span>
      <div><em style="width: ${percent}%"></em></div>
      <strong>${threat}/20</strong>
    </div>
  `;
}

function renderPlayerPanel(player) {
  const classDef = classDefinitions[player.classId];
  const championVisual = getChampionVisual(player.classId);
  const hpPercent = Math.max(0, Math.round((player.hp / player.maxHp) * 100));
  const remainingEnergy = getRemainingEnergy(player);

  return `
    <section class="coop-player-panel class-${player.classId}">
      <div class="coop-hero">
        <img src="${championVisual.portrait}" alt="" aria-hidden="true" />
        <div>
          <h2>${player.name}</h2>
          <span>${classDef.role}</span>
          <div class="player-hp">
            <strong>${player.hp}/${player.maxHp}</strong>
            <span><em style="width: ${hpPercent}%"></em></span>
          </div>
        </div>
        <div class="player-stats">
          <strong>${remainingEnergy}/${player.energy}</strong>
          <span>Energy</span>
          <strong>${player.block}</strong>
          <span>Block</span>
        </div>
        ${renderEffectSprites({ type: "player", playerId: player.id })}
      </div>

      <div class="planned-zone">
        <div class="zone-header">
          <strong>Queued Actions</strong>
          <span>${player.planned.length} cards</span>
        </div>
        <div class="planned-cards">
          ${player.planned.map((cardInstance) => renderQueuedCard(player, cardInstance)).join("")}
          ${player.planned.length === 0 ? `<span class="empty-plan">No actions queued.</span>` : ""}
        </div>
      </div>

      <div class="hand-zone coop-hand">
        ${player.hand.map((cardInstance) => renderHandCard(player, cardInstance)).join("")}
        ${player.hand.length === 0 ? `<div class="empty-hand">No cards in hand.</div>` : ""}
      </div>

      <div class="deck-strip">
        <span>Deck ${player.deck.length}</span>
        <span>Discard ${player.discard.length}</span>
      </div>
    </section>
  `;
}

function renderHandCard(player, cardInstance) {
  const card = getCardDefinition(cardInstance.cardId);
  const remainingEnergy = getRemainingEnergy(player);
  const cannotAfford = remainingEnergy < card.cost || player.hp <= 0 || gameState.phase === "game-over";
  return `
    <button
      class="coop-card role-${card.role} class-${card.classId} ${cannotAfford ? "unplayable" : "playable"}"
      type="button"
      data-action="queue-card"
      data-player-id="${player.id}"
      data-instance-id="${cardInstance.instanceId}"
      ${cannotAfford ? "disabled" : ""}
    >
      ${renderCardFace(card)}
    </button>
  `;
}

function renderQueuedCard(player, cardInstance) {
  const card = getCardDefinition(cardInstance.cardId);
  return `
    <button
      class="queued-card role-${card.role} class-${card.classId}"
      type="button"
      data-action="unqueue-card"
      data-player-id="${player.id}"
      data-instance-id="${cardInstance.instanceId}"
      ${gameState.phase === "game-over" ? "disabled" : ""}
    >
      <strong>${card.name}</strong>
      <span>${card.cost} energy</span>
    </button>
  `;
}

function renderCardFace(card) {
  return `
    <span class="card-cost">${card.cost}</span>
    <span class="card-name">${card.name}</span>
    <span class="card-role">${formatRole(card.role)}</span>
    <span class="card-text">${card.text}</span>
  `;
}

function formatRole(role) {
  return role === "defense" ? "defend" : role;
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
  const effectVisual = getEffectVisual(effect.type);
  return `
    <span class="effect-sprite effect-${effect.type} ${effectVisual ? "has-vfx" : ""}">
      ${effectVisual ? `<span class="effect-vfx" style="background-image: url('${effectVisual}')"></span>` : ""}
      <span class="effect-core"></span>
      <span class="effect-burst"></span>
      <span class="effect-label">${getEffectLabel(effect)}</span>
    </span>
  `;
}

function getEffectLabel(effect) {
  if (effect.amount && shouldShowEffectAmount(effect.type)) {
    return `${effect.label ?? getEffectName(effect.type)} ${effect.amount}`;
  }

  return effect.label ?? getEffectName(effect.type);
}

function getLatestEventId(state) {
  if (!state.events.length) {
    return 0;
  }

  return Math.max(...state.events.map((event) => event.id));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
