// Pointer-events drag-to-target system for Aetherfall hand cards.
//
// Click-to-queue still works (handled by the regular click listener in app.js).
// This adds a parallel pointer interaction that lets the player flick a card
// onto the monster, an ally, themself, or the play-zone fallback.
//
// Engine impact is zero — we still call the same queue-card action; the
// implicit-target rules already encoded on each card decide where it lands.

import { getCardDefinition } from "../content/cards.js";
import { targetKey } from "../engine/game.js";

const DRAG_THRESHOLD_PX = 6;
const SNAP_BACK_MS = 240;

let api = null;
let pointerListenersAttached = false;
let resizeAttached = false;

let activeDrag = null;
let suppressNextClick = false;

export function initDragSystem(opts) {
  api = opts;
  attachListenersOnce();
  refreshDragSystem();
}

export function refreshDragSystem() {
  if (!api) {
    return;
  }
  // Nothing to do — pointerdown is delegated on the document, so it picks up
  // any new hand cards automatically. We just clear stale state.
  if (activeDrag) {
    abortDrag(activeDrag, { snap: false });
  }
}

export function teardownDragSystem() {
  if (activeDrag) {
    abortDrag(activeDrag, { snap: false });
  }
  api = null;
  // Listeners stay attached but become inert when api is null.
}

function attachListenersOnce() {
  if (pointerListenersAttached) {
    return;
  }
  pointerListenersAttached = true;

  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("pointermove", onPointerMove, { passive: false });
  document.addEventListener("pointerup", onPointerUp, { passive: false });
  document.addEventListener("pointercancel", onPointerCancel, { passive: false });
  // Suppress the synthetic click that fires after a successful drag, so
  // we don't double-queue the card when the click delegate also fires.
  document.addEventListener(
    "click",
    (event) => {
      if (suppressNextClick) {
        suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  if (!resizeAttached) {
    resizeAttached = true;
    window.addEventListener("resize", () => {
      if (activeDrag) {
        abortDrag(activeDrag, { snap: false });
      }
    });
  }
}

function onPointerDown(event) {
  if (!api || event.button > 0) {
    return;
  }
  // Only react to a primary press on a hand card.
  const card = event.target.closest(".hand-card[data-action='queue-card']");
  if (!card) {
    return;
  }
  if (card.disabled || card.classList.contains("unplayable")) {
    return;
  }

  const playerId = card.dataset.playerId;
  const instanceId = card.dataset.instanceId;
  const cardId = card.dataset.cardId;
  const cardDef = cardId ? safeGetCard(cardId) : null;
  const role = cardDef ? cardDef.role : card.dataset.cardRole;

  const validTargets = computeValidTargets(playerId, role, cardDef);
  if (!validTargets.length) {
    // Card has nowhere to go — let click handler take it.
    return;
  }

  const rect = card.getBoundingClientRect();
  activeDrag = {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    card,
    playerId,
    instanceId,
    cardId,
    cardDef,
    role,
    validTargets,
    startX: event.clientX,
    startY: event.clientY,
    cardOrigin: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    armed: false,
    ghost: null,
    arrow: null,
    arrowSvg: null,
    overTarget: null,
  };

  try {
    card.setPointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture can fail in some environments — proceed without it.
  }
}

function onPointerMove(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const dx = event.clientX - activeDrag.startX;
  const dy = event.clientY - activeDrag.startY;

  if (!activeDrag.armed) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
      return;
    }
    armDrag(activeDrag);
  }

  event.preventDefault();
  updateGhostPosition(activeDrag, event);
  updateArrowPath(activeDrag, event);
  updateHoverTarget(activeDrag, event);
}

function onPointerUp(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }

  const drag = activeDrag;
  activeDrag = null;

  try {
    drag.card.releasePointerCapture(event.pointerId);
  } catch (error) {
    /* noop */
  }

  if (!drag.armed) {
    // Treat as a tap: defer to click handler. Just clean up visuals.
    cleanupVisuals(drag);
    return;
  }

  event.preventDefault();
  const target = drag.overTarget;
  const validTarget = target && target.valid;

  if (validTarget) {
    // Hide ghost first so it doesn't flicker mid-rerender.
    cleanupVisuals(drag);
    suppressNextClick = true;
    api.invokeAction({
      action: "queue-card",
      playerId: drag.playerId,
      instanceId: drag.instanceId,
    });
  } else {
    suppressNextClick = true;
    snapBack(drag);
  }
}

function onPointerCancel(event) {
  if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
    return;
  }
  const drag = activeDrag;
  activeDrag = null;
  abortDrag(drag, { snap: false });
}

function armDrag(drag) {
  drag.armed = true;
  document.body.classList.add("dragging-card");
  document.body.dataset.dragRole = drag.role || "";

  drag.card.classList.add("being-dragged");
  highlightValidTargets(drag, true);

  // Build ghost element from a clone of the card's visible HTML (for fidelity).
  const ghostHost = document.querySelector("[data-drag-ghost]");
  if (ghostHost) {
    ghostHost.innerHTML = drag.card.outerHTML;
    const ghost = ghostHost.firstElementChild;
    if (ghost) {
      ghost.removeAttribute("data-action");
      ghost.removeAttribute("disabled");
      ghost.classList.add("drag-ghost-card");
      ghost.classList.remove("being-dragged");
      drag.ghost = ghost;
      ghostHost.style.display = "block";
    }
  }

  // Build arrow svg overlay.
  const tetherHost = document.querySelector("[data-tethers]");
  if (tetherHost) {
    drag.arrowSvg = tetherHost;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("drag-arrow");
    path.setAttribute("data-drag-arrow", "1");
    tetherHost.appendChild(path);
    drag.arrow = path;
  }
}

function updateGhostPosition(drag, event) {
  if (!drag.ghost) {
    return;
  }
  const ghostHost = drag.ghost.parentElement;
  if (!ghostHost) {
    return;
  }
  // Touch-friendly offset: lift card 80px above the finger so it isn't hidden.
  const yOffset = drag.pointerType === "touch" ? -80 : -10;
  const ghostRect = drag.ghost.getBoundingClientRect();
  const half = ghostRect.width / 2 || drag.cardOrigin.width / 2;
  ghostHost.style.left = `${event.clientX - half}px`;
  ghostHost.style.top = `${event.clientY - ghostRect.height + yOffset}px`;
}

function updateArrowPath(drag, event) {
  if (!drag.arrow || !drag.arrowSvg) {
    return;
  }
  const stage = document.querySelector("[data-stage]");
  if (!stage) {
    return;
  }
  const stageRect = stage.getBoundingClientRect();
  // Origin: the card's hand position center.
  const cardRect = drag.card.getBoundingClientRect();
  const ox = cardRect.left + cardRect.width / 2 - stageRect.left;
  const oy = cardRect.top + cardRect.height / 2 - stageRect.top;
  const tx = event.clientX - stageRect.left;
  const ty = event.clientY - stageRect.top;
  // Cubic bezier with control points biased upward (Hearthstone-like).
  const midX = (ox + tx) / 2;
  const liftY = Math.min(oy, ty) - 120;
  const c1x = ox;
  const c1y = liftY;
  const c2x = midX;
  const c2y = liftY;
  drag.arrow.setAttribute(
    "d",
    `M ${ox} ${oy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`,
  );
}

function updateHoverTarget(drag, event) {
  // Hide ghost so elementFromPoint doesn't return it.
  let ghostDisplay = "";
  if (drag.ghost) {
    ghostDisplay = drag.ghost.style.display;
    drag.ghost.style.visibility = "hidden";
  }
  const elementUnder = document.elementFromPoint(event.clientX, event.clientY);
  if (drag.ghost) {
    drag.ghost.style.visibility = "";
  }

  let targetEl = elementUnder ? elementUnder.closest("[data-target-zone]") : null;
  if (!targetEl) {
    setOverTarget(drag, null);
    return;
  }

  const targetInfo = describeTarget(targetEl);
  if (!targetInfo) {
    setOverTarget(drag, null);
    return;
  }

  const valid = isValidTarget(drag, targetInfo);
  setOverTarget(drag, { el: targetEl, info: targetInfo, valid });
}

function setOverTarget(drag, next) {
  if (drag.overTarget && drag.overTarget.el && drag.overTarget.el !== (next && next.el)) {
    drag.overTarget.el.classList.remove("hover-valid", "hover-invalid");
  }
  drag.overTarget = next;
  if (next && next.el) {
    next.el.classList.toggle("hover-valid", !!next.valid);
    next.el.classList.toggle("hover-invalid", !next.valid);
  }
}

function describeTarget(el) {
  const zone = el.dataset.targetZone;
  if (!zone) {
    return null;
  }
  if (zone === "monster") {
    return { kind: "monster" };
  }
  if (zone === "player") {
    return { kind: "player", playerId: el.dataset.playerId };
  }
  if (zone === "play-zone") {
    return { kind: "play-zone" };
  }
  return null;
}

function isValidTarget(drag, info) {
  if (!drag.validTargets.length) {
    return false;
  }
  for (const candidate of drag.validTargets) {
    if (candidate.kind !== info.kind) {
      continue;
    }
    if (candidate.kind === "player" && candidate.playerId !== info.playerId) {
      continue;
    }
    return true;
  }
  return false;
}

function computeValidTargets(playerId, role, cardDef) {
  const state = api && api.getState ? api.getState() : null;
  if (!state) {
    return [{ kind: "play-zone" }];
  }
  const targets = [{ kind: "play-zone" }];

  // Always allow self-target on the player who owns the card.
  targets.push({ kind: "player", playerId });

  if (role === "attack" || role === "unique") {
    targets.push({ kind: "monster" });
  }

  // Heals/buffs: any ally is a valid target for visual purposes.
  if (role === "healing" || role === "support" || role === "defense") {
    for (const player of state.players) {
      if (player.id !== playerId && player.hp > 0) {
        targets.push({ kind: "player", playerId: player.id });
      }
    }
  }

  // Unique cards may also touch allies, allow them as valid drops.
  if (role === "unique") {
    for (const player of state.players) {
      if (player.id !== playerId && player.hp > 0) {
        targets.push({ kind: "player", playerId: player.id });
      }
    }
  }

  // Inspect actions to be more precise where possible.
  if (cardDef && Array.isArray(cardDef.actions)) {
    for (const action of cardDef.actions) {
      if (action.target === "ally" || action.target === "all" || action.target === "lowest") {
        for (const player of state.players) {
          if (player.id !== playerId && player.hp > 0) {
            targets.push({ kind: "player", playerId: player.id });
          }
        }
      }
    }
  }

  // De-dupe.
  const seen = new Set();
  return targets.filter((t) => {
    const key = `${t.kind}:${t.playerId ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function highlightValidTargets(drag, on) {
  const allZones = document.querySelectorAll("[data-target-zone]");
  for (const zone of allZones) {
    const info = describeTarget(zone);
    const valid = info ? isValidTarget(drag, info) : false;
    zone.classList.toggle("targetable-valid", on && valid);
    zone.classList.toggle("targetable-invalid", on && !valid);
  }
}

function clearHighlights() {
  const allZones = document.querySelectorAll("[data-target-zone]");
  for (const zone of allZones) {
    zone.classList.remove("targetable-valid", "targetable-invalid", "hover-valid", "hover-invalid");
  }
}

function snapBack(drag) {
  if (!drag.ghost) {
    cleanupVisuals(drag);
    return;
  }
  const target = drag.cardOrigin;
  const ghostHost = drag.ghost.parentElement;
  if (!ghostHost) {
    cleanupVisuals(drag);
    return;
  }

  ghostHost.style.transition = `left ${SNAP_BACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${SNAP_BACK_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease-out`;
  ghostHost.style.left = `${target.x}px`;
  ghostHost.style.top = `${target.y}px`;
  ghostHost.style.opacity = "0";

  window.setTimeout(() => {
    cleanupVisuals(drag);
  }, SNAP_BACK_MS + 60);
}

function cleanupVisuals(drag) {
  document.body.classList.remove("dragging-card");
  delete document.body.dataset.dragRole;
  if (drag && drag.card) {
    drag.card.classList.remove("being-dragged");
  }
  if (drag && drag.ghost && drag.ghost.parentElement) {
    drag.ghost.parentElement.innerHTML = "";
    drag.ghost.parentElement.style.cssText = "";
  }
  if (drag && drag.arrow && drag.arrow.parentElement) {
    drag.arrow.parentElement.removeChild(drag.arrow);
  }
  clearHighlights();
}

function abortDrag(drag, { snap }) {
  if (snap && drag.armed) {
    snapBack(drag);
  } else {
    cleanupVisuals(drag);
  }
}

function safeGetCard(cardId) {
  try {
    return getCardDefinition(cardId);
  } catch (error) {
    return null;
  }
}
