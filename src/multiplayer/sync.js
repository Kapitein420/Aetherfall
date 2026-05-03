// Public multiplayer API. Other parts of the app should only import from this
// module. It owns the PeerJS connection lifecycle and the broadcast/apply
// semantics; the engine itself remains pure and unaware of the network.

import {
  generateRoomCode,
  hostPeer,
  joinPeer,
  setActiveConnection,
  teardown,
  waitForConnectionOpen,
} from "./peer.js";

const PING_INTERVAL_MS = 8_000;

const status = {
  state: "idle", // 'idle' | 'hosting' | 'joining' | 'connected' | 'error'
  roomCode: null,
  peerId: null,
  remotePeerId: null,
  error: null,
  latencyMs: null,
};

let connection = null;
let role = "solo"; // 'solo' | 'host' | 'joiner'
let outgoingSeq = 0;
let lastSeenRemoteSeq = 0;

const remoteActionHandlers = new Set();
const stateRequestHandlers = new Set(); // host fulfils these to send a state snapshot
const stateApplyHandlers = new Set(); // joiner uses these to apply incoming snapshots
const statusListeners = new Set();

let pingTimer = null;
let lastPingSentAt = 0;

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function setStatus(patch) {
  Object.assign(status, patch);
  for (const listener of statusListeners) {
    try {
      listener({ ...status });
    } catch (err) {
      console.error("[multiplayer] status listener error", err);
    }
  }
}

export function getConnectionStatus() {
  return { ...status };
}

export function onStatusChange(handler) {
  statusListeners.add(handler);
  // Fire once with current snapshot so subscribers can render immediately.
  try {
    handler({ ...status });
  } catch (err) {
    console.error("[multiplayer] status listener error", err);
  }
  return () => statusListeners.delete(handler);
}

export function isMultiplayerActive() {
  return status.state === "connected";
}

export function getLocalPlayerSlot() {
  if (role === "host") {
    return "player-1";
  }
  if (role === "joiner") {
    return "player-2";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Listener registration
// ---------------------------------------------------------------------------

export function onRemoteAction(handler) {
  remoteActionHandlers.add(handler);
  return () => remoteActionHandlers.delete(handler);
}

// Host registers this so we can answer `state-request` from a freshly joined
// peer. Returning null/undefined means "no state to send yet".
export function onStateRequest(provider) {
  stateRequestHandlers.add(provider);
  return () => stateRequestHandlers.delete(provider);
}

// Joiner registers this so we can apply a full snapshot pushed by the host
// (initial sync or post-desync recovery).
export function onStateApply(handler) {
  stateApplyHandlers.add(handler);
  return () => stateApplyHandlers.delete(handler);
}

// ---------------------------------------------------------------------------
// Broadcast / apply
// ---------------------------------------------------------------------------

export function broadcastAction(action) {
  if (!connection || !connection.open) {
    return;
  }
  outgoingSeq += 1;
  const payload = { type: "action", action, seq: outgoingSeq };
  safeSend(payload);
}

// Used by the host to push a full snapshot (initial sync + recovery).
export function broadcastState(state) {
  if (!connection || !connection.open) {
    return;
  }
  outgoingSeq += 1;
  const payload = { type: "state", state, seq: outgoingSeq };
  safeSend(payload);
}

function safeSend(payload) {
  try {
    connection.send(payload);
  } catch (err) {
    console.error("[multiplayer] send failed", err);
    setStatus({ state: "error", error: "Failed to send to peer." });
  }
}

// Notify remote-action handlers without re-broadcasting. Handlers are
// responsible for guarding against re-entry via their own flag.
function deliverRemoteAction(action) {
  for (const handler of remoteActionHandlers) {
    try {
      handler(action);
    } catch (err) {
      console.error("[multiplayer] remote action handler error", err);
    }
  }
}

function deliverStateApply(state) {
  for (const handler of stateApplyHandlers) {
    try {
      handler(state);
    } catch (err) {
      console.error("[multiplayer] state apply handler error", err);
    }
  }
}

function fulfilStateRequest() {
  for (const provider of stateRequestHandlers) {
    let snapshot;
    try {
      snapshot = provider();
    } catch (err) {
      console.error("[multiplayer] state provider error", err);
      continue;
    }
    if (snapshot) {
      broadcastState(snapshot);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Wire protocol
// ---------------------------------------------------------------------------

function handleIncomingMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "ping") {
    safeSend({ type: "pong", t: message.t });
    return;
  }

  if (message.type === "pong") {
    if (typeof message.t === "number") {
      const latency = Date.now() - message.t;
      if (Number.isFinite(latency) && latency >= 0) {
        setStatus({ latencyMs: latency });
      }
    }
    return;
  }

  if (message.type === "state-request") {
    if (role === "host") {
      fulfilStateRequest();
    }
    return;
  }

  if (message.type === "state") {
    if (typeof message.seq === "number") {
      lastSeenRemoteSeq = message.seq;
    }
    if (message.state) {
      deliverStateApply(message.state);
    }
    return;
  }

  if (message.type === "action") {
    if (typeof message.seq === "number") {
      // Detect gaps. If we missed an action, request a full state resync from
      // the host so we don't drift.
      const expected = lastSeenRemoteSeq + 1;
      if (lastSeenRemoteSeq > 0 && message.seq !== expected) {
        console.warn(
          `[multiplayer] sequence gap: expected ${expected}, got ${message.seq}. Requesting resync.`,
        );
        if (role === "joiner") {
          safeSend({ type: "state-request" });
        }
      }
      lastSeenRemoteSeq = message.seq;
    }
    if (message.action) {
      deliverRemoteAction(message.action);
    }
  }
}

function startKeepalive() {
  stopKeepalive();
  pingTimer = setInterval(() => {
    if (!connection || !connection.open) {
      return;
    }
    lastPingSentAt = Date.now();
    safeSend({ type: "ping", t: lastPingSentAt });
  }, PING_INTERVAL_MS);
}

function stopKeepalive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

function attachConnectionListeners(conn) {
  conn.on("data", handleIncomingMessage);
  conn.on("close", () => {
    stopKeepalive();
    connection = null;
    setStatus({ state: "error", error: "Connection closed.", remotePeerId: null });
  });
  conn.on("error", (error) => {
    console.error("[multiplayer] connection error", error);
    setStatus({ state: "error", error: error?.message ?? "Connection error." });
  });
}

export async function hostGame() {
  // Reset any previous session.
  disconnectInternal({ silent: true });

  const roomCode = generateRoomCode();
  setStatus({
    state: "hosting",
    roomCode,
    peerId: null,
    remotePeerId: null,
    error: null,
    latencyMs: null,
  });
  role = "host";
  outgoingSeq = 0;
  lastSeenRemoteSeq = 0;

  try {
    const { peer, peerId } = await hostPeer(roomCode);
    setStatus({ peerId });

    peer.on("connection", (incoming) => {
      // Reject additional joiners while we already have one.
      if (connection && connection.open) {
        try {
          incoming.close();
        } catch {
          // ignore
        }
        return;
      }
      attachConnectionListeners(incoming);
      incoming.on("open", () => {
        connection = incoming;
        setActiveConnection(incoming);
        setStatus({
          state: "connected",
          remotePeerId: incoming.peer,
          error: null,
        });
        startKeepalive();
        // Push initial state to the joiner so they're caught up.
        fulfilStateRequest();
      });
    });

    peer.on("error", (error) => {
      console.error("[multiplayer] peer error", error);
      setStatus({ state: "error", error: error?.message ?? "PeerJS error." });
    });

    peer.on("disconnected", () => {
      // PeerJS lost the broker connection but the data channel may still be up.
      // Try to reconnect to the broker so future joiners can find us.
      try {
        peer.reconnect();
      } catch {
        // ignore
      }
    });

    return roomCode;
  } catch (error) {
    console.error("[multiplayer] hostGame failed", error);
    setStatus({ state: "error", error: error?.message ?? "Could not host game." });
    role = "solo";
    throw error;
  }
}

export async function joinGame(roomCode) {
  if (!roomCode) {
    throw new Error("A room code is required to join.");
  }

  disconnectInternal({ silent: true });

  setStatus({
    state: "joining",
    roomCode,
    peerId: null,
    remotePeerId: null,
    error: null,
    latencyMs: null,
  });
  role = "joiner";
  outgoingSeq = 0;
  lastSeenRemoteSeq = 0;

  try {
    const { peer, peerId, hostId } = await joinPeer(roomCode);
    setStatus({ peerId });

    peer.on("error", (error) => {
      console.error("[multiplayer] peer error", error);
      setStatus({ state: "error", error: error?.message ?? "PeerJS error." });
    });

    const conn = peer.connect(hostId, {
      reliable: true,
      serialization: "json",
      metadata: { role: "joiner" },
    });
    attachConnectionListeners(conn);
    await waitForConnectionOpen(conn);

    connection = conn;
    setActiveConnection(conn);
    setStatus({
      state: "connected",
      remotePeerId: conn.peer,
      error: null,
    });
    startKeepalive();
    // Ask the host for the current state immediately.
    safeSend({ type: "state-request" });
  } catch (error) {
    console.error("[multiplayer] joinGame failed", error);
    setStatus({ state: "error", error: error?.message ?? "Could not join game." });
    role = "solo";
    throw error;
  }
}

function disconnectInternal({ silent = false } = {}) {
  stopKeepalive();
  if (connection) {
    try {
      connection.close();
    } catch {
      // ignore
    }
  }
  connection = null;
  teardown();
  outgoingSeq = 0;
  lastSeenRemoteSeq = 0;
  role = "solo";
  if (!silent) {
    setStatus({
      state: "idle",
      roomCode: null,
      peerId: null,
      remotePeerId: null,
      error: null,
      latencyMs: null,
    });
  }
}

export function disconnect() {
  disconnectInternal({ silent: false });
}
