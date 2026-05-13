import { classDefinitions, selectableClasses } from "./content/classes.js";
import { getCardDefinition, starterDecks, rewardOnlyPools, milestonePools, cardDefinitions } from "./content/cards.js";
import {
  getMeta,
  recordRunStart,
  recordFightWin,
  recordRunFailed,
  recordRunComplete,
  isCardUnlocked,
} from "./meta/save.js";
import { listRelics, getRelic } from "./content/relics.js";
import { getChampionVisual, getEffectVisual, getMonsterVisual } from "./content/game-assets.js";
import { listMonsters, listEncounters, getEncounter, DEFAULT_MONSTER_ID } from "./content/monsters.js";
import { assetUrl } from "./content/asset-paths.js";
import { getPartyDeckCard, PARTY_DECK_INTERACTIONS } from "./content/party-deck.js";
import { getElementIcon } from "./content/element-icons.js";
import { getEffectDuration, getEffectName, shouldShowEffectAmount } from "./effects/effect-library.js";
import {
  createCoopBattle,
  advanceToNextEncounter,
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
// Stat-pill icons. Inline SVG so they pick up `currentColor` from the
// pill's class theme (HP green, Energy gold, Block cyan, Defense slate).
// Sized at 1em so they scale with surrounding font-size.
const HP_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-10.4C1.4 6.6 4.2 3 7.7 3c2 0 3.4 1 4.3 2.4C12.9 4 14.3 3 16.3 3c3.5 0 6.3 3.6 5.2 7.6C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>';
const ENERGY_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M13.6 2L4.4 13.4h5.2L8.8 22l10-12.4h-5.4z" fill="currentColor"/></svg>';
const BLOCK_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M12 2.5l8 3v6.4c0 4.6-3.2 8.7-8 9.6-4.8-.9-8-5-8-9.6V5.5l8-3z" fill="currentColor"/></svg>';
const DEF_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M12 3l7 2.5v6c0 4-2.8 7.5-7 8.5-4.2-1-7-4.5-7-8.5v-6L12 3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
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
  runLength: 3, // 1 = single fight (legacy), 3/5/7 = run of N encounters
};

let gameState = null;
let message = "";
let lastSeenEventId = 0;
// HP-change flash bookkeeping: snapshot of last-seen HP keyed by
// entity id so the next render can detect damage / heals and pulse
// the corresponding stat pill. Cleared on game start / new game.
const lastHpByEntity = new Map();
// Pre-game flow phase. Splash is the title screen (Phase A skeleton —
// title + "PRESS ANY KEY"); setup is the existing encounter/class
// picker; combat is gameState !== null. Persists across renders.
let screenPhase = "splash"; // 'splash' | 'setup'
let splashLeaving = false;  // true during the fade-out transition
// Round summary toast — populated after each resolveRound with the
// per-player damage taken and per-monster damage dealt deltas, then
// auto-cleared after ROUND_SUMMARY_MS.
let lastSummary = null;
let lastSummaryDismissTimer = null;
const ROUND_SUMMARY_MS = 5000;
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
// Deck viewer modal — { source: 'setup' | 'combat', playerId, classId }
// Setup viewer shows the starter deck list verbatim; combat viewer
// shows the player's current full deck (hand + draw pile + discard).
let deckViewer = null;
// Pending reward screen — populated whenever the engine flips
// state.phase === "rewards" after a victory in a multi-encounter
// run. Holds rolled card options per player + crystals earned, so
// rerolls / skips don't re-roll new randoms each render.
let pendingReward = null;
// Newly-unlocked milestone cards from the just-completed run.
// Populated by recordRunComplete in handleClaimReward; consumed by
// the run-complete splash to show the "✦ unlocked" toast.
let runUnlocks = null;

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

// ---------------------------------------------------------------------
// Card preview overlay — hand cards have a 1.4× hover scale already but
// the rules text is still small at that size. The overlay below renders
// a comfortable, fully-readable detail panel anchored to the hovered
// card. Single shared element, populated on demand; positioned in
// viewport coords so it can't be clipped by ancestor overflow.
// ---------------------------------------------------------------------
const CARD_PREVIEW_DELAY_MS = 220;
let cardPreviewEl = null;
let cardPreviewTimer = null;
let cardPreviewAnchor = null;

function ensureCardPreviewEl() {
  if (cardPreviewEl) return cardPreviewEl;
  const el = document.createElement("div");
  el.className = "card-preview-overlay";
  el.setAttribute("role", "tooltip");
  el.setAttribute("aria-hidden", "true");
  document.body.appendChild(el);
  cardPreviewEl = el;
  return el;
}

function buildCardPreviewMarkup(card, classId) {
  const element = getCardElement(card);
  const elementBadge = element
    ? `<span class="cp-element elem-${escapeHtml(element)}" title="${escapeHtml(element)} element">${getElementIcon(element)} ${escapeHtml(element)}</span>`
    : "";
  // Action breakdown — convert the structured action list into a short
  // bulleted summary alongside the canonical body text. Falls back to
  // just the text when actions are unstructured or empty.
  const actionLines = (card.actions ?? [])
    .map((a) => formatActionForPreview(a))
    .filter(Boolean);
  const actionList = actionLines.length
    ? `<ul class="cp-actions">${actionLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : "";
  return `
    <div class="cp-header class-${escapeHtml(classId)}">
      <span class="cp-cost">${card.cost}</span>
      <div class="cp-titles">
        <span class="cp-name">${escapeHtml(card.name)}</span>
        <span class="cp-sub">
          <span class="cp-role">${escapeHtml(formatRole(card.role))}</span>
          ${elementBadge}
        </span>
      </div>
    </div>
    <div class="cp-body">${escapeHtml(card.text)}</div>
    ${actionList}
  `;
}

// Best-effort one-liner per action — used for the bulleted breakdown so
// players can scan the mechanical effect at a glance even when the text
// is flavor-heavy. Unknown action shapes are dropped silently.
function formatActionForPreview(action) {
  if (!action || typeof action !== "object") return null;
  switch (action.type) {
    case "damage":
      return `Deal ${action.amount} ${action.element ? `${action.element} ` : ""}damage`;
    case "damageFromBlock":
      return `Deal damage = block ÷ ${action.divisor ?? 1}`;
    case "block":
      return `Gain ${action.amount} block`;
    case "blockAll":
      return `Both players gain ${action.amount} block`;
    case "blockAlly":
      return `Ally gains ${action.amount} block`;
    case "threat":
      return `Gain ${action.amount} threat`;
    case "reduceThreat":
      return `Reduce your threat by ${action.amount}`;
    case "reduceAllyThreat":
      return `Reduce ally threat by ${action.amount}`;
    case "taunt":
      return `Taunt (+5 threat)`;
    case "heal":
    case "healSelf":
      return `Heal ${action.amount}`;
    case "healAll":
      return `Heal both players for ${action.amount}`;
    case "healLowest":
      return `Heal lowest-HP player for ${action.amount}`;
    case "draw":
    case "drawSelf":
      return `Draw ${action.amount}`;
    case "drawAll":
      return `Both players draw ${action.amount}`;
    case "spendToken":
      return `Spend 1 ${action.token} token`;
    default:
      return null;
  }
}

function positionCardPreview(anchor) {
  if (!cardPreviewEl) return;
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  // Make sure the element is visible-but-measurable before reading its size.
  cardPreviewEl.style.visibility = "hidden";
  cardPreviewEl.classList.add("is-visible");
  const pw = cardPreviewEl.offsetWidth;
  const ph = cardPreviewEl.offsetHeight;
  cardPreviewEl.style.visibility = "";
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Prefer placing above the card; if not enough room, fall back below.
  let top = rect.top - ph - margin;
  if (top < margin) {
    top = Math.min(rect.bottom + margin, vh - ph - margin);
  }
  // Center horizontally on the card, then clamp to viewport.
  let left = rect.left + rect.width / 2 - pw / 2;
  left = Math.max(margin, Math.min(left, vw - pw - margin));
  cardPreviewEl.style.top = `${Math.round(top)}px`;
  cardPreviewEl.style.left = `${Math.round(left)}px`;
}

function showCardPreviewFor(handCardEl) {
  const cardId = handCardEl.dataset.cardId;
  if (!cardId) return;
  const card = getCardDefinition(cardId);
  if (!card) return;
  const classId = handCardEl.className.split(/\s+/).find((c) => c.startsWith("class-"))?.slice("class-".length) ?? "neutral";
  const el = ensureCardPreviewEl();
  el.innerHTML = buildCardPreviewMarkup(card, classId);
  // Pull the anchor's --class-glow custom prop so the preview's accent
  // edge + halo match whichever class is hovered (covers every class
  // without per-class CSS duplication in the overlay).
  const cs = window.getComputedStyle(handCardEl);
  const glow = cs.getPropertyValue("--class-glow").trim();
  if (glow) {
    el.style.setProperty("--cp-edge", glow);
    el.style.setProperty("--cp-glow", glow);
  } else {
    el.style.removeProperty("--cp-edge");
    el.style.removeProperty("--cp-glow");
  }
  el.setAttribute("aria-hidden", "false");
  cardPreviewAnchor = handCardEl;
  positionCardPreview(handCardEl);
}

function hideCardPreview() {
  if (cardPreviewTimer) {
    clearTimeout(cardPreviewTimer);
    cardPreviewTimer = null;
  }
  if (!cardPreviewEl) return;
  cardPreviewEl.classList.remove("is-visible");
  cardPreviewEl.setAttribute("aria-hidden", "true");
  cardPreviewAnchor = null;
}

app.addEventListener("mouseover", (event) => {
  const handCard = event.target.closest(".hand-card");
  if (!handCard) return;
  // Touch-friendly: skip preview while a drag is in progress.
  if (document.body.classList.contains("card-dragging")) return;
  if (cardPreviewAnchor === handCard) return;
  if (cardPreviewTimer) clearTimeout(cardPreviewTimer);
  cardPreviewTimer = window.setTimeout(() => {
    cardPreviewTimer = null;
    showCardPreviewFor(handCard);
  }, CARD_PREVIEW_DELAY_MS);
});

app.addEventListener("mouseout", (event) => {
  const handCard = event.target.closest(".hand-card");
  if (!handCard) return;
  // Suppress if the related target is still inside the same card.
  if (event.relatedTarget && handCard.contains(event.relatedTarget)) return;
  hideCardPreview();
});

// Hide on scroll / resize / click anywhere — the anchor would otherwise
// drift away from the preview's pinned viewport coords.
window.addEventListener("scroll", hideCardPreview, true);
window.addEventListener("resize", hideCardPreview);
document.addEventListener("click", hideCardPreview, true);

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

// Splash screen accepts ANY key as "start". Mirrors Elden Ring's
// "press any button" affordance. Only fires while we're on the splash
// screen and not already mid-transition; unbinds itself once the
// player advances. The click pathway goes through data-action so the
// regular delegate below handles it too.
window.addEventListener("keydown", (event) => {
  // Esc closes the deck viewer if open. Highest priority — beats
  // splash advancement.
  if (event.key === "Escape" && deckViewer) {
    event.preventDefault();
    deckViewer = null;
    render();
    return;
  }
  if (screenPhase !== "splash" || splashLeaving) return;
  // Ignore meta-only presses (e.g. Tab focusing) — only commit on a
  // typing key, Space, or Enter so the player feels they pressed it.
  if (event.key === "Tab" || event.key === "Shift" || event.key === "Control"
      || event.key === "Alt" || event.key === "Meta") return;
  event.preventDefault();
  advanceSplash();
});

function advanceSplash() {
  if (screenPhase !== "splash" || splashLeaving) return;
  splashLeaving = true;
  render();
  // Fade-out duration matches .title-splash.is-leaving in styles.css.
  window.setTimeout(() => {
    screenPhase = "setup";
    splashLeaving = false;
    render();
  }, 480);
}

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

  if (action === "set-run-length") {
    const next = Number.parseInt(element.dataset.runLength, 10);
    if (Number.isInteger(next) && [1, 3, 5, 7].includes(next)) {
      setup = { ...setup, runLength: next };
      render();
    }
    return;
  }

  if (action === "splash-advance") {
    advanceSplash();
    return;
  }

  if (action === "claim-reward") {
    handleClaimReward(element);
    return;
  }

  if (action === "skip-reward") {
    handleClaimReward({ dataset: { skip: "true" } });
    return;
  }

  if (action === "shop-buy") {
    handleShopBuy(element.dataset.shopItem ?? "");
    return;
  }

  if (action === "open-deck-viewer") {
    const playerId = element.dataset.playerId ?? null;
    const classId = element.dataset.classId ?? null;
    const source = element.dataset.source ?? (gameState ? "combat" : "setup");
    deckViewer = { source, playerId, classId };
    render();
    return;
  }

  if (action === "close-deck-viewer") {
    deckViewer = null;
    render();
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
    // Run-mode: when runLength > 1, generate an ordered list of N
     // encounters (the picked one plus (N-1) random others from the
     // registry, no immediate repeats) and feed it as state.run.
     const runLength = setup.runLength ?? 1;
     let runState = null;
     if (runLength > 1) {
       runState = generateRun(setup.monsterId, runLength);
     }
    const battleConfig = {
      players: activeClasses.map((classId, index) => ({
        id: `player-${index + 1}`,
        name: classDefinitions[classId].shortName,
        classId,
      })),
    };
    if (runState) {
      battleConfig.run = runState;
      const firstId = runState.encounters[0];
      const firstEnc = getEncounter(firstId);
      if (firstEnc && firstEnc.monsterIds.length > 1) {
        battleConfig.monsterIds = firstEnc.monsterIds;
      } else if (firstEnc) {
        battleConfig.monsterId = firstEnc.monsterIds[0];
      }
    } else if (encounter && encounter.monsterIds.length > 1) {
      battleConfig.monsterIds = encounter.monsterIds;
    } else if (encounter) {
      battleConfig.monsterId = encounter.monsterIds[0];
    } else {
      battleConfig.monsterId = setup.monsterId;
    }
    gameState = createCoopBattle(battleConfig);
    // Meta-progression: bump per-class play counter at run start.
    // Only count once per run (this is the entry point) and only
    // when actually starting a multi-fight run; single fights still
    // count so the codex tracks every game.
    recordRunStart(activeClasses);
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
    runUnlocks = null;
    pendingReward = null;
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
    // Snapshot HPs before resolution so we can build a round summary
    // diff (damage taken per player, damage dealt per monster).
    const preRoundSnapshot = snapshotHpForSummary(gameState);
    const resolvedRound = gameState.roundNumber;
    gameState = resolveRound(gameState);
    enqueueEffectsFromState(gameState);
    lastSummary = buildRoundSummary(preRoundSnapshot, gameState, resolvedRound);
    if (lastSummaryDismissTimer) window.clearTimeout(lastSummaryDismissTimer);
    lastSummaryDismissTimer = window.setTimeout(() => {
      lastSummary = null;
      render();
    }, ROUND_SUMMARY_MS);
    if (gameState.phase === "rewards") {
      // Multi-fight run: party cleared a non-final encounter.
      recordFightWin();
      message = "Encounter cleared. Choose a reward to continue the run.";
    } else if (gameState.phase === "run-complete") {
      // Final fight in a run won. Meta-progression: record win +
      // unlock per-class milestones. Stash newly-unlocked cards on
      // `runUnlocks` so the run-complete splash can surface them.
      recordFightWin();
      const classIds = gameState.players.map((p) => p.classId);
      runUnlocks = recordRunComplete(classIds, milestonePools, cardDefinitions);
      message = runUnlocks.length > 0
        ? "Run complete. New cards unlocked for next time."
        : "Run complete. Every encounter cleared.";
    } else if (gameState.phase === "game-over") {
      if (gameState.winner === "players") {
        // Single-fight win (no run wrapper). Still a fight cleared.
        recordFightWin();
      } else if (gameState.run) {
        // Party fell mid-run.
        recordRunFailed();
      }
      message = gameState.winner === "players"
        ? "The monster is defeated. Victory."
        : "The party fell. Try a different plan.";
    } else {
      message = "New round. Draw 5, energy increases, threat decays.";
    }
    render();
    notifyMultiplayer({ type: action, dataset: { ...element.dataset } });
  }
}

function snapshotHpForSummary(state) {
  return {
    players: state.players.map((p) => ({ id: p.id, name: p.name, classId: p.classId, hp: p.hp })),
    monsters: (state.monsters ?? [state.monster]).map((m) => ({
      monsterId: m.monsterId ?? m.id,
      name: m.name,
      hp: m.hp,
    })),
  };
}

// Build the per-round summary by diffing pre/post HPs. Player damage
// taken is pre.hp - post.hp; monster damage dealt is the same diff
// on the monster side. Kills are monsters whose HP fell to 0 this
// round but were alive before.
function buildRoundSummary(pre, postState, roundNumber) {
  const playerLines = pre.players.map((preP) => {
    const post = postState.players.find((p) => p.id === preP.id);
    const lost = Math.max(0, preP.hp - (post?.hp ?? 0));
    return { id: preP.id, name: preP.name, classId: preP.classId, lost };
  }).filter((line) => line.lost > 0);
  const monsterLines = pre.monsters.map((preM) => {
    const post = (postState.monsters ?? [postState.monster]).find(
      (m) => (m.monsterId ?? m.id) === preM.monsterId,
    );
    const dealt = Math.max(0, preM.hp - (post?.hp ?? 0));
    const killed = preM.hp > 0 && (post?.hp ?? 0) <= 0;
    return { name: preM.name, dealt, killed };
  }).filter((line) => line.dealt > 0 || line.killed);
  return { round: roundNumber, players: playerLines, monsters: monsterLines };
}

function render() {
  let html;
  if (gameState) {
    html = renderGame();
  } else if (screenPhase === "splash") {
    html = renderSplash();
  } else {
    html = renderSetup();
  }
  // Reward + run-complete screens overlay combat so the player still
  // sees the cleared battlefield underneath while choosing the reward
  // / reading the run summary. Order: deck-viewer last so it sits on
  // top if both are open (rare — only if the player popped the deck
  // mid-reward to compare).
  ensurePendingReward();
  html += renderRewardScreen();
  html += renderRunCompleteScreen();
  html += renderDeckViewer();
  app.innerHTML = html;
  document.body.dataset.gameView = gameState ? "active" : screenPhase;
  document.body.dataset.modalOpen = (deckViewer || pendingReward || gameState?.phase === "run-complete") ? "true" : "";

  // Title-splash atmosphere — ember particles on the canvas placed in
  // renderSplash. Each render replaces the canvas so we restart the
  // loop; the previous loop self-terminates the next frame it can't
  // find its (orphaned) canvas in the document. Defer one frame so
  // the canvas has its layout box before we size the backing store.
  if (!gameState && screenPhase === "splash") {
    window.requestAnimationFrame(startSplashEmbers);
  }

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

  // HP-change flash. Snapshot every stat-hp pill's current HP and
  // compare to the value we recorded last render — if HP dropped, the
  // pill flashes red; if it rose, green. Animation lifecycle is pure
  // CSS once the class is on; we just remove it after the keyframe
  // duration so subsequent renders can re-trigger.
  if (gameState) {
    document.querySelectorAll(".stat-pill.stat-hp[data-hp-entity]").forEach((pill) => {
      const entity = pill.dataset.hpEntity;
      const current = Number(pill.dataset.hpCurrent ?? 0);
      const prev = lastHpByEntity.get(entity);
      if (prev !== undefined && current !== prev) {
        const cls = current < prev ? "is-flashing-damage" : "is-flashing-heal";
        pill.classList.remove("is-flashing-damage", "is-flashing-heal");
        // Force reflow so the animation restarts on consecutive hits
        // eslint-disable-next-line no-unused-expressions
        pill.offsetWidth;
        pill.classList.add(cls);
        window.setTimeout(() => pill.classList.remove(cls), 700);
      }
      lastHpByEntity.set(entity, current);
    });
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

// Run-progression helpers — generate encounter list, roll reward
// options, advance run on claim, etc. Phase 2/3 of the rogue-lite
// roadmap; Phase 4 (relics) and 5 (run-end UI) build on these.

const REWARD_CRYSTALS_PER_FIGHT = 5;
const REWARD_CARD_OPTIONS = 3;

// Build an ordered N-encounter run starting with the picked encounter
// id. Subsequent fights are sampled (no immediate repeats) from the
// rest of the encounter registry. Future iterations can layer in
// difficulty curves (normal → elite → boss), but uniform-random keeps
// the schema simple for v1.
function generateRun(firstEncounterId, length) {
  const allEncounters = listEncounters().map((e) => e.id);
  const encounters = [firstEncounterId];
  const pool = allEncounters.filter((id) => id !== firstEncounterId);
  while (encounters.length < length && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    encounters.push(pool.splice(i, 1)[0]);
  }
  // If we ran out of unique encounters, pad with random repeats.
  while (encounters.length < length) {
    const i = Math.floor(Math.random() * allEncounters.length);
    encounters.push(allEncounters[i]);
  }
  return {
    encounters,
    currentIndex: 0,
    crystals: 0,
    runDeckAdds: {},
    relics: [],
  };
}

// Roll N random cards per player. Pulls from the class's curated
// `rewardOnlyPools` entry when one exists — distinct from the starter
// so the player keeps seeing fresh options. Falls back to the starter
// pool for classes without a reward pool yet (legacy behavior). Within
// the roll we dedupe against the player's existing run picks so they
// aren't offered the same card they already grabbed last fight.
function rollRewardOptions(state) {
  const opts = {};
  for (const player of state.players) {
    const rewardPool = rewardOnlyPools?.[player.classId];
    const basePool = (rewardPool && rewardPool.length > 0)
      ? rewardPool.slice()
      : (starterDecks[player.classId] ?? []).slice();
    // Meta-progression: append any unlocked milestone cards for this
    // class. Unlock flag is set in localStorage by recordRunComplete.
    const milestones = (milestonePools[player.classId] ?? []).filter(isCardUnlocked);
    const sourcePool = basePool.concat(milestones);
    const owned = new Set(state.run?.runDeckAdds?.[player.id] ?? []);
    // Prefer cards the player doesn't already own this run. If filtering
    // would leave fewer than REWARD_CARD_OPTIONS, fall back to the full
    // pool so the screen always shows 3 picks (duplicates allowed in the
    // long-tail case where every reward card has been claimed once).
    const freshIds = sourcePool.filter((id) => !owned.has(id));
    const unique = Array.from(new Set(
      freshIds.length >= REWARD_CARD_OPTIONS ? freshIds : sourcePool,
    ));
    const choices = [];
    while (choices.length < REWARD_CARD_OPTIONS && unique.length > 0) {
      const i = Math.floor(Math.random() * unique.length);
      choices.push(unique.splice(i, 1)[0]);
    }
    opts[player.id] = choices;
  }
  return opts;
}

// Build the reward screen state once when the engine flips to phase
// "rewards" so re-renders don't re-roll new card options. Cleared
// when the run advances or the player skips.
function ensurePendingReward() {
  if (!gameState || gameState.phase !== "rewards") {
    pendingReward = null;
    return;
  }
  if (pendingReward && pendingReward.encounterIndex === gameState.run?.currentIndex) {
    return; // already rolled for this fight
  }
  // Determine if the encounter just cleared was a "boss" — single-
  // monster encounters in the registry are bosses by nature
  // (Hollow Titan, Ironjaw Bruiser, Warden of Targeting); multi-
  // monster encounters are not. Boss clears drop a relic offer.
  const justClearedId = gameState.run?.encounters[gameState.run.currentIndex];
  const justClearedEnc = justClearedId ? getEncounter(justClearedId) : null;
  const isBoss = !!(justClearedEnc && justClearedEnc.monsterIds.length === 1);
  // Crystal Refractor relic: +5 bonus crystals per clear.
  const ownedRelics = gameState.run?.relics ?? [];
  const crystalBonus = ownedRelics.reduce((sum, id) => {
    const r = getRelic(id);
    return sum + (r?.bonusCrystalsPerClear ?? 0);
  }, 0);
  pendingReward = {
    encounterIndex: gameState.run?.currentIndex ?? 0,
    crystalsEarned: REWARD_CRYSTALS_PER_FIGHT + crystalBonus,
    cardOptionsByPlayer: rollRewardOptions(gameState),
    picksByPlayer: {}, // playerId -> cardId once chosen
    isBoss,
    relicOptions: isBoss ? rollRelicOptions(gameState) : [],
    relicPick: null, // relic id or null (skipped)
    // Shop — three crystal-spend slots that re-roll, heal, or grant a
    // bonus relic. State is per-fight: any "applied" item persists
    // through re-renders until the player advances. The bonus relic
    // is rolled here so the price-tag shows what the player would
    // actually receive.
    shop: buildShop(gameState),
    crystalsSpent: 0,
  };
}

// Build the shop state for one reward screen. Rolls a bonus relic
// from the unowned pool so the card can show the player exactly what
// they'd buy (rather than a blind purchase). All slots start as
// !applied; clicking spends crystals + flips applied=true.
function buildShop(state) {
  const ownedRelics = new Set(state.run?.relics ?? []);
  const unowned = listRelics().filter((r) => !ownedRelics.has(r.id));
  const bonusRelic = unowned.length > 0
    ? unowned[Math.floor(Math.random() * unowned.length)].id
    : null;
  return {
    heal:   { applied: false, cost: 30 },
    reroll: { applied: false, cost: 20 },
    relic:  { applied: false, cost: 80, relicId: bonusRelic },
  };
}

// Roll 2 relic options the party doesn't already own. Boss-clear
// reward (per Phase 4 design: B — boss encounters drop a relic).
function rollRelicOptions(state) {
  const owned = new Set(state.run?.relics ?? []);
  const pool = listRelics().filter((r) => !owned.has(r.id));
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2).map((r) => r.id);
}

// Shop purchase. Each slot is one-shot per fight: heal applies
// immediately to the current battle's lowest-HP player; reroll
// re-rolls the per-player card options in place; bonus relic flips a
// flag and the relic is granted on advance. All three spend crystals
// from the post-fight pool (`run.crystals` + `crystalsEarned`).
function handleShopBuy(slot) {
  if (!pendingReward || !gameState || !pendingReward.shop) return;
  const item = pendingReward.shop[slot];
  if (!item || item.applied) return;
  const pool = (gameState.run?.crystals ?? 0) + pendingReward.crystalsEarned - pendingReward.crystalsSpent;
  if (pool < item.cost) return;
  pendingReward.crystalsSpent += item.cost;
  item.applied = true;
  if (slot === "heal") {
    // Lowest-HP living player gets +10, capped at maxHp.
    const living = gameState.players.filter((p) => p.hp > 0);
    if (living.length > 0) {
      const target = living.reduce((lo, p) => (p.hp < lo.hp ? p : lo), living[0]);
      target.hp = Math.min(target.maxHp, target.hp + 10);
    }
  } else if (slot === "reroll") {
    pendingReward.cardOptionsByPlayer = rollRewardOptions(gameState);
    // Clear stale picks — the cards they referenced are gone now.
    pendingReward.picksByPlayer = {};
  }
  // Bonus relic is applied at advance time via options.extraRelics.
  render();
}

// Click handler for "claim this reward and advance" / "skip".
// Tolerates both per-player picks (data-player-id + data-card-id)
// and a final "advance to next fight" button (data-advance-only).
function handleClaimReward(element) {
  if (!pendingReward || !gameState) return;
  const ds = element.dataset ?? {};
  // Per-player card pick path: clicking one of the three card
  // options for that player toggles it as their pick.
  if (ds.playerId && ds.cardId) {
    pendingReward.picksByPlayer[ds.playerId] = ds.cardId;
    render();
    return;
  }
  if (ds.playerId && ds.skipPlayer === "true") {
    pendingReward.picksByPlayer[ds.playerId] = null;
    render();
    return;
  }
  // Relic pick (boss clears only) — toggles the relic for the party.
  if (ds.relicId) {
    pendingReward.relicPick = pendingReward.relicPick === ds.relicId ? null : ds.relicId;
    render();
    return;
  }
  if (ds.skipRelic === "true") {
    pendingReward.relicPick = null;
    render();
    return;
  }
  // Advance: every player has either picked or skipped (null).
  // For simplicity, treat any unset player as a skip on advance.
  const picks = {};
  for (const p of gameState.players) {
    const pick = pendingReward.picksByPlayer[p.id];
    if (pick) picks[p.id] = pick;
  }
  // Resolve the encounter id list to monsterIds via the registry.
  const nextIndex = (gameState.run?.currentIndex ?? 0) + 1;
  const nextEncounterId = gameState.run?.encounters[nextIndex];
  const enc = nextEncounterId ? getEncounter(nextEncounterId) : null;
  const monsterIds = enc?.monsterIds ?? [];
  const extraRelics = pendingReward.shop?.relic?.applied && pendingReward.shop.relic.relicId
    ? [pendingReward.shop.relic.relicId]
    : [];
  gameState = advanceToNextEncounter(gameState, {
    crystalsEarned: pendingReward.crystalsEarned,
    crystalsSpent: pendingReward.crystalsSpent ?? 0,
    picks,
    relicPick: pendingReward.relicPick,
    extraRelics,
    monsterIds,
  });
  pendingReward = null;
  lastSeenEventId = getLatestEventId(gameState);
  activeEffects = [];
  // After the engine fix, the final-fight win sets phase="run-complete"
  // directly (no reward screen for the final fight), so this handler
  // only ever advances mid-run. Reset runUnlocks defensively.
  runUnlocks = null;
  message = "Next encounter inbound. Plan your opening moves.";
  render();
  notifyMultiplayer({ type: "claim-reward", dataset: {} });
}

// Reward screen — full-page overlay between encounters. Each player
// gets a row with three card options (their class's starter pool,
// de-duplicated); they click one to pick, or "Skip" to take no
// card. A central "Continue" button advances the run to the next
// encounter once everyone has decided.
function renderRewardScreen() {
  if (!pendingReward || !gameState) return "";
  const run = gameState.run ?? {};
  const cleared = (run.currentIndex ?? 0) + 1;
  const total = run.encounters?.length ?? 1;
  const playerRows = gameState.players.map((player) => {
    const options = pendingReward.cardOptionsByPlayer[player.id] ?? [];
    const pickedId = pendingReward.picksByPlayer[player.id];
    const cardChoices = options.map((cardId) => {
      let card;
      try { card = getCardDefinition(cardId); } catch { return ""; }
      const picked = pickedId === cardId;
      return `
        <button
          type="button"
          class="reward-card class-${escapeHtml(player.classId)} role-${escapeHtml(card.role)} ${picked ? "is-picked" : ""}"
          data-action="claim-reward"
          data-player-id="${player.id}"
          data-card-id="${cardId}"
          aria-pressed="${picked ? "true" : "false"}"
        >
          <span class="reward-card-cost">${card.cost}</span>
          <span class="reward-card-name">${escapeHtml(card.name)}</span>
          <span class="reward-card-role">${escapeHtml(formatRole(card.role))}</span>
          <span class="reward-card-text">${escapeHtml(card.text)}</span>
          ${picked ? `<span class="reward-card-picked-badge">Picked</span>` : ""}
        </button>
      `;
    }).join("");
    const skipped = pickedId === null;
    return `
      <section class="reward-row class-${escapeHtml(player.classId)}">
        <header class="reward-row-head">
          <h3>${escapeHtml(player.name)}</h3>
          <span class="reward-row-sub">${escapeHtml(player.role ?? "")}</span>
          <button
            type="button"
            class="reward-row-skip ${skipped ? "is-active" : ""}"
            data-action="claim-reward"
            data-player-id="${player.id}"
            data-skip-player="true"
            aria-pressed="${skipped ? "true" : "false"}"
          >Skip</button>
        </header>
        <div class="reward-row-cards">${cardChoices}</div>
      </section>
    `;
  }).join("");
  // Shop — three crystal-spend slots available on every clear.
  const shopSection = renderShopSection(pendingReward, run);

  // Boss-clear bonus: relic offer (2 options + skip)
  const relicSection = pendingReward.isBoss && pendingReward.relicOptions.length > 0
    ? `<section class="reward-relic-section">
         <h3 class="reward-relic-title">Boss reward — claim one relic</h3>
         <div class="reward-relic-row">
           ${pendingReward.relicOptions.map((rid) => {
             const r = getRelic(rid);
             if (!r) return "";
             const picked = pendingReward.relicPick === rid;
             return `
               <button
                 type="button"
                 class="reward-relic-card category-${escapeHtml(r.category)} ${picked ? "is-picked" : ""}"
                 data-action="claim-reward"
                 data-relic-id="${escapeHtml(r.id)}"
                 aria-pressed="${picked ? "true" : "false"}"
               >
                 <span class="reward-relic-icon" aria-hidden="true">${r.iconSvg ?? escapeHtml(r.icon ?? "✦")}</span>
                 <span class="reward-relic-name">${escapeHtml(r.name)}</span>
                 <span class="reward-relic-desc">${escapeHtml(r.description)}</span>
                 ${picked ? `<span class="reward-card-picked-badge">Picked</span>` : ""}
               </button>
             `;
           }).join("")}
           <button
             type="button"
             class="reward-relic-skip ${pendingReward.relicPick === null ? "is-active" : ""}"
             data-action="claim-reward"
             data-skip-relic="true"
           >Skip relic</button>
         </div>
       </section>`
    : "";
  return `
    <div class="reward-screen-backdrop" role="dialog" aria-modal="true" aria-label="Encounter cleared — choose rewards">
      <div class="reward-screen-panel">
        <header class="reward-screen-head">
          <p class="reward-screen-eyebrow">${pendingReward.isBoss ? "Boss" : "Encounter"} ${cleared} of ${total} cleared</p>
          <h2 class="reward-screen-title">Choose your reward</h2>
          <p class="reward-screen-crystals">+${pendingReward.crystalsEarned} crystals · ${(run.crystals ?? 0) + pendingReward.crystalsEarned - (pendingReward.crystalsSpent ?? 0)} ◈ available</p>
        </header>
        <div class="reward-screen-body">
          ${playerRows}
          ${shopSection}
          ${relicSection}
        </div>
        <footer class="reward-screen-foot">
          <button type="button" class="reward-screen-advance" data-action="claim-reward">
            Continue → Encounter ${cleared + 1}
          </button>
        </footer>
      </div>
    </div>
  `;
}

// Render the three shop slots inside the reward screen. Each slot is
// a clickable card showing icon / name / effect / crystal cost, with
// disabled state when can't afford or already bought.
function renderShopSection(pr, run) {
  if (!pr.shop) return "";
  const available = (run.crystals ?? 0) + pr.crystalsEarned - (pr.crystalsSpent ?? 0);
  const heal = pr.shop.heal;
  const reroll = pr.shop.reroll;
  const relicSlot = pr.shop.relic;
  const relicDef = relicSlot.relicId ? getRelic(relicSlot.relicId) : null;
  const slot = (id, icon, name, desc, item) => {
    const canAfford = available >= item.cost;
    const sold = item.applied;
    const cls = `shop-slot ${sold ? "is-sold" : ""} ${(!sold && !canAfford) ? "is-locked" : ""}`;
    const aria = sold ? "Already purchased" : (canAfford ? `Buy for ${item.cost} crystals` : `Not enough crystals (need ${item.cost})`);
    return `
      <button
        type="button"
        class="${cls}"
        data-action="shop-buy"
        data-shop-item="${id}"
        ${sold || !canAfford ? "disabled" : ""}
        aria-label="${escapeHtml(aria)}"
      >
        <span class="shop-icon" aria-hidden="true">${icon}</span>
        <span class="shop-name">${escapeHtml(name)}</span>
        <span class="shop-desc">${escapeHtml(desc)}</span>
        <span class="shop-cost">${sold ? "SOLD" : `${item.cost} ◈`}</span>
      </button>
    `;
  };
  // Bonus relic shows the actual relic that will be granted so the
  // player knows what they're buying.
  const relicLabel = relicDef ? `Bonus Relic — ${relicDef.name}` : "Bonus Relic";
  const relicDesc = relicDef ? relicDef.description : "All relics already owned.";
  const relicSlotHtml = relicDef
    ? slot("relic", relicDef.iconSvg ?? escapeHtml(relicDef.icon ?? "✦"), relicLabel, relicDesc, relicSlot)
    : `<div class="shop-slot is-empty"><span class="shop-name">${escapeHtml(relicLabel)}</span><span class="shop-desc">${escapeHtml(relicDesc)}</span></div>`;
  return `
    <section class="shop-section" aria-label="Spend crystals">
      <header class="shop-head">
        <h3 class="shop-title">Black-crystal shop</h3>
        <p class="shop-sub">${available} ◈ available · spend before continuing</p>
      </header>
      <div class="shop-row">
        ${slot("heal", "✚", "Heal Tonic", "Restore 10 HP to lowest-HP player.", heal)}
        ${slot("reroll", "↻", "Reroll Rewards", "Roll a new set of 3 card options per player.", reroll)}
        ${relicSlotHtml}
      </div>
    </section>
  `;
}

// Run end splash — handles both the victorious "run-complete" path
// and the "run-failed" path when the party falls mid-run. Both share
// the same layout (centered panel + run stats + restart button) but
// theme + copy differ.
function renderRunCompleteScreen() {
  if (!gameState) return "";
  const isComplete = gameState.phase === "run-complete";
  const isRunFailure = gameState.phase === "game-over"
    && gameState.winner === "monster"
    && gameState.run
    && Array.isArray(gameState.run.encounters)
    && gameState.run.encounters.length > 1;
  if (!isComplete && !isRunFailure) return "";
  const run = gameState.run ?? {};
  const cleared = isComplete ? run.encounters.length : (run.currentIndex ?? 0);
  const total = run.encounters?.length ?? 0;
  const cardsPicked = Object.values(run.runDeckAdds ?? {}).reduce((sum, arr) => sum + arr.length, 0);
  const relicCount = (run.relics ?? []).length;
  const relicNames = (run.relics ?? []).map((id) => getRelic(id)?.name).filter(Boolean).join(" · ");
  const eyebrow = isComplete ? "Run complete" : "Run failed";
  const title = isComplete ? "Every encounter cleared" : "The party fell";
  const themeClass = isComplete ? "is-victory" : "is-defeat";
  const buttonLabel = isComplete ? "Begin a new run" : "Try again";
  // Meta-progression: surface any milestone cards just unlocked.
  // `runUnlocks` is populated by recordRunComplete in handleClaimReward.
  const unlockBlock = (isComplete && runUnlocks && runUnlocks.length > 0)
    ? `<div class="run-complete-unlocks" role="status">
         <p class="run-complete-unlocks-eyebrow">✦ Unlocked for future runs</p>
         <ul class="run-complete-unlocks-list">
           ${runUnlocks.map((u) => `<li><strong>${escapeHtml(u.name)}</strong> — ${escapeHtml(u.classId)}</li>`).join("")}
         </ul>
       </div>`
    : "";
  return `
    <div class="run-complete-backdrop ${themeClass}" role="dialog" aria-modal="true" aria-label="${eyebrow}">
      <div class="run-complete-panel">
        <p class="run-complete-eyebrow">${escapeHtml(eyebrow)}</p>
        <h2 class="run-complete-title">${escapeHtml(title)}</h2>
        <p class="run-complete-stats">
          ${cleared} of ${total} encounter${total === 1 ? "" : "s"} cleared
          · ${run.crystals ?? 0} crystals
          · ${cardsPicked} card${cardsPicked === 1 ? "" : "s"} picked
          · ${relicCount} relic${relicCount === 1 ? "" : "s"}
        </p>
        ${relicNames ? `<p class="run-complete-relics">Relics: ${escapeHtml(relicNames)}</p>` : ""}
        ${unlockBlock}
        <button type="button" class="run-complete-button" data-action="new-game">${escapeHtml(buttonLabel)}</button>
      </div>
    </div>
  `;
}

// Deck viewer modal. Shows the cards in a player's deck as a flat
// scrollable grid grouped by role. Source decides what we show:
//   source === 'setup'  → the starter deck list for the picked class
//   source === 'combat' → the player's current deck = hand + deck +
//                         discard (every card still in the run)
// Click anywhere on the dim backdrop or the close button to dismiss.
function renderDeckViewer() {
  if (!deckViewer) return "";

  let cardIds = [];
  let title = "";
  let subtitle = "";
  let theme = "";

  if (deckViewer.source === "setup" && deckViewer.classId) {
    cardIds = starterDecks[deckViewer.classId] ?? [];
    const klass = classDefinitions[deckViewer.classId];
    title = klass ? `${klass.shortName} starter deck` : "Deck preview";
    subtitle = klass ? `${cardIds.length} cards · ${klass.role}` : `${cardIds.length} cards`;
    theme = `class-${deckViewer.classId}`;
  } else if (deckViewer.source === "combat" && deckViewer.playerId && gameState) {
    const player = gameState.players.find((p) => p.id === deckViewer.playerId);
    if (!player) return "";
    const collected = [
      ...(player.hand ?? []),
      ...(player.deck ?? []),
      ...(player.planned ?? []),
      ...(player.discard ?? []),
    ];
    cardIds = collected.map((c) => c.cardId);
    title = `${player.name}'s deck`;
    subtitle = `${cardIds.length} cards · ${player.hand.length} in hand · ${player.deck.length} in draw · ${player.discard.length} in discard`;
    theme = `class-${player.classId}`;
  } else {
    return "";
  }

  // Group by card.role so attacks / defends / heals etc. cluster together.
  const groups = new Map();
  for (const id of cardIds) {
    let card;
    try { card = getCardDefinition(id); } catch { continue; }
    const role = card.role ?? "other";
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(card);
  }
  // Stable role order
  const ROLE_ORDER = ["attack", "defense", "healing", "support", "unique"];
  const orderedGroups = ROLE_ORDER.filter((r) => groups.has(r))
    .concat([...groups.keys()].filter((r) => !ROLE_ORDER.includes(r)))
    .map((role) => [role, groups.get(role)]);

  const groupsMarkup = orderedGroups.map(([role, cards]) => {
    const roleLabel = formatRole(role);
    const cardItems = cards.map((c) => `
      <li class="deck-viewer-card class-${escapeHtml(c.classId)} role-${escapeHtml(c.role)}">
        <span class="deck-viewer-cost">${c.cost}</span>
        <span class="deck-viewer-name">${escapeHtml(c.name)}</span>
        <span class="deck-viewer-role">${escapeHtml(roleLabel)}</span>
        <span class="deck-viewer-text">${escapeHtml(c.text)}</span>
      </li>
    `).join("");
    return `
      <section class="deck-viewer-group">
        <h3 class="deck-viewer-group-head">
          <span class="deck-viewer-group-name">${escapeHtml(roleLabel)}</span>
          <span class="deck-viewer-group-count">${cards.length}</span>
        </h3>
        <ul class="deck-viewer-grid">${cardItems}</ul>
      </section>
    `;
  }).join("");

  return `
    <div class="deck-viewer-backdrop" role="dialog" aria-modal="true" aria-label="Deck viewer">
      <div class="deck-viewer-panel ${theme}">
        <header class="deck-viewer-head">
          <div>
            <p class="deck-viewer-eyebrow">Deck</p>
            <h2 class="deck-viewer-title">${escapeHtml(title)}</h2>
            <p class="deck-viewer-subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <button class="deck-viewer-close" type="button" data-action="close-deck-viewer" aria-label="Close deck viewer">×</button>
        </header>
        <div class="deck-viewer-body">${groupsMarkup}</div>
      </div>
    </div>
  `;
}

// Title splash — the first screen the player sees. Phase A skeleton:
// no parallax / particles yet (those land in Phase B/C per
// docs/menu-design.md). Just the title art, a slow-breathing
// "PRESS ANY KEY" prompt, and a background that uses the
// battlefield image until a dedicated splash painting arrives.
function renderSplash() {
  // Meta-progression banner — shown only after the player has any
  // play data on record. Quietly absent on a first boot so the title
  // doesn't read as "0 runs / 0 wins" before they've played.
  const meta = getMeta();
  const hasPlayed = (meta.runs?.started ?? 0)
    + (meta.runs?.completed ?? 0)
    + (meta.runs?.failed ?? 0)
    + (meta.fightsWon ?? 0) > 0;
  const statsLine = hasPlayed
    ? `<p class="title-splash-stats">${meta.runs.completed} runs cleared · ${meta.runs.failed} runs fallen · ${meta.fightsWon} fights won${meta.lastUnlock ? ` · last unlock: <strong>${escapeHtml(meta.lastUnlock.name)}</strong>` : ""}</p>`
    : "";
  return `
    <section class="title-splash ${splashLeaving ? "is-leaving" : ""}" data-screen="splash">
      <div class="title-splash-bg" aria-hidden="true"></div>
      <div class="title-splash-vignette" aria-hidden="true"></div>
      <canvas class="title-splash-embers" aria-hidden="true"></canvas>
      <div class="title-splash-content">
        <p class="title-splash-eyebrow">A co-op deck-building boss trial</p>
        <h1 class="title-splash-name">
          <span class="title-splash-line-1">The Fracture of</span>
          <span class="title-splash-line-2">AETHERFALL</span>
        </h1>
        <button
          class="title-splash-prompt"
          type="button"
          data-action="splash-advance"
          aria-label="Press any key to continue"
        >
          Press any key
        </button>
        ${statsLine}
      </div>
    </section>
  `;
}

// Vanilla canvas ember particles for the title splash. Spawns ~70
// warm-colored embers drifting upward from below the viewport, fades
// each one over its lifespan, recycles on death. No external deps,
// auto-terminates the moment the canvas leaves the DOM (which
// happens when render() rebuilds innerHTML for a non-splash screen).
function startSplashEmbers() {
  const canvas = document.querySelector(".title-splash-embers");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };
  resize();
  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  const COUNT = 70;
  const spawn = () => ({
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * canvas.height * 0.25,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -(0.25 + Math.random() * 0.65),
    size: 0.6 + Math.random() * 1.8,
    life: 0,
    maxLife: 220 + Math.random() * 240,
    hue: 18 + Math.random() * 24,
  });
  const embers = Array.from({ length: COUNT }, spawn);
  const frame = () => {
    // If the canvas was removed (splash unmounted), stop the loop.
    if (!document.body.contains(canvas)) {
      window.removeEventListener("resize", onResize);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      e.life += 1;
      e.x += e.vx * dpr;
      e.y += e.vy * dpr;
      e.vx += (Math.random() - 0.5) * 0.04;
      if (e.life > e.maxLife || e.y < -10) {
        embers[i] = spawn();
        continue;
      }
      const t = e.life / e.maxLife;
      const alpha = Math.sin(t * Math.PI) * 0.78;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * dpr, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${e.hue}, 92%, 62%, ${alpha})`;
      ctx.fill();
    }
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
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
        <div class="setup-run-length" role="group" aria-label="Run length">
          <span class="setup-deck-label">Run length</span>
          <div class="player-count-segment">
            ${[1, 3, 5, 7].map((n) => `
              <button
                type="button"
                class="player-count-pill ${setup.runLength === n ? "is-active" : ""}"
                data-action="set-run-length"
                data-run-length="${n}"
                aria-pressed="${setup.runLength === n ? "true" : "false"}"
                title="${n === 1 ? "Single fight (legacy)" : `${n}-encounter run`}"
              >${n === 1 ? "1×" : `${n}×`}</button>
            `).join("")}
          </div>
        </div>
        <label class="setup-encounter-selector">
          <span class="setup-deck-label">Choose first encounter</span>
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
      <button
        type="button"
        class="setup-preview-deck"
        data-action="open-deck-viewer"
        data-source="setup"
        data-class-id="${selectedClass.id}"
        title="Preview the cards in this starter deck"
      >Preview deck</button>
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
  const gameOver = gameState.phase === "game-over" || gameState.phase === "run-complete";
  const intent = MONSTER_INTENT_ENABLED ? computeMonsterIntent(gameState) : null;

  return `
    <section class="game-table standoff-table compact-ui ${DRAG_AND_DROP_ENABLED ? "" : "drag-disabled"}">
      ${renderLogCorner(gameState)}

      <div class="message-bar ${message ? "" : "is-empty"}">${message ? escapeHtml(message) : "&nbsp;"}</div>

      <div class="standoff-stage" data-stage>
        <svg class="standoff-tethers" data-tethers aria-hidden="true"></svg>

        <div class="standoff-monster ${(gameState.monsters?.length ?? 1) > 1 ? "multi" : ""} ${armedCard ? "armed" : ""}" data-target-zone="monster" data-monster-id="${gameState.monster.id}">
          ${renderMonsterIntent(intent)}
          ${renderMonsterRoster(gameState)}
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

      ${renderRoundSummary()}
      ${renderActionBar(gameState, totalQueued, gameOver)}

      <div class="standoff-drag-ghost" data-drag-ghost aria-hidden="true"></div>
    </section>
  `;
}

// Round summary toast — auto-shown for ROUND_SUMMARY_MS after each
// resolveRound. Compact card listing damage taken per player and
// damage dealt per monster (kills get a flag). Floats above the
// action bar so it's noticeable but doesn't block the play surface.
function renderRoundSummary() {
  if (!lastSummary) return "";
  const { round, players, monsters } = lastSummary;
  if (players.length === 0 && monsters.length === 0) return "";
  const playerLines = players.map((p) =>
    `<li class="round-summary-line class-${p.classId}">
       <span class="round-summary-name">${escapeHtml(p.name)}</span>
       <span class="round-summary-num round-summary-loss">−${p.lost}</span>
     </li>`).join("");
  const monsterLines = monsters.map((m) =>
    `<li class="round-summary-line ${m.killed ? "is-killed" : ""}">
       <span class="round-summary-name">${escapeHtml(m.name)}${m.killed ? " · slain" : ""}</span>
       <span class="round-summary-num round-summary-deal">−${m.dealt}</span>
     </li>`).join("");
  return `
    <aside class="round-summary" aria-live="polite">
      <header class="round-summary-head">
        <span class="round-summary-eyebrow">Round ${round} resolved</span>
      </header>
      ${players.length ? `<ul class="round-summary-list" data-side="players">
        <li class="round-summary-section">Damage taken</li>
        ${playerLines}
      </ul>` : ""}
      ${monsters.length ? `<ul class="round-summary-list" data-side="monsters">
        <li class="round-summary-section">Damage dealt</li>
        ${monsterLines}
      </ul>` : ""}
    </aside>
  `;
}

// Compact run-status section in the action bar — shows fight number,
// crystal count, and active relics. Only renders during a run.
function renderRunStatusSection(state) {
  const run = state.run;
  if (!run || !Array.isArray(run.encounters) || run.encounters.length <= 1) return "";
  const fightNum = (run.currentIndex ?? 0) + 1;
  const totalFights = run.encounters.length;
  const crystals = run.crystals ?? 0;
  const relics = run.relics ?? [];
  const relicChips = relics.map((id) => {
    const r = getRelic(id);
    if (!r) return "";
    return `<span class="ab-relic-chip" title="${escapeHtml(r.name)}: ${escapeHtml(r.description)}">${r.iconSvg ?? escapeHtml(r.icon ?? "✦")}</span>`;
  }).join("");
  return `
    <div class="ab-section ab-run" title="Run progress">
      <span class="ab-run-fight">Fight ${fightNum}/${totalFights}</span>
      <span class="ab-run-crystals" title="Crystals">◈ ${crystals}</span>
      ${relicChips ? `<span class="ab-run-relics" title="Relics in play">${relicChips}</span>` : ""}
    </div>
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
      ${renderRunStatusSection(state)}
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

// Render every monster in the encounter as an equal-sized figure +
// baseplate, side by side. Single-monster fights still center one
// figure; multi-monster encounters get a flex row of equal monsters.
// Each living monster is independently clickable when the target picker
// is armed.
function renderMonsterRoster(state) {
  const monsters = state.monsters ?? [state.monster];
  const isMulti = monsters.length > 1;
  const slots = monsters.map((monster) => {
    const armed = !!armedCard && monster.hp > 0;
    const dead = monster.hp <= 0 ? "is-dead" : "";
    const intent = MONSTER_INTENT_ENABLED ? computeMonsterIntentFor(state, monster) : null;
    return `
      <div class="monster-slot ${dead}">
        ${renderMonsterIntentChip(intent)}
        ${renderMonsterFigure(monster, { armedTarget: armed })}
        ${renderMonsterBaseplate(monster)}
      </div>
    `;
  }).join("");
  return `<div class="monster-roster ${isMulti ? "is-multi" : "is-solo"}">${slots}</div>`;
}

// Per-monster intent chip — Slay the Spire-style preview of the next
// attack. Shows damage tier (color), hit count, target with class
// color, and a "through block" hint when the hit would punch past
// the target's current block.
function renderMonsterIntentChip(intent) {
  if (!intent) return "";
  const targetPlayer = (gameState.players ?? []).find((p) => p.id === intent.targetId);
  const totalIncoming = intent.damage * intent.actions;
  // Damage tier — drives chip color. Single-hit damage thresholds:
  //   light  ≤ 3       (most basic attacks)
  //   medium 4-6       (mid-tier squad attacks)
  //   heavy  7-9       (named fixate attacks, finisher tier)
  //   critical 10+     (executes / boss windups)
  const tier = intent.damage >= 10 ? "critical"
    : intent.damage >= 7 ? "heavy"
    : intent.damage >= 4 ? "medium"
    : "light";
  // Block forecast — would the next hit punch through the target's
  // current block? Helpful at-a-glance for "do I need more block?".
  const targetBlock = targetPlayer?.block ?? 0;
  const willBreak = targetBlock > 0 && intent.damage > targetBlock;
  const blockHint = targetBlock > 0
    ? (willBreak ? "breaks block" : "blocked")
    : "";
  const titleLabel = intent.actions > 1
    ? `Next: ${intent.actions} × ${intent.damage} damage to ${intent.targetName}`
    : `Next attack: ${intent.damage} damage to ${intent.targetName}`;
  const classMod = targetPlayer ? `class-${targetPlayer.classId}` : "";
  return `
    <div class="monster-intent-chip tier-${tier} ${intent.isFixated ? "is-fixated" : ""}" title="${escapeHtml(titleLabel)}">
      <span class="intent-attack">
        <span class="intent-icon" aria-hidden="true">⚔</span>
        <strong class="intent-damage">${intent.damage}</strong>
        ${intent.actions > 1 ? `<span class="intent-multi" aria-label="${intent.actions} hits">×${intent.actions}</span>` : ""}
      </span>
      <span class="intent-arrow" aria-hidden="true">→</span>
      <span class="intent-target ${classMod}">
        <span class="intent-target-dot" aria-hidden="true"></span>
        <span class="intent-target-name">${escapeHtml(intent.targetName)}</span>
      </span>
      ${blockHint ? `<span class="intent-block-hint ${willBreak ? "is-break" : "is-blocked"}" aria-label="${blockHint}">${blockHint}</span>` : ""}
    </div>
  `;
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
  const defense = monster.defense ?? 0;
  const eyebrow = [monster.role, monster.faction].filter(Boolean).join(" · ");
  return `
    <div class="baseplate monster-baseplate">
      <div class="baseplate-head">
        <h2 class="baseplate-name">${escapeHtml(monster.name)}</h2>
        ${eyebrow ? `<span class="baseplate-eyebrow">${escapeHtml(eyebrow)}</span>` : ""}
      </div>
      <div class="stat-pill-row">
        <span class="stat-pill stat-hp" title="Hit points" data-hp-entity="monster:${escapeHtml(monster.monsterId ?? monster.name)}" data-hp-current="${monster.hp}">
          <span class="stat-icon" aria-hidden="true">${HP_ICON}</span>
          <span class="stat-bar"><em style="width: ${hpPercent}%"></em></span>
          <span class="stat-num">${monster.hp}/${monster.maxHp}</span>
        </span>
        ${defense > 0 ? `
          <span class="stat-pill stat-def" title="Defense (flat damage reduction)">
            <span class="stat-icon" aria-hidden="true">${DEF_ICON}</span>
            <span class="stat-num">${defense}</span>
          </span>` : ""}
      </div>
      ${renderMonsterStatLine(monster)}
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
  // DEF moved into the unified .stat-pill-row in renderMonsterBaseplate
  // (Phase 1 polish). This function now only surfaces multi-action /
  // phase context that doesn't fit a one-shot pill.
  const parts = [];
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
        <div class="baseplate-head">
          <h3 class="baseplate-name">${escapeHtml(player.name)}</h3>
          <span class="baseplate-eyebrow">${escapeHtml(classDef.role)}</span>
        </div>
        <div class="stat-pill-row">
          <span class="stat-pill stat-hp" title="Hit points" data-hp-entity="player:${escapeHtml(player.id)}" data-hp-current="${player.hp}">
            <span class="stat-icon" aria-hidden="true">${HP_ICON}</span>
            <span class="stat-bar"><em style="width: ${hpPercent}%"></em></span>
            <span class="stat-num">${player.hp}/${player.maxHp}</span>
          </span>
          <span class="stat-pill stat-energy" title="Energy">
            <span class="stat-icon" aria-hidden="true">${ENERGY_ICON}</span>
            <span class="stat-num">${remainingEnergy}/${player.energy}</span>
          </span>
          ${player.block > 0 ? `
            <span class="stat-pill stat-block" title="Block">
              <span class="stat-icon" aria-hidden="true">${BLOCK_ICON}</span>
              <span class="stat-num">${player.block}</span>
            </span>` : ""}
        </div>
        ${renderPlayerTokens(player)}
        ${renderPlayerBuffs(player)}
        <button
          type="button"
          class="champion-deck-button"
          data-action="open-deck-viewer"
          data-source="combat"
          data-player-id="${player.id}"
          aria-label="View ${escapeHtml(player.name)}'s deck"
          title="View deck"
        >
          <span class="champion-deck-button-icon" aria-hidden="true">▤</span>
          Deck (${(player.hand?.length ?? 0) + (player.deck?.length ?? 0) + (player.discard?.length ?? 0) + (player.planned?.length ?? 0)})
        </button>
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
  // Spend-preview: when this player has an armed card with a
  // spendToken rider, the matching token chip pulses so they can see
  // "this is the token that'll be consumed if I confirm".
  const armedSpendKey = getArmedSpendTokenKey(player);
  const chips = counts
    .filter(({ count }) => count > 0)
    .map(({ def, count }) => {
      const icon = getElementIcon(def.elementId, { title: def.label });
      const willSpend = armedSpendKey === def.key && count > 0;
      return `
        <span class="token-chip ${def.cls} ${willSpend ? "is-pending-spend" : ""}" title="${escapeHtml(def.title)}" aria-label="${escapeHtml(def.label)}: ${count}">
          <span class="token-chip-icon" aria-hidden="true">${icon}</span>
          <strong>${count}</strong>
        </span>
      `;
    });
  return `<div class="player-tokens" role="group" aria-label="Element tokens">${chips.join("")}</div>`;
}

// Returns the TOKEN_CHIP_DEFS.key (e.g. "stormCharge") matching a
// spendToken rider on the currently armed card if it belongs to this
// player. Drives the token-chip pulse so the player can see exactly
// which of their tokens will be consumed if they confirm the target.
function getArmedSpendTokenKey(player) {
  if (!armedCard || armedCard.playerId !== player.id) return null;
  let card;
  try { card = getCardDefinition(armedCard.cardId); } catch { return null; }
  for (const action of card.actions ?? []) {
    if (!action?.spendToken?.token) continue;
    const tokenName = action.spendToken.token;
    return tokenName === "bio-growth" ? "bioGrowth"
      : tokenName === "hydroflow" ? "hydroflow"
      : tokenName === "storm-charge" ? "stormCharge"
      : null;
  }
  return null;
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
  // Backward-compat wrapper — single intent for the primary monster.
  return computeMonsterIntentFor(state, state.monster);
}

// Predict which player a monster will hit this turn (pure read — does
// not mutate state). Used by the intent preview and by the Crossfire
// look-ahead so we can mirror the engine's actual resolution order.
function predictMonsterTargetFor(state, monster, livingPlayers) {
  if (!monster || monster.hp <= 0) return null;
  if (!livingPlayers.length) return null;
  const fixate = monster.fixate;
  if (fixate && fixate.roundsRemaining > 0) {
    const fixated = livingPlayers.find((p) => p.id === fixate.playerId);
    if (fixated) return fixated;
  }
  return [...livingPlayers].sort((a, b) => {
    const threatDiff = (monster.threat?.[b.id] ?? 0) - (monster.threat?.[a.id] ?? 0);
    if (threatDiff !== 0) return threatDiff;
    return a.hp - b.hp;
  })[0];
}

// Per-monster intent preview. Each living monster gets its own predicted
// target + damage so multi-monster encounters can show every threat
// upfront (Slay the Spire style). Mirrors the engine's target picker
// and effective-attack calc so what the player sees matches resolution.
function computeMonsterIntentFor(state, monster) {
  if (!monster || monster.hp <= 0) return null;
  const livingPlayers = state.players.filter((p) => p.hp > 0);
  if (!livingPlayers.length || state.phase === "game-over" || state.phase === "run-complete") {
    return null;
  }
  const target = predictMonsterTargetFor(state, monster, livingPlayers);
  if (!target) return null;
  const fixate = monster.fixate;
  // Mirror engine effectiveMonsterAttack split:
  //   packHunter — +1 while any squadmate alive
  //   crossfire  — +1 only if an earlier-turn squadmate is predicted to
  //                hit the same target (faithful "another monster hit
  //                this turn" rule)
  //   targetUplink — +1 from a separate living uplinker
  const others = (state.monsters ?? []).filter((m) => m !== monster && m.hp > 0);
  const abilities = monster.abilities ?? [];
  let abilityBonus = 0;
  if (abilities.includes("packHunter") && others.length > 0) {
    abilityBonus += 1;
  }
  if (abilities.includes("crossfire")) {
    const myPriority = monster.turnPriority ?? 0;
    const earlier = others.filter((m) => (m.turnPriority ?? 0) < myPriority);
    const sharesTarget = earlier.some((m) => {
      const t = predictMonsterTargetFor(state, m, livingPlayers);
      return t && t.id === target.id;
    });
    if (sharesTarget) abilityBonus += 1;
  }
  if (others.some((m) => (m.abilities ?? []).includes("targetUplink"))) {
    abilityBonus += 1;
  }
  const weakened = monster.statuses?.weakened ?? 0;
  let damage = Math.max(
    1,
    (monster.baseAttack ?? 0) + abilityBonus + Math.floor(state.roundNumber / 2) - weakened,
  );
  const isFixated = fixate && fixate.roundsRemaining > 0 && fixate.playerId === target.id;
  if (isFixated && typeof monster.fixateAttack === "number") {
    damage = monster.fixateAttack;
  }
  const actions = Math.max(1, monster.actionsPerTurn ?? 1);
  return {
    targetId: target.id,
    targetName: target.name,
    damage,
    actions,
    isFixated,
  };
}

function renderHandCard(player, cardInstance, cardIndex, totalCards, side) {
  const card = getCardDefinition(cardInstance.cardId);
  const remainingEnergy = getRemainingEnergy(player);
  const cannotAfford = remainingEnergy < card.cost || player.hp <= 0 || gameState.phase === "game-over" || gameState.phase === "run-complete";
  // Spread cards in a soft fan. Mirror angles for the right side so cards face inward.
  const fanCount = Math.max(1, totalCards);
  const center = (fanCount - 1) / 2;
  const offset = cardIndex - center;
  const baseRot = offset * 3; // degrees — was 5°, tightened in Phase 1 polish
  const baseLift = -Math.abs(offset) * 4;
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
