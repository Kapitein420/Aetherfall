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
import { initDragSystem, refreshDragSystem, teardownDragSystem } from "./ui/drag-system.js";

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
let dragInited = false;

// Optional multiplayer hookup. Module may not exist yet — load defensively.
let multiplayer = null;
let suppressBroadcast = false;
(async () => {
  try {
    multiplayer = await import("./multiplayer/sync.js");
    if (multiplayer && typeof multiplayer.onRemoteAction === "function") {
      multiplayer.onRemoteAction((action) => {
        if (!action || typeof action !== "object") {
          return;
        }
        suppressBroadcast = true;
        try {
          replayRemoteAction(action);
        } finally {
          suppressBroadcast = false;
        }
      });
    }
  } catch (error) {
    multiplayer = null;
  }
})();

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
    message = "Plan together. Drag a card onto a target, or click to queue. Then resolve the round.";
    broadcastFromAction("start-game", element.dataset);
    render();
    return;
  }

  if (action === "new-game") {
    gameState = null;
    message = "";
    activeEffects = [];
    lastSeenEventId = 0;
    broadcastFromAction("new-game", element.dataset);
    render();
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
    broadcastFromAction("queue-card", element.dataset);
    render();
    return;
  }

  if (action === "unqueue-card") {
    gameState = unqueueCard(gameState, {
      playerId: element.dataset.playerId,
      instanceId: element.dataset.instanceId,
    });
    message = "";
    broadcastFromAction("unqueue-card", element.dataset);
    render();
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
    broadcastFromAction("resolve-round", element.dataset);
    render();
  }
}

function broadcastFromAction(type, dataset) {
  if (suppressBroadcast || !multiplayer || typeof multiplayer.broadcastAction !== "function") {
    return;
  }
  if (typeof multiplayer.isMultiplayerActive === "function" && !multiplayer.isMultiplayerActive()) {
    return;
  }
  try {
    multiplayer.broadcastAction({ type, ...(dataset ?? {}) });
  } catch (error) {
    // never let multiplayer errors break local play
  }
}

function replayRemoteAction(action) {
  // Simulate the same handler path without re-broadcasting.
  if (action.type === "start-game") {
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
    render();
    return;
  }

  if (action.type === "new-game") {
    gameState = null;
    activeEffects = [];
    lastSeenEventId = 0;
    render();
    return;
  }

  if (!gameState) {
    return;
  }

  if (action.type === "queue-card") {
    gameState = queueCard(gameState, {
      playerId: action.playerId,
      instanceId: action.instanceId,
    });
    enqueueEffectsFromState(gameState);
    render();
    return;
  }

  if (action.type === "unqueue-card") {
    gameState = unqueueCard(gameState, {
      playerId: action.playerId,
      instanceId: action.instanceId,
    });
    render();
    return;
  }

  if (action.type === "resolve-round") {
    gameState = resolveRound(gameState);
    enqueueEffectsFromState(gameState);
    render();
  }
}

function render() {
  app.innerHTML = gameState ? renderGame() : renderSetup();

  if (gameState && gameState.phase !== "game-over") {
    if (!dragInited) {
      initDragSystem({
        getState: () => gameState,
        invokeAction: (data) => {
          // Mock element-like target for handleAction. dataset is enough for queue-card.
          handleAction({ dataset: { ...data } });
        },
      });
      dragInited = true;
    } else {
      refreshDragSystem();
    }
  } else if (dragInited) {
    teardownDragSystem();
    dragInited = false;
  }
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

// Feature flags for the staged UI overhaul. Phase 3 features are off in
// Phase 1's commit; the next commit flips MONSTER_INTENT_ENABLED on.
const MONSTER_INTENT_ENABLED = false;
const QUEUE_TETHERS_ENABLED = false;

function renderGame() {
  const totalQueued = gameState.players.reduce((total, player) => total + player.planned.length, 0);
  const gameOver = gameState.phase === "game-over";
  const intent = MONSTER_INTENT_ENABLED ? computeMonsterIntent(gameState) : null;

  return `
    <section class="game-table standoff-table">
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

      <div class="standoff-stage" data-stage>
        <svg class="standoff-tethers" data-tethers aria-hidden="true"></svg>

        <div class="standoff-monster" data-target-zone="monster" data-monster-id="${gameState.monster.id}">
          ${renderMonsterIntent(intent)}
          ${renderMonsterFigure(gameState.monster)}
          ${renderMonsterBaseplate(gameState.monster)}
        </div>

        <div class="standoff-flanks">
          ${renderChampion(gameState.players[0], "left", intent)}
          ${renderChampion(gameState.players[1], "right", intent)}
        </div>

        <div class="standoff-queue-strip" data-queue-strip>
          ${renderQueueStrip()}
        </div>

        <div class="standoff-play-zone" data-target-zone="play-zone">
          <span>Drop here for an untargeted play</span>
        </div>

        <div class="standoff-hand-shelf">
          ${gameState.players
            .map(
              (player, index) => `
                <div class="standoff-hand-cluster ${index === 0 ? "left" : "right"}">
                  <div class="standoff-hand-label">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>Energy ${getRemainingEnergy(player)}/${player.energy}</span>
                  </div>
                  <div class="standoff-hand coop-hand-arc" data-player-hand="${player.id}">
                    ${player.hand.length === 0
                      ? `<div class="empty-hand">No cards in hand.</div>`
                      : player.hand.map((cardInstance, cardIndex, arr) =>
                          renderHandCard(player, cardInstance, cardIndex, arr.length, index === 0 ? "left" : "right"),
                        ).join("")}
                  </div>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>

      <div class="standoff-drag-ghost" data-drag-ghost aria-hidden="true"></div>

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

function renderMonsterFigure(monster) {
  const hpFrac = Math.max(0, Math.min(1, monster.hp / monster.maxHp));
  const wounded = hpFrac < 0.5 ? "wounded" : "";
  const critical = hpFrac < 0.25 ? "critical" : "";
  return `
    <div class="monster-figure ${wounded} ${critical}" data-monster-art aria-hidden="true">
      <div class="monster-aura"></div>
      <div class="monster-silhouette">
        <div class="monster-region region-head" data-monster-region="head"></div>
        <div class="monster-region region-core" data-monster-region="core"></div>
        <div class="monster-region region-arm region-arm-left" data-monster-region="arm-left"></div>
        <div class="monster-region region-arm region-arm-right" data-monster-region="arm-right"></div>
        <div class="monster-eyes"></div>
      </div>
      <div class="monster-glow"></div>
      ${renderMonsterStatusPips(monster)}
      <div class="monster-effect-mount" data-effect-mount="${targetKey({ type: "monster" })}">
        ${renderEffectSprites({ type: "monster" })}
      </div>
    </div>
  `;
}

function renderMonsterStatusPips(monster) {
  const pips = [];
  if (monster.statuses.exposed > 0) {
    pips.push(`<span class="status-pip pip-exposed" title="Exposed +${monster.statuses.exposed}">E${monster.statuses.exposed}</span>`);
  }
  if (monster.statuses.weakened > 0) {
    pips.push(`<span class="status-pip pip-weakened" title="Weakened ${monster.statuses.weakened}">W${monster.statuses.weakened}</span>`);
  }
  if (!pips.length) {
    return "";
  }
  return `<div class="monster-pips">${pips.join("")}</div>`;
}

function renderMonsterBaseplate(monster) {
  const hpPercent = Math.max(0, Math.round((monster.hp / monster.maxHp) * 100));
  return `
    <div class="baseplate monster-baseplate">
      <div class="baseplate-name">
        <p class="eyebrow">Threat encounter</p>
        <h2>${escapeHtml(monster.name)}</h2>
      </div>
      <div class="baseplate-meter">
        <div class="meter-track meter-hp">
          <em style="width: ${hpPercent}%"></em>
        </div>
        <strong>${monster.hp} / ${monster.maxHp} HP</strong>
      </div>
      <div class="threat-pip-row">
        ${gameState.players
          .map((player) => {
            const threat = gameState.monster.threat[player.id] ?? 0;
            const percent = Math.min(100, Math.round((threat / 20) * 100));
            return `
              <div class="threat-pip class-${player.classId}">
                <span>${escapeHtml(player.name)}</span>
                <div class="meter-track meter-threat"><em style="width: ${percent}%"></em></div>
                <strong>${threat}/20</strong>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderMonsterIntent(intent) {
  if (!intent) {
    return "";
  }
  return `
    <div class="monster-intent" title="Next attack: ${intent.damage} damage to ${escapeHtml(intent.targetName)}">
      <span class="intent-icon" aria-hidden="true"></span>
      <strong>${intent.damage}</strong>
      <span class="intent-target">to ${escapeHtml(intent.targetName)}</span>
    </div>
  `;
}

function renderChampion(player, side, intent) {
  const classDef = classDefinitions[player.classId];
  const championVisual = getChampionVisual(player.classId);
  const hpPercent = Math.max(0, Math.round((player.hp / player.maxHp) * 100));
  const remainingEnergy = getRemainingEnergy(player);
  const isIntentTarget = intent && intent.targetId === player.id;
  const isDefeated = player.hp <= 0;

  return `
    <div class="standoff-champion class-${player.classId} side-${side} ${isDefeated ? "defeated" : ""} ${isIntentTarget ? "intent-target" : ""}"
         data-target-zone="player"
         data-player-id="${player.id}">
      ${isIntentTarget ? `<div class="intent-marker" aria-hidden="true">!</div>` : ""}
      <div class="champion-art">
        <div class="champion-glow"></div>
        <img src="${championVisual.portrait}" alt="${escapeHtml(player.name)}" class="champion-portrait" />
        ${renderChampionStatusPips(player)}
        <div class="champion-effect-mount" data-effect-mount="${targetKey({ type: "player", playerId: player.id })}">
          ${renderEffectSprites({ type: "player", playerId: player.id })}
        </div>
      </div>
      <div class="baseplate champion-baseplate">
        <div class="baseplate-row">
          <h3>${escapeHtml(player.name)}</h3>
          <span>${escapeHtml(classDef.role)}</span>
        </div>
        <div class="baseplate-meter">
          <div class="meter-track meter-hp">
            <em style="width: ${hpPercent}%"></em>
          </div>
          <strong>${player.hp} / ${player.maxHp}</strong>
        </div>
        <div class="baseplate-stats">
          <span class="stat-chip stat-energy">
            <em>${remainingEnergy}</em><span>/${player.energy} Energy</span>
          </span>
          <span class="stat-chip stat-block">
            <em>${player.block}</em><span>Block</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderChampionStatusPips(player) {
  const pips = [];
  if (player.block > 0) {
    pips.push(`<span class="status-pip pip-block" title="Block ${player.block}">${player.block}</span>`);
  }
  const threat = gameState.monster.threat[player.id] ?? 0;
  if (threat > 0) {
    pips.push(`<span class="status-pip pip-threat" title="Threat ${threat}">T${threat}</span>`);
  }
  if (!pips.length) {
    return "";
  }
  return `<div class="champion-pips">${pips.join("")}</div>`;
}

function renderQueueStrip() {
  const items = [];
  for (const player of gameState.players) {
    for (const cardInstance of player.planned) {
      const card = getCardDefinition(cardInstance.cardId);
      const target = inferQueuedTarget(player, card);
      const cls = `class-${player.classId} role-${card.role}`;
      items.push(`
        <button
          class="queued-mini ${cls}"
          type="button"
          data-action="unqueue-card"
          data-player-id="${player.id}"
          data-instance-id="${cardInstance.instanceId}"
          data-target-key="${target.key}"
          title="Click to unqueue ${escapeHtml(card.name)} (${escapeHtml(target.label)})"
        >
          <strong>${escapeHtml(card.name)}</strong>
          <span class="queued-cost">${card.cost}</span>
          <span class="queued-target">${escapeHtml(target.label)}</span>
        </button>
      `);
    }
  }

  if (!items.length) {
    return `<div class="queue-strip-empty">No actions queued yet. Drag a card onto a target.</div>`;
  }

  return `<div class="queue-strip-items">${items.join("")}</div>`;
}

function inferQueuedTarget(player, card) {
  // Mirror the implicit target rules from the engine (best-effort visual hint).
  if (card.role === "attack") {
    return { key: targetKey({ type: "monster" }), label: gameState.monster.name };
  }
  // For heals, find an ally if it heals an ally — but most healing is on lowest/all/self.
  // Use the first action with a target hint.
  for (const action of card.actions ?? []) {
    if (action.target === "ally") {
      const ally = gameState.players.find((p) => p.id !== player.id);
      if (ally) {
        return { key: targetKey({ type: "player", playerId: ally.id }), label: ally.name };
      }
    }
    if (action.target === "all") {
      return { key: targetKey({ type: "player", playerId: player.id }), label: "Both heroes" };
    }
    if (action.target === "lowest") {
      const target = [...gameState.players]
        .filter((c) => c.hp > 0)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (target) {
        return { key: targetKey({ type: "player", playerId: target.id }), label: target.name };
      }
    }
  }
  return { key: targetKey({ type: "player", playerId: player.id }), label: player.name };
}

function computeMonsterIntent(state) {
  const livingPlayers = state.players.filter((p) => p.hp > 0);
  if (!livingPlayers.length || state.phase === "game-over") {
    return null;
  }
  const target = [...livingPlayers].sort((a, b) => {
    const threatDiff = (state.monster.threat[b.id] ?? 0) - (state.monster.threat[a.id] ?? 0);
    if (threatDiff !== 0) {
      return threatDiff;
    }
    return a.hp - b.hp;
  })[0];
  // baseAttack scales by floor(roundNumber / 2) per engine.
  const damage = Math.max(1, state.monster.baseAttack + Math.floor(state.roundNumber / 2));
  return {
    targetId: target.id,
    targetName: target.name,
    damage,
  };
}

function renderHandCard(player, cardInstance, cardIndex, totalCards, side) {
  const card = getCardDefinition(cardInstance.cardId);
  const remainingEnergy = getRemainingEnergy(player);
  const cannotAfford = remainingEnergy < card.cost || player.hp <= 0 || gameState.phase === "game-over";
  // Spread cards in a soft fan. Mirror angles for the right side so cards face inward.
  const fanCount = Math.max(1, totalCards);
  const center = (fanCount - 1) / 2;
  const offset = cardIndex - center;
  const baseRot = offset * 5; // degrees
  const baseLift = -Math.abs(offset) * 6;
  const rotation = side === "right" ? -baseRot : baseRot;
  const lift = baseLift;
  const styleVars = `--card-rotation: ${rotation}deg; --card-lift: ${lift}px;`;
  return `
    <button
      class="hand-card class-${player.classId} role-${card.role} ${cannotAfford ? "unplayable" : "playable"}"
      type="button"
      data-action="queue-card"
      data-player-id="${player.id}"
      data-instance-id="${cardInstance.instanceId}"
      data-card-id="${card.id}"
      data-card-role="${card.role}"
      data-card-cost="${card.cost}"
      data-card-name="${escapeHtml(card.name)}"
      style="${styleVars}"
      ${cannotAfford ? "disabled" : ""}
    >
      ${renderCardFace(card)}
    </button>
  `;
}

function renderCardFace(card) {
  return `
    <span class="card-cost">${card.cost}</span>
    <span class="card-name">${escapeHtml(card.name)}</span>
    <span class="card-role">${formatRole(card.role)}</span>
    <span class="card-text">${escapeHtml(card.text)}</span>
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
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
