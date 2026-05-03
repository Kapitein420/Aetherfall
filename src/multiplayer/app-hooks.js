// Glue between the app and the multiplayer sync layer. The goal is to keep
// the touchpoints inside `src/app.js` very small (it's being rewritten in
// parallel by a UI agent) by funneling all multiplayer plumbing through this
// module.

import {
  broadcastAction,
  broadcastState,
  getLocalPlayerSlot,
  isMultiplayerActive,
  onRemoteAction,
  onStateApply,
  onStateRequest,
} from "./sync.js";
import { mountConnectionUI } from "./connection-ui.js";

// While we apply an action that arrived from the network, we set this flag so
// the local broadcast helper bails out and we don't echo it back to the peer.
let applyingRemote = false;

// The host's UI is "player-1", the joiner's UI is "player-2". Either side
// can resolve the round (no slot lock).
function isOwnPlayerAction(action) {
  if (!action || typeof action !== "object") {
    return true;
  }
  const slot = getLocalPlayerSlot();
  if (!slot) {
    return true;
  }
  const targetPlayer = action.dataset?.playerId;
  if (!targetPlayer) {
    return true; // round-level actions like resolve-round / start-game / new-game
  }
  return targetPlayer === slot;
}

// Called by app.js after every successful local state mutation. We only
// broadcast if (a) MP is active, (b) we're not currently replaying a remote
// action, and (c) the action targets our own player slot (or is round-level).
export function broadcastLocalAction(action) {
  if (applyingRemote) {
    return;
  }
  if (!isMultiplayerActive()) {
    return;
  }
  if (!isOwnPlayerAction(action)) {
    return;
  }
  broadcastAction(action);
}

// Returns true while we're applying a remote action so the caller can guard
// against re-broadcast at finer granularity if needed.
export function isApplyingRemote() {
  return applyingRemote;
}

// Install the inbound action handler. The runner gets the action payload and
// is expected to apply it locally (e.g. by calling the same handleAction
// dispatcher app.js uses). We flip the `applyingRemote` flag so the broadcast
// helper above bails out during replay.
export function installMultiplayerHooks({ runAction, getState, applyState }) {
  mountConnectionUI();

  onRemoteAction((action) => {
    if (!action) {
      return;
    }
    applyingRemote = true;
    try {
      runAction(action);
    } catch (err) {
      console.error("[multiplayer] failed to apply remote action", err);
    } finally {
      applyingRemote = false;
    }
  });

  // Host: when a joiner asks for the current state, hand them a snapshot.
  onStateRequest(() => {
    try {
      return getState() ?? null;
    } catch (err) {
      console.error("[multiplayer] state provider threw", err);
      return null;
    }
  });

  // Joiner (or recovery): apply a snapshot pushed by the host.
  onStateApply((state) => {
    if (!state) {
      return;
    }
    applyingRemote = true;
    try {
      applyState(state);
    } catch (err) {
      console.error("[multiplayer] failed to apply remote state", err);
    } finally {
      applyingRemote = false;
    }
  });
}

// Called by app.js after start-game / resolveRound so the host pushes the
// fresh state to the joiner. No-op when not hosting.
export function pushSnapshotIfHost(state) {
  if (!isMultiplayerActive()) {
    return;
  }
  // Only the host should authoritatively push state. Joiner mutations stay
  // action-shaped to keep both sides deterministic.
  if (getLocalPlayerSlot() !== "player-1") {
    return;
  }
  if (!state) {
    return;
  }
  broadcastState(state);
}

export { getLocalPlayerSlot, isMultiplayerActive };
