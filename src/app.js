import { classDefinitions, selectableClasses } from "./content/classes.js";
import { getCardDefinition } from "./content/cards.js";
import { getChampionVisual, getEffectVisual, getMonsterVisual } from "./content/game-assets.js";
import { listMonsters, listEncounters, getEncounter, DEFAULT_MONSTER_ID } from "./content/monsters.js";
import { assetUrl } from "./content/asset-paths.js";
import { getPartyDeckCard, PARTY_DECK_INTERACTIONS } from "./content/party-deck.js";
import { getElementIcon } from "./content/element-icons.js";
import { getEffectDuration, getEffectName, shouldShowEffectAmount } from "./effects/effect-library.js";
import {
  createCoopBattle,
  discardPartyCard,
  duplicatePartyCard,
  getRemainingEnergy,
  peekNextPartyCard,
  playPartyCard,
  queueCard,
  resolveRound,
  targetKey,
  unqueueCard,
} from "./engine/game.js";
import { initDragSystem, refreshDragSystem, teardownDragSystem } from "./ui/drag-system.js";
import {
  broadcastLocalAction,
  installMultiplayerHooks,
  pushSnapshotIfHost,
} from "./multiplayer/app-hooks.js";

const app = document.querySelector("#app");

// Feature flags must live ABOVE the initial render() call below — they are
// referenced from inside renderGame() and render(), and a `const` in TDZ
// would throw a ReferenceError during module load and silently kill all
// later listeners (including the click handler that drives every action).
const MONSTER_INTENT_ENABLED = true;
const QUEUE_TETHERS_ENABLED = true;
// Drag-and-drop targeting is intentionally disabled for now to keep the
// playfield uncluttered: hides the play-zone "middle layer" strip + the
// drag-arrow SVG overlay + the floating drag ghost. Click-to-queue still
// works for all cards. The drag-system.js code is untouched — flip this
// flag to true to re-enable everything without further changes.
const DRAG_AND_DROP_ENABLED = false;

// Up to 4 players. The first `playerCount` slots in `playerClasses` are
// active; the rest are kept as defaults so the picker can grow without
// dropping previous selections.
const MAX_PLAYERS = 4;
let setup = {
  playerCount: 2,
  playerClasses: ["storm-forge", "hydroflow", "storm-forge", "hydroflow"],
  monsterId: "bruiser-duo",
};

let gameState = null;
let message = "";
let lastSeenEventId = 0;
let activeEffects = [];
let effectInstanceId = 1;
let dragInited = false;
// Two-click target picker for multi-monster encounters: when the player
// clicks an attack card with multiple living monsters available, we stash
// the card here and wait for a target click. Cleared when targeting
// completes, the card is unqueued, or the round resolves. Per-client UI
// state only — not part of game state.
let armedCard = null; // { playerId, instanceId, cardId } | null
// Local UI: which player's hand is focused. null = show everyone. Click a
// hand label to focus that player; click again to clear. Per-client only —
// not part of game state, so multiplayer peers each pick their own focus.
let focusedPlayerId = null;

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

// Redraw queue tethers on viewport changes so lines stay aligned.
window.addEventListener("resize", () => {
  if (gameState && QUEUE_TETHERS_ENABLED) {
    drawQueueTethers();
  }
});

function notifyMultiplayer(action) {
  broadcastLocalAction(action);
  pushSnapshotIfHost(gameState);
}

app.addEventListener("change", (event) => {
  const field = event.target.dataset.setupField;
  if (!field) {
    return;
  }

  // `playerClass-<index>` slots write into the `playerClasses` array. All
  // other fields are scalar properties on `setup`.
  if (field.startsWith("playerClass-")) {
    const index = Number.parseInt(field.slice("playerClass-".length), 10);
    if (Number.isInteger(index) && index >= 0 && index < MAX_PLAYERS) {
      const next = setup.playerClasses.slice();
      next[index] = event.target.value;
      setup = { ...setup, playerClasses: next };
      render();
    }
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

  if (action === "set-player-count") {
    const next = Number.parseInt(element.dataset.playerCount, 10);
    if (Number.isInteger(next) && next >= 1 && next <= MAX_PLAYERS) {
      setup = { ...setup, playerCount: next };
      render();
    }
    return;
  }

  if (action === "start-game") {
    // Canonical: setup → battle directly. Party Deck draws auto-fire each
    // round inside the engine; no pre-fight pick.
    const activeClasses = setup.playerClasses.slice(0, setup.playerCount);
    // Encounter resolution: setup.monsterId may now name a multi-monster
    // encounter (Bruiser Duo / Synthetic Hunter Squad). Resolve through
    // the encounter registry to a monsterIds array; fall back to the
    // single monsterId path if the entry is unknown (legacy compat).
    const encounter = getEncounter(setup.monsterId);
    const battleConfig = {
      players: activeClasses.map((classId, index) => ({
        id: `player-${index + 1}`,
        name: classDefinitions[classId].shortName,
        classId,
      })),
    };
    if (encounter && encounter.monsterIds.length > 1) {
      battleConfig.monsterIds = encounter.monsterIds;
    } else if (encounter) {
      battleConfig.monsterId = encounter.monsterIds[0];
    } else {
      battleConfig.monsterId = setup.monsterId;
    }
    gameState = createCoopBattle(battleConfig);
    lastSeenEventId = getLatestEventId(gameState);
    activeEffects = [];
    message = DRAG_AND_DROP_ENABLED
      ? "Plan together. Drag a card onto a target, or click to queue. Then resolve the round."
      : "Plan together. Click any card to queue it. Then resolve the round.";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "focus-player-hand") {
    const id = element.dataset.playerId;
    focusedPlayerId = focusedPlayerId === id ? null : id;
    render();
    return;
  }

  if (action === "clear-hand-focus") {
    focusedPlayerId = null;
    render();
    return;
  }

  if (action === "play-party-card") {
    gameState = playPartyCard(gameState, {
      playerId: element.dataset.playerId,
      partyInstanceId: element.dataset.partyInstanceId,
    });
    enqueueEffectsFromState(gameState);
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "peek-party-deck") {
    gameState = peekNextPartyCard(gameState, {
      playerId: element.dataset.playerId,
    });
    enqueueEffectsFromState(gameState);
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "dismiss-party-peek") {
    if (gameState) {
      gameState = { ...gameState, partyPeek: null };
      render();
      notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    }
    return;
  }

  if (action === "discard-party-card") {
    gameState = discardPartyCard(gameState, {
      playerId: element.dataset.playerId,
      partyInstanceId: element.dataset.partyInstanceId,
    });
    enqueueEffectsFromState(gameState);
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "duplicate-party-card") {
    gameState = duplicatePartyCard(gameState, {
      playerId: element.dataset.playerId,
      partyInstanceId: element.dataset.partyInstanceId,
    });
    enqueueEffectsFromState(gameState);
    message = "";
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "infuse-party-card") {
    // Infusion mechanic isn't built yet — surface a friendly hint and exit.
    message = "Infusion is coming soon.";
    render();
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
    const playerId = element.dataset.playerId;
    const instanceId = element.dataset.instanceId;
    const cardId = element.dataset.cardId;
    // Two-click flow for multi-monster encounters: if the card has any
    // damage action and there are 2+ living monsters, arm the card on
    // first click and wait for a monster click to confirm the target.
    // Single-monster fights and non-attack cards skip the picker.
    if (cardNeedsTarget(cardId)) {
      // Toggle off if already armed for this same instance.
      if (armedCard && armedCard.instanceId === instanceId) {
        armedCard = null;
        message = "";
      } else {
        armedCard = { playerId, instanceId, cardId };
        message = "Pick a target monster.";
      }
      render();
      return;
    }
    gameState = queueCard(gameState, { playerId, instanceId });
    enqueueEffectsFromState(gameState);
    message = "";
    armedCard = null;
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "target-monster") {
    if (!armedCard) return;
    const targetMonsterId = element.dataset.monsterIdKey;
    gameState = queueCard(gameState, {
      playerId: armedCard.playerId,
      instanceId: armedCard.instanceId,
      targetMonsterId,
    });
    enqueueEffectsFromState(gameState);
    notifyMultiplayer({
      type: "queue-card",
      dataset: {
        playerId: armedCard.playerId,
        instanceId: armedCard.instanceId,
        cardId: armedCard.cardId,
        targetMonsterId,
      },
    });
    armedCard = null;
    message = "";
    render();
    return;
  }

  if (action === "unqueue-card") {
    gameState = unqueueCard(gameState, {
      playerId: element.dataset.playerId,
      instanceId: element.dataset.instanceId,
    });
    message = "";
    armedCard = null;
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
    return;
  }

  if (action === "resolve-round") {
    armedCard = null;
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
  let html;
  if (gameState) {
    html = renderGame();
  } else {
    html = renderSetup();
  }
  app.innerHTML = html;
  document.body.dataset.gameView = gameState ? "active" : "";

  if (DRAG_AND_DROP_ENABLED && gameState && gameState.phase !== "game-over") {
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

  if (gameState && QUEUE_TETHERS_ENABLED) {
    // Defer one frame so the new DOM has its layout boxes.
    window.requestAnimationFrame(() => drawQueueTethers());
  }
}

function drawQueueTethers() {
  const stage = document.querySelector("[data-stage]");
  const svg = document.querySelector("[data-tethers]");
  if (!stage || !svg) {
    return;
  }
  // Remove old tether paths (but leave any active drag-arrow).
  for (const old of svg.querySelectorAll("path.tether-line")) {
    old.remove();
  }

  const stageRect = stage.getBoundingClientRect();
  const queuedItems = document.querySelectorAll('[data-action="unqueue-card"][data-target-key]');
  for (const item of queuedItems) {
    const targetKeyValue = item.dataset.targetKey;
    if (!targetKeyValue) {
      continue;
    }
    const targetEl = findTargetElement(targetKeyValue);
    if (!targetEl) {
      continue;
    }

    const itemRect = item.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const ox = itemRect.left + itemRect.width / 2 - stageRect.left;
    const oy = itemRect.top - stageRect.top;
    const tx = targetRect.left + targetRect.width / 2 - stageRect.left;
    const ty = targetRect.top + targetRect.height * 0.6 - stageRect.top;

    const midY = Math.min(oy, ty) - 80;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("tether-line");
    const role = (item.className.match(/role-(\w+)/) || [])[1];
    if (role) {
      path.classList.add(`role-${role}`);
    }
    path.setAttribute(
      "d",
      `M ${ox} ${oy} C ${ox} ${midY}, ${tx} ${midY}, ${tx} ${ty}`,
    );
    svg.appendChild(path);
  }
}

function findTargetElement(targetKeyValue) {
  if (targetKeyValue === "monster") {
    return document.querySelector('[data-target-zone="monster"]');
  }
  if (targetKeyValue.startsWith("player:")) {
    const id = targetKeyValue.slice("player:".length);
    return document.querySelector(`[data-target-zone="player"][data-player-id="${id}"]`);
  }
  return null;
}

function renderSetup() {
  const playerCount = setup.playerCount;
  const heroPill = `${playerCount} vs 1`;
  const tagline = playerCount === 1
    ? "One champion. One monster. One plan."
    : `${playerCount} champions. One monster. One plan.`;
  const panels = [];
  for (let i = 0; i < playerCount; i += 1) {
    panels.push(renderSetupPlayer(`Player ${i + 1}`, i));
  }
  return `
    <section class="setup-shell setup-shell-v2">
      <header class="setup-hero">
        <div class="setup-hero-text">
          <p class="eyebrow">The Fracture of Aetherfall</p>
          <h1>Co-op Boss Trial</h1>
          <p class="setup-tagline">${escapeHtml(tagline)}</p>
        </div>
        <div class="setup-hero-meta">
          <span class="hero-pill">${escapeHtml(heroPill)}</span>
          <span class="hero-pill subtle">Drag · Plan · Resolve</span>
        </div>
      </header>

      ${renderEncounterPicker()}

      <div class="setup-grid setup-grid-v2 player-count-${playerCount}">
        ${panels.join("")}
      </div>

      <div class="rules-strip rules-strip-setup">
        <span><strong>15-card</strong> deck</span>
        <span class="rules-sep">·</span>
        <span><strong>Draw 5</strong> each round</span>
        <span class="rules-sep">·</span>
        <span><strong>Start 3 energy</strong>, +1/round (cap 10)</span>
        <span class="rules-sep">·</span>
        <span><strong>Plan together</strong>, monster targets highest threat</span>
      </div>

      <div class="action-row setup-cta-row">
        <button class="primary-button setup-cta" type="button" data-action="start-game">Start boss fight</button>
      </div>
    </section>
  `;
}

function renderEncounterPicker() {
  // Pull from the encounter registry so multi-monster scenarios show up
  // alongside single-monster boss fights. The Bruiser Duo and Synthetic
  // Hunter Squad sit at the top of the registry and therefore the
  // dropdown — they're the headlining encounters per the design PDF.
  const monsters = listEncounters();
  const selected = monsters.find((m) => m.id === setup.monsterId) ?? monsters[0];
  const countOptions = [2, 3, 4]
    .map(
      (count) => `
        <button
          type="button"
          class="player-count-pill ${setup.playerCount === count ? "is-active" : ""}"
          data-action="set-player-count"
          data-player-count="${count}"
          aria-pressed="${setup.playerCount === count ? "true" : "false"}"
        >${count}</button>
      `,
    )
    .join("");
  // When the selected encounter has a hero banner, surface it as the
  // visual anchor of the row. The summary text moves under the banner so
  // the "what am I fighting" panel reads top-to-bottom: banner → name →
  // role → summary → controls. Encounters without a banner fall through
  // to the legacy compact row.
  const bannerHtml = selected.banner
    ? `<div class="setup-encounter-banner-wrap">
         <img src="${assetUrl(selected.banner)}" alt="${escapeHtml(selected.name)}" class="setup-encounter-banner" />
       </div>`
    : "";
  const summaryHtml = selected.summary
    ? `<p class="setup-encounter-summary">${escapeHtml(selected.summary)}</p>`
    : "";
  const rowClass = selected.banner ? "setup-encounter-row has-banner" : "setup-encounter-row";
  return `
    <div class="${rowClass}">
      ${bannerHtml}
      <div class="setup-encounter-info">
        <p class="eyebrow">Encounter</p>
        <h2>${escapeHtml(selected.name)}</h2>
        <p class="setup-encounter-role">${escapeHtml(selected.role)} · ${escapeHtml(selected.faction)}</p>
        ${summaryHtml}
      </div>
      <div class="setup-encounter-controls">
        <div class="setup-player-count" role="group" aria-label="Number of players">
          <span class="setup-deck-label">Players</span>
          <div class="player-count-segment">
            ${countOptions}
          </div>
        </div>
        <label class="setup-encounter-selector">
          <span class="setup-deck-label">Choose monster</span>
          <select data-setup-field="monsterId">
            ${monsters
              .map(
                (entry) => `
                  <option value="${entry.id}" ${setup.monsterId === entry.id ? "selected" : ""}>
                    ${entry.name} — ${entry.role}
                  </option>
                `,
              )
              .join("")}
          </select>
        </label>
      </div>
    </div>
  `;
}

function renderSetupPlayer(label, slotIndex) {
  const classId = setup.playerClasses[slotIndex] ?? selectableClasses[0].id;
  const selectedClass = classDefinitions[classId] ?? selectableClasses[0];
  const championVisual = getChampionVisual(selectedClass.id);
  const factionLabel = selectedClass.faction ?? "Free Champion";
  const fieldName = `playerClass-${slotIndex}`;
  const aspectChips = (selectedClass.aspect ?? "")
    .split(/\s*\/\s*/)
    .filter(Boolean)
    .map((chip) => `<span class="aspect-chip">${escapeHtml(chip)}</span>`)
    .join("");
  return `
    <section class="setup-panel setup-panel-v2 class-${selectedClass.id}">
      <div class="setup-panel-header">
        <span class="setup-player-tag">${escapeHtml(label)}</span>
        <span class="setup-faction-tag">${escapeHtml(factionLabel)}</span>
      </div>
      <div class="setup-panel-body">
        <div class="setup-portrait-wrap">
          <img class="setup-champion-portrait" src="${championVisual.portrait}" alt="${escapeHtml(selectedClass.shortName)}" />
        </div>
        <div class="setup-character-info">
          <h2 class="setup-class-name">${escapeHtml(selectedClass.shortName)}</h2>
          <p class="setup-class-role">${escapeHtml(selectedClass.role)}</p>
          <div class="aspect-chips">${aspectChips}</div>
          <p class="setup-class-summary">${escapeHtml(selectedClass.summary)}</p>
          <p class="setup-class-personality">${escapeHtml(selectedClass.personality)}</p>
        </div>
      </div>
      <label class="setup-deck-selector">
        <span class="setup-deck-label">Character deck</span>
        <select data-setup-field="${fieldName}">
          ${selectableClasses
            .map(
              (classDef) => `
                <option value="${classDef.id}" ${classId === classDef.id ? "selected" : ""}>
                  ${classDef.shortName} — ${classDef.role}
                </option>
              `,
            )
            .join("")}
        </select>
      </label>
    </section>
  `;
}

function renderPartyZone(state) {
  const hand = state.partyHand ?? [];
  const auras = state.activeAuras ?? [];
  if (hand.length === 0 && auras.length === 0) return "";
  const players = state.players ?? [];
  // Default actor for interactions: the living player with the most
  // remaining energy. Players can still tap a different player's "play"
  // button; the global interactions strip just picks a sensible payer
  // automatically. Falls back to the first living player if none can afford.
  const actorForInteractions = pickInteractionActor(state);
  const canAffordInteraction =
    !!actorForInteractions && getRemainingEnergy(actorForInteractions) >= 1;

  const cards = hand
    .map((entry) => {
      const card = getPartyDeckCard(entry.cardId);
      if (!card) return "";
      const playerOptions = players
        .filter((p) => p.hp > 0 && getRemainingEnergy(p) >= card.cost)
        .map(
          (p) => `
            <button
              type="button"
              class="party-card-play class-${p.classId}"
              data-action="play-party-card"
              data-player-id="${p.id}"
              data-party-instance-id="${entry.partyInstanceId}"
              title="${escapeHtml(p.name)} plays ${escapeHtml(card.name)}"
            >
              ${escapeHtml(p.name)}
            </button>`,
        )
        .join("");
      return `
        <article class="party-card category-${card.category}">
          <header class="party-card-head">
            <span class="party-card-cost">${card.cost}</span>
            <span class="party-card-cat">${card.category}</span>
          </header>
          <h4 class="party-card-name">${escapeHtml(card.name)}</h4>
          <p class="party-card-desc">${escapeHtml(card.description)}</p>
          <footer class="party-card-actions">
            ${playerOptions || "<span class=\"party-card-noplay\">No one can afford</span>"}
          </footer>
          ${renderPartyCardInteractions(entry, card, actorForInteractions, canAffordInteraction)}
        </article>
      `;
    })
    .join("");
  const aurasMarkup = auras.length
    ? `<div class="party-auras">
        <span class="party-auras-label">Auras:</span>
        ${auras.map((a) => `<span class="party-aura-chip" title="${escapeHtml(a.description)}">${escapeHtml(a.name)}</span>`).join("")}
      </div>`
    : "";
  const peekMarkup = renderPartyPeekChip(state.partyPeek);
  const interactionStrip = renderGlobalInteractionStrip(actorForInteractions, canAffordInteraction);
  // Compact pill at the very top, hover/focus expands the detail panel.
  return `
    <aside class="party-zone" aria-label="Party Deck">
      <button type="button" class="party-zone-pill" tabindex="0">
        <span class="party-zone-eyebrow">Party</span>
        <span class="party-zone-count">${hand.length}</span>
        ${auras.length ? `<span class="party-zone-aura-mark" title="${auras.length} aura${auras.length === 1 ? "" : "s"} active">◎ ${auras.length}</span>` : ""}
        <span class="party-zone-chevron" aria-hidden="true">▾</span>
      </button>
      <div class="party-zone-detail">
        ${peekMarkup}
        ${interactionStrip}
        ${aurasMarkup}
        <div class="party-card-row">${cards}</div>
      </div>
    </aside>
  `;
}

// Pick the player who should pay for a Party Deck interaction by default.
// Strategy: the living player with the most remaining energy (≥1). Returns
// null if no one is alive or no one can afford it (the strip will render
// disabled in that case).
function pickInteractionActor(state) {
  const living = (state.players ?? []).filter((p) => p.hp > 0);
  if (!living.length) return null;
  const sorted = [...living].sort(
    (a, b) => getRemainingEnergy(b) - getRemainingEnergy(a),
  );
  return sorted[0] ?? null;
}

function renderPartyPeekChip(peek) {
  if (!peek) return "";
  const card = getPartyDeckCard(peek.cardId);
  if (!card) return "";
  return `
    <div class="party-peek-chip" role="status" aria-live="polite">
      <span class="party-peek-eyebrow">Next</span>
      <strong class="party-peek-name">${escapeHtml(card.name)}</strong>
      <span class="party-peek-cat">${escapeHtml(card.category)}</span>
      <button
        type="button"
        class="party-peek-dismiss"
        data-action="dismiss-party-peek"
        title="Dismiss"
        aria-label="Dismiss peek"
      >×</button>
    </div>
  `;
}

function renderGlobalInteractionStrip(actor, canAfford) {
  // The Peek/Infuse pair sits above the card row. Discard/Duplicate are
  // rendered per-card below. Driven by PARTY_DECK_INTERACTIONS so future
  // additions (Burn, Reshuffle, …) only need a content change + handler.
  const peek = PARTY_DECK_INTERACTIONS.find((i) => i.id === "peek-ahead");
  const infuse = PARTY_DECK_INTERACTIONS.find((i) => i.id === "infuse");
  const peekDisabled = !actor || !canAfford;
  const peekTitle = peekDisabled
    ? "Need 1 energy to peek"
    : `${actor.name} pays 1 energy to peek the next Party Card`;
  return `
    <div class="party-interactions" role="group" aria-label="Party Deck interactions">
      <button
        type="button"
        class="party-interaction party-interaction-peek"
        data-action="peek-party-deck"
        ${actor ? `data-player-id="${actor.id}"` : ""}
        ${peekDisabled ? "disabled" : ""}
        title="${escapeHtml(peekTitle)}"
      >
        <span class="party-interaction-name">${escapeHtml(peek?.name ?? "Peek Ahead")}</span>
        <span class="party-interaction-cost">1⚡</span>
      </button>
      <button
        type="button"
        class="party-interaction party-interaction-infuse"
        data-action="infuse-party-card"
        disabled
        title="Infusion coming soon"
      >
        <span class="party-interaction-name">${escapeHtml(infuse?.name ?? "Infuse")}</span>
        <span class="party-interaction-cost">soon</span>
      </button>
    </div>
  `;
}

function renderPartyCardInteractions(entry, card, actor, canAfford) {
  // Per-card Discard / Duplicate buttons. Tucked under the play row so the
  // primary "play" affordance stays the loudest. Both are gated on the
  // actor having ≥1 energy spare; without an actor the strip just renders
  // disabled.
  const disabled = !actor || !canAfford;
  const title = disabled
    ? "Need 1 energy"
    : `${actor.name} pays 1 energy`;
  return `
    <div class="party-card-interactions" role="group" aria-label="Card interactions">
      <button
        type="button"
        class="party-card-interaction interaction-discard"
        data-action="discard-party-card"
        ${actor ? `data-player-id="${actor.id}"` : ""}
        data-party-instance-id="${entry.partyInstanceId}"
        ${disabled ? "disabled" : ""}
        title="${escapeHtml(`${title} — discard "${card.name}" and draw a new card`)}"
      >Discard</button>
      <button
        type="button"
        class="party-card-interaction interaction-duplicate"
        data-action="duplicate-party-card"
        ${actor ? `data-player-id="${actor.id}"` : ""}
        data-party-instance-id="${entry.partyInstanceId}"
        ${disabled ? "disabled" : ""}
        title="${escapeHtml(`${title} — duplicate "${card.name}" effect (card stays in deck)`)}"
      >Duplicate</button>
      <button
        type="button"
        class="party-card-interaction interaction-infuse"
        data-action="infuse-party-card"
        data-party-instance-id="${entry.partyInstanceId}"
        disabled
        title="Infusion coming soon"
      >Infuse</button>
    </div>
  `;
}

// Feature flags for the staged UI overhaul. Phase 3 turns on the monster
// intent telegraph and the queued-card tether lines.
function renderGame() {
  const totalQueued = gameState.players.reduce((total, player) => total + player.planned.length, 0);
  const gameOver = gameState.phase === "game-over";
  const intent = MONSTER_INTENT_ENABLED ? computeMonsterIntent(gameState) : null;

  return `
    <section class="game-table standoff-table compact-ui ${DRAG_AND_DROP_ENABLED ? "" : "drag-disabled"}">
      ${renderLogCorner(gameState)}

      <div class="message-bar ${message ? "" : "is-empty"}">${message ? escapeHtml(message) : "&nbsp;"}</div>

      <div class="standoff-stage" data-stage>
        <svg class="standoff-tethers" data-tethers aria-hidden="true"></svg>

        <div class="standoff-monster ${(gameState.monsters?.length ?? 1) > 1 ? "multi" : ""} ${armedCard ? "armed" : ""}" data-target-zone="monster" data-monster-id="${gameState.monster.id}">
          ${renderEncounterBanner()}
          ${renderMonsterIntent(intent)}
          ${renderPrimaryTargetWrapper(gameState.monster, intent)}
          ${renderSquadmates(gameState)}
        </div>

        <div class="standoff-flanks players-${gameState.players.length}">
          ${gameState.players
            .map((player, index) =>
              renderChampion(player, championSideForIndex(index, gameState.players.length), intent),
            )
            .join("")}
        </div>

        <div class="standoff-queue-strip" data-queue-strip>
          ${renderQueueStrip()}
        </div>
      </div>

      ${renderPartyZone(gameState)}

      <div class="standoff-bottom">
        <div class="standoff-play-zone" data-target-zone="play-zone">
          <span>Drop here for an untargeted play</span>
        </div>

        <div class="standoff-hand-shelf players-${gameState.players.length} ${focusedPlayerId ? "has-focus" : ""}">
          ${focusedPlayerId ? `<button type="button" class="hand-focus-clear" data-action="clear-hand-focus" title="Show all hands">All hands</button>` : ""}
          ${gameState.players
            .map((player, index) => {
              const side = championSideForIndex(index, gameState.players.length);
              const isFocused = focusedPlayerId === player.id;
              const isCollapsed = focusedPlayerId && !isFocused;
              return `
                <div class="standoff-hand-cluster ${side} ${isFocused ? "is-focused" : ""} ${isCollapsed ? "is-collapsed" : ""}">
                  <button type="button" class="standoff-hand-label" data-action="focus-player-hand" data-player-id="${player.id}" title="${isFocused ? "Click to show all hands" : `Focus ${escapeHtml(player.name)}'s hand`}">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>Energy ${getRemainingEnergy(player)}/${player.energy}</span>
                  </button>
                  <div class="standoff-hand coop-hand-arc" data-player-hand="${player.id}">
                    ${player.hand.length === 0
                      ? `<div class="empty-hand">No cards in hand.</div>`
                      : player.hand.map((cardInstance, cardIndex, arr) =>
                          renderHandCard(player, cardInstance, cardIndex, arr.length, side),
                        ).join("")}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>

      ${renderActionBar(gameState, totalQueued, gameOver)}

      <div class="standoff-drag-ghost" data-drag-ghost aria-hidden="true"></div>
    </section>
  `;
}

function renderActionBar(state, totalQueued, gameOver) {
  const threatSummary = state.players
    .map((p) => `<span class="ab-threat-pip class-${p.classId}">${escapeHtml(p.name)} <strong>${state.monster.threat[p.id] ?? 0}</strong></span>`)
    .join("");
  const energyMax = state.players[0]?.energyMax ?? 0;
  const title = gameOver ? renderWinnerTitle() : `Round ${state.roundNumber}`;
  const auraCount = (state.activeAuras ?? []).length;
  return `
    <div class="action-bar" role="toolbar" aria-label="Round controls">
      <div class="ab-section ab-status">
        <span class="ab-round">${escapeHtml(title)}</span>
        <span class="ab-energy" title="Energy cap">⚡ ${energyMax}</span>
        <span class="ab-threat" title="Threat per champion">${threatSummary}</span>
      </div>
      ${auraCount > 0 ? `
      <div class="ab-section ab-blessing" title="${auraCount} aura${auraCount === 1 ? "" : "s"} in play">
        <span class="ab-blessing-label">Auras</span>
        <strong class="ab-blessing-name">${auraCount}</strong>
      </div>` : ""}
      <div class="ab-section ab-controls">
        <span class="ab-queued">${totalQueued} queued</span>
        <button class="ab-resolve" type="button" data-action="resolve-round" ${gameOver ? "disabled" : ""}>${gameOver ? "Round closed" : "Resolve round"}</button>
        <span class="ab-utility ${gameOver ? "is-pinned" : ""}">
          <button class="ab-secondary" type="button" data-action="new-game">New fight</button>
        </span>
      </div>
    </div>
  `;
}

function renderLogCorner(state) {
  const recent = state.log.slice(0, 12);
  if (recent.length === 0) return "";
  const items = recent.map(renderLogEntry).join("");
  return `
    <aside class="log-corner" aria-label="Battle log">
      <header class="log-corner-header">
        <span class="log-corner-eyebrow">Log</span>
        <span class="log-corner-hint">latest first</span>
      </header>
      <ol class="log-corner-list">${items}</ol>
    </aside>
  `;
}

function renderWinnerTitle() {
  if (gameState.winner === "players") {
    return "Victory";
  }

  return "The monster wins";
}

// Render the primary monster figure + baseplate. When the target picker
// is armed, the figure itself carries the click-target attributes (no
// wrapping button) so the entire visible figure — including the dashed
// outline halo — is one big hit area. A wrapping button with display:
// contents previously left the click area exactly the figure's interior
// box, which made the picker feel unresponsive at low zoom levels.
function renderPrimaryTargetWrapper(monster, intent) {
  const armed = !!armedCard && monster.hp > 0;
  if (armed) {
    return renderMonsterFigure(monster, { armedTarget: true })
      + renderMonsterBaseplate(monster);
  }
  return renderMonsterFigure(monster) + renderMonsterBaseplate(monster);
}

// Decides whether playing a card should arm the target picker. A card
// "needs a target" when it has at least one damage-type action AND the
// fight has 2+ living monsters. Single-monster fights and non-damage
// cards skip the picker (queue immediately on click).
function cardNeedsTarget(cardId) {
  if (!cardId) return false;
  const livingMonsters = (gameState?.monsters ?? []).filter((m) => m.hp > 0);
  if (livingMonsters.length < 2) return false;
  let card;
  try {
    card = getCardDefinition(cardId);
  } catch {
    return false;
  }
  return (card.actions ?? []).some((action) =>
    action?.type === "damage"
    || action?.type === "damageFromBlock"
    || action?.type === "executeDamage",
  );
}

// Encounter banner above the monster zone. Shows only when the
// chosen encounter has a banner image and the fight has more than
// one monster — single-monster boss fights keep the original look.
function renderEncounterBanner() {
  const encounter = getEncounter(setup.monsterId);
  if (!encounter || !encounter.banner) return "";
  if ((gameState.monsters?.length ?? 1) <= 1) return "";
  return `
    <div class="encounter-banner-strip" aria-hidden="true">
      <img src="${assetUrl(encounter.banner)}" alt="" class="encounter-banner-strip-img" />
    </div>
  `;
}

// For multi-monster encounters, render the non-primary squadmates as
// compact tiles next to the primary so the player can track every
// monster's HP, ability, and "still alive" status. Returns an empty
// string for single-monster fights.
function renderSquadmates(state) {
  const monsters = state.monsters ?? [];
  if (monsters.length <= 1) return "";
  const others = monsters.filter((m) => m !== state.monster);
  if (others.length === 0) return "";
  return `
    <div class="squadmate-tray">
      ${others.map(renderSquadmateTile).join("")}
    </div>
  `;
}

function renderSquadmateTile(monster) {
  const hpPct = Math.max(0, Math.round((monster.hp / monster.maxHp) * 100));
  const dead = monster.hp <= 0 ? "is-dead" : "";
  const traits = (monster.traits ?? []).join(" · ");
  const visual = getMonsterVisual(monster.monsterId);
  const portraitMarkup = visual?.portrait
    ? `<div class="squadmate-portrait" data-monster-art-id="${monster.monsterId ?? ""}">
         <img src="${visual.portrait}" alt="" />
       </div>`
    : "";
  const inner = `
    ${portraitMarkup}
    <div class="squadmate-text">
      <div class="squadmate-name">${escapeHtml(monster.name)}</div>
      <div class="squadmate-role">${escapeHtml(monster.role ?? "")}</div>
      <div class="squadmate-meter">
        <div class="meter-track meter-hp"><em style="width: ${hpPct}%"></em></div>
        <strong>${monster.hp} / ${monster.maxHp}</strong>
      </div>
      ${traits ? `<div class="squadmate-traits">${escapeHtml(traits)}</div>` : ""}
    </div>
  `;
  // When the target picker is armed and this monster is alive, wrap
  // the tile in a button so clicking it routes through target-monster.
  const armed = !!armedCard && monster.hp > 0;
  if (armed) {
    return `
      <button type="button" class="squadmate-tile is-armed" data-action="target-monster" data-monster-id-key="${monster.monsterId}" aria-label="Target ${escapeHtml(monster.name)}">
        ${inner}
      </button>
    `;
  }
  return `
    <div class="squadmate-tile ${dead}" data-monster-id="${monster.id}-${escapeHtml(monster.name)}">
      ${inner}
    </div>
  `;
}

function renderMonsterFigure(monster, options = {}) {
  const { armedTarget = false } = options;
  const hpFrac = Math.max(0, Math.min(1, monster.hp / monster.maxHp));
  const wounded = hpFrac < 0.5 ? "wounded" : "";
  const critical = hpFrac < 0.25 ? "critical" : "";
  const visual = getMonsterVisual(monster.monsterId);
  const hasPortrait = !!visual?.portrait;
  const figureClasses = ["monster-figure", wounded, critical, hasPortrait ? "has-portrait" : ""]
    .filter(Boolean)
    .join(" ");
  const body = hasPortrait
    ? `<img class="monster-portrait" src="${visual.portrait}" alt="" />`
    : `<div class="monster-silhouette">
        <div class="monster-region region-head" data-monster-region="head"></div>
        <div class="monster-region region-core" data-monster-region="core"></div>
        <div class="monster-region region-arm region-arm-left" data-monster-region="arm-left"></div>
        <div class="monster-region region-arm region-arm-right" data-monster-region="arm-right"></div>
        <div class="monster-eyes"></div>
      </div>`;
  return `
    <div class="${figureClasses}${armedTarget ? " is-armed-target" : ""}" data-monster-art data-monster-art-id="${monster.monsterId ?? ""}"${armedTarget ? ` data-action="target-monster" data-monster-id-key="${monster.monsterId}" role="button" tabindex="0" aria-label="Target ${escapeHtml(monster.name)}"` : ` aria-hidden="true"`}>
      <div class="monster-aura"></div>
      ${body}
      <div class="monster-glow"></div>
      ${renderMonsterStatusPips(monster)}
      <div class="monster-effect-mount" data-effect-mount="${targetKey({ type: "monster" })}">
        ${renderEffectSprites({ type: "monster" })}
      </div>
    </div>
  `;
}

function renderMonsterStatusPips(monster) {
  // Future canonical statuses (Enrage, monster-card-driven punishments, etc.)
  // will render here. The orphan exposed/weakened pips were retired.
  void monster;
  return "";
}

function renderMonsterBaseplate(monster) {
  const hpPercent = Math.max(0, Math.round((monster.hp / monster.maxHp) * 100));
  return `
    <div class="baseplate monster-baseplate">
      <div class="baseplate-name">
        <p class="eyebrow">Threat encounter</p>
        <h2>${escapeHtml(monster.name)}</h2>
        ${renderMonsterStatLine(monster)}
      </div>
      <div class="baseplate-meter">
        <div class="meter-track meter-hp">
          <em style="width: ${hpPercent}%"></em>
        </div>
        <strong>${monster.hp} / ${monster.maxHp} HP</strong>
      </div>
      ${renderMonsterResistances(monster)}
      <div class="threat-pip-row">
        ${gameState.players
          .map((player) => {
            const threat = gameState.monster.threat[player.id] ?? 0;
            const cap = gameState.monster.threatMax ?? 20;
            const percent = Math.min(100, Math.round((threat / cap) * 100));
            const isFixated = gameState.monster.fixate?.playerId === player.id;
            return `
              <div class="threat-pip class-${player.classId} ${isFixated ? "is-fixated" : ""}">
                <span>${escapeHtml(player.name)}${isFixated ? " · Marked" : ""}</span>
                <div class="meter-track meter-threat"><em style="width: ${percent}%"></em></div>
                <strong>${threat}/${cap}</strong>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderMonsterStatLine(monster) {
  const parts = [];
  if (typeof monster.defense === "number" && monster.defense > 0) {
    parts.push(`<span class="monster-stat-chip stat-defense" title="Damage reduction (after element multiplier)">DEF ${monster.defense}</span>`);
  }
  const actions = monster.actionsPerTurn ?? 1;
  if (actions > 1) {
    parts.push(`<span class="monster-stat-chip stat-actions" title="Actions per monster turn">${actions} actions</span>`);
  }
  if (monster.phases && monster.phases.length > 1) {
    const phaseIdx = monster.activePhaseIndex ?? 0;
    const phase = monster.phases[phaseIdx];
    if (phase) {
      parts.push(`<span class="monster-stat-chip stat-phase" title="Active phase">Phase: ${escapeHtml(phase.id)}</span>`);
    }
  }
  if (!parts.length) {
    return "";
  }
  return `<div class="monster-stat-line">${parts.join("")}</div>`;
}

function renderMonsterResistances(monster) {
  const resists = monster.elementResistances ?? {};
  const entries = Object.entries(resists).filter(([, mul]) => typeof mul === "number" && mul !== 1);
  if (!entries.length) {
    return "";
  }
  const chips = entries
    .map(([element, multiplier]) => {
      const sign = multiplier > 1 ? "vuln" : "resist";
      const display = multiplier > 1
        ? `+${Math.round((multiplier - 1) * 100)}%`
        : `−${Math.round((1 - multiplier) * 100)}%`;
      const icon = getElementIcon(element);
      return `<span class="resist-chip resist-${sign} elem-${escapeHtml(element)}" title="${escapeHtml(element)} ${sign}">
        ${icon ? `<span class="resist-chip-icon" aria-hidden="true">${icon}</span>` : ""}
        <strong>${escapeHtml(element)}</strong>
        <em>${display}</em>
      </span>`;
    })
    .join("");
  return `<div class="monster-resists">${chips}</div>`;
}

function renderMonsterIntent(intent) {
  if (!intent) {
    return "";
  }
  const actions = intent.actions ?? 1;
  const totalLabel = actions > 1
    ? `${intent.damage} × ${actions}`
    : `${intent.damage}`;
  const titleLabel = actions > 1
    ? `Next attacks: ${actions} × ${intent.damage} damage to ${intent.targetName}`
    : `Next attack: ${intent.damage} damage to ${intent.targetName}`;
  return `
    <div class="monster-intent" title="${escapeHtml(titleLabel)}">
      <span class="intent-icon" aria-hidden="true"></span>
      <strong>${totalLabel}</strong>
      <span class="intent-target">to ${escapeHtml(intent.targetName)}</span>
    </div>
  `;
}

// Map a player slot to a layout side ("left" / "right" / "center"). The
// side controls hand-fan direction, portrait flipping, and pip placement.
// 1 player  -> [left]
// 2 players -> [left, right]
// 3 players -> [left, center, right]
// 4 players -> [left, center, center, right]
function championSideForIndex(index, total) {
  if (total <= 1) {
    return "left";
  }
  if (total === 2) {
    return index === 0 ? "left" : "right";
  }
  if (total === 3) {
    if (index === 0) return "left";
    if (index === total - 1) return "right";
    return "center";
  }
  // 4+ players: ends are flanks, middles are center.
  if (index === 0) return "left";
  if (index === total - 1) return "right";
  return "center";
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
        ${renderPlayerTokens(player)}
        ${renderPlayerBuffs(player)}
      </div>
    </div>
  `;
}

// Element-token cluster rendered on the player baseplate. Three chips, one
// per canonical element token (Bio-Growth, Hydroflow, Storm Charge). Chips
// are hidden when the count is zero so empty plates stay clean. Tooltip
// describes the always-on passive each token grants while held — see
// docs/canonical-rules.md §4.
const TOKEN_CHIP_DEFS = [
  {
    key: "bioGrowth",
    cls: "token-bio",
    elementId: "bio-growth",
    label: "Bio-Growth",
    title: "Bio-Growth: your healing actions heal +1 (any held)",
  },
  {
    key: "hydroflow",
    cls: "token-hydro",
    elementId: "hydroflow",
    label: "Hydroflow",
    title: "Hydroflow: when you would gain 2+ threat, reduce by 1 (any held)",
  },
  {
    key: "stormCharge",
    cls: "token-storm",
    elementId: "storm-charge",
    label: "Storm Charge",
    title: "Storm Charge: your damage actions deal +1 (any held)",
  },
];

function renderPlayerTokens(player) {
  const tokens = player?.tokens ?? {};
  const counts = TOKEN_CHIP_DEFS.map((def) => ({ def, count: tokens[def.key] ?? 0 }));
  // If the player holds nothing, render no markup at all — keeps the
  // baseplate uncluttered when tokens aren't in play.
  if (!counts.some(({ count }) => count > 0)) {
    return "";
  }
  const chips = counts
    .filter(({ count }) => count > 0)
    .map(({ def, count }) => {
      const icon = getElementIcon(def.elementId, { title: def.label });
      return `
        <span class="token-chip ${def.cls}" title="${escapeHtml(def.title)}" aria-label="${escapeHtml(def.label)}: ${count}">
          <span class="token-chip-icon" aria-hidden="true">${icon}</span>
          <strong>${count}</strong>
        </span>
      `;
    });
  return `<div class="player-tokens" role="group" aria-label="Element tokens">${chips.join("")}</div>`;
}

// Buff/debuff chip cluster on the player baseplate. Mirrors the layout of
// renderPlayerTokens but reads from `player.statuses` (the buff stack bag).
// One chip per active buff/debuff key — hidden when its stack is 0.
const BUFF_CHIP_DEFS = [
  {
    key: "damageBoostThisTurn",
    cls: "buff-strength",
    label: "Strength",
    title: "Damage boost this turn (Overclock Sync)",
    sign: "+",
  },
  {
    key: "strength",
    cls: "buff-strength",
    label: "Strength",
    title: "Strength stacks — +1 damage each, consumed per hit (Bio Surge)",
    sign: "+",
  },
  {
    key: "firstCardDiscount",
    cls: "buff-discount",
    label: "Discount",
    title: "First card next turn costs −1 (Network Efficiency)",
    sign: "−",
  },
  {
    key: "nextCardCostExtra",
    cls: "buff-lag",
    label: "Lag",
    title: "Next card costs +1 energy (System Lag)",
    sign: "+",
  },
  {
    key: "nextTurnEnergyDelta",
    cls: "buff-energy",
    label: "Energy",
    title: "Pending energy delta applied next turn",
    sign: "auto",
  },
];

function renderPlayerBuffs(player) {
  const statuses = player?.statuses ?? {};
  const chips = [];
  for (const def of BUFF_CHIP_DEFS) {
    const raw = statuses[def.key] ?? 0;
    if (raw === 0) continue;
    const display = def.sign === "auto"
      ? (raw > 0 ? `+${raw}` : `${raw}`)
      : `${def.sign}${Math.abs(raw)}`;
    chips.push(`
      <span class="buff-chip ${def.cls}" title="${escapeHtml(def.title)}" aria-label="${escapeHtml(def.label)}: ${display}">
        <strong>${def.label}</strong>
        <em>${display}</em>
      </span>
    `);
  }
  if (chips.length === 0) return "";
  return `<div class="player-buffs" role="group" aria-label="Active buffs and debuffs">${chips.join("")}</div>`;
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
  // Mirror the engine target picker. Fixate locks onto the marked player.
  let target = null;
  const fixate = state.monster.fixate;
  if (fixate && fixate.roundsRemaining > 0) {
    target = livingPlayers.find((p) => p.id === fixate.playerId) ?? null;
  }
  if (!target) {
    target = [...livingPlayers].sort((a, b) => {
      const threatDiff = (state.monster.threat[b.id] ?? 0) - (state.monster.threat[a.id] ?? 0);
      if (threatDiff !== 0) {
        return threatDiff;
      }
      return a.hp - b.hp;
    })[0];
  }
  // baseAttack scales by floor(roundNumber / 2) per engine.
  const weakened = state.monster.statuses?.weakened ?? 0;
  const damage = Math.max(
    1,
    state.monster.baseAttack + Math.floor(state.roundNumber / 2) - weakened,
  );
  const actions = Math.max(1, state.monster.actionsPerTurn ?? 1);
  return {
    targetId: target.id,
    targetName: target.name,
    damage,
    actions,
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
  const isArmed = armedCard && armedCard.instanceId === cardInstance.instanceId;
  return `
    <button
      class="hand-card class-${player.classId} role-${card.role} ${cannotAfford ? "unplayable" : "playable"} ${isArmed ? "is-armed" : ""}"
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
  // The .card-art slot fills the second grid row of .hand-card. The faction
  // backdrop comes from .hand-card.class-* (set on the parent button); the
  // .card-art element layers a role-themed emblem on top of that backdrop.
  const element = getCardElement(card);
  const elementBadge = element
    ? `<span class="card-element elem-${escapeHtml(element)}" title="${escapeHtml(element)} element" aria-hidden="true">${getElementIcon(element)}</span>`
    : "";
  return `
    <span class="card-cost">${card.cost}</span>
    ${elementBadge}
    <span class="card-name">${escapeHtml(card.name)}</span>
    <span class="card-art role-${card.role}" aria-hidden="true">
      <span class="card-art-glyph"></span>
    </span>
    <span class="card-role">${formatRole(card.role)}</span>
    <span class="card-text">${escapeHtml(card.text)}</span>
  `;
}

// Card data stores the element on individual actions (e.g. `damage(11, "water")`).
// This helper picks the first action with an element so the card frame can
// flag its primary element. Returns null if the card has no elemental tag.
function getCardElement(card) {
  if (card?.element) {
    return card.element;
  }
  for (const action of card?.actions ?? []) {
    if (action?.element) {
      return action.element;
    }
  }
  return null;
}

function formatRole(role) {
  return role === "defense" ? "defend" : role;
}

// Per-event stagger so card / monster actions resolve visibly one after
// the other instead of all flashing at once. Earlier events kick off
// first; each one sits on screen for its own duration before clearing.
const EFFECT_STAGGER_MS = 220;

function enqueueEffectsFromState(state) {
  const newEvents = state.events.filter((event) => event.id > lastSeenEventId);
  if (newEvents.length === 0) {
    return;
  }

  lastSeenEventId = Math.max(...newEvents.map((event) => event.id));

  let startDelay = 0;
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
    const localStart = startDelay;
    const duration = getEffectDuration(effect.type);

    window.setTimeout(() => {
      activeEffects.push(effect);
      activeEffects = activeEffects.slice(-24);
      render();
      window.setTimeout(() => {
        activeEffects = activeEffects.filter((candidate) => candidate.instanceId !== effect.instanceId);
        render();
      }, duration);
    }, localStart);

    startDelay += EFFECT_STAGGER_MS;
  }
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

function renderLogEntry(entry) {
  if (typeof entry === "string") {
    return `<li class="log-entry log-entry-info">${escapeHtml(entry)}</li>`;
  }
  if (!entry || typeof entry !== "object") {
    return "";
  }
  const kind = entry.kind ?? "info";
  const classes = ["log-entry", `log-entry-${kind}`];
  if (entry.classId) classes.push(`class-${entry.classId}`);
  if (entry.targetClassId) classes.push(`target-class-${entry.targetClassId}`);
  if (entry.role) classes.push(`role-${entry.role}`);
  if (entry.outcome) classes.push(`outcome-${entry.outcome}`);
  if (entry.phase) classes.push(`phase-${entry.phase}`);
  const text = entry.text ?? "";

  if (kind === "card-use") {
    const cost = typeof entry.cost === "number" ? `<span class="log-cost">${entry.cost}</span>` : "";
    return `<li class="${classes.join(" ")}">${cost}<span class="log-text">${escapeHtml(text)}</span></li>`;
  }
  if (kind === "monster-attack") {
    return `<li class="${classes.join(" ")}"><span class="log-icon" aria-hidden="true">⚔</span><span class="log-text">${escapeHtml(text)}</span></li>`;
  }
  if (kind === "phase-banner") {
    return `<li class="${classes.join(" ")}"><span class="log-text">${escapeHtml(text)}</span></li>`;
  }
  if (kind === "round-start") {
    return `<li class="${classes.join(" ")}"><span class="log-round-badge">R${entry.round ?? ""}</span><span class="log-text">${escapeHtml(text)}</span></li>`;
  }
  return `<li class="${classes.join(" ")}"><span class="log-text">${escapeHtml(text)}</span></li>`;
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
