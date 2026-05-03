// Thin wrapper around the global PeerJS instance loaded via CDN script tag.
// Keeps the rest of the codebase from touching the global directly so we can
// reason about PeerJS lifecycle (open / close / errors) in one place.

const ROOM_PREFIX = "aether";
const PEER_OPTIONS = { debug: 1 };

let activePeer = null;
let activeConnection = null;

function ensurePeerLibrary() {
  if (typeof window === "undefined" || typeof window.Peer !== "function") {
    throw new Error(
      "PeerJS library is not loaded. Make sure the script tag in index.html is present and the page is online.",
    );
  }
}

export function generateRoomCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${ROOM_PREFIX}-${code}`;
}

export function isRoomCode(value) {
  return typeof value === "string" && value.startsWith(`${ROOM_PREFIX}-`);
}

function destroyExistingPeer() {
  if (activeConnection) {
    try {
      activeConnection.close();
    } catch {
      // ignore
    }
    activeConnection = null;
  }
  if (activePeer) {
    try {
      activePeer.destroy();
    } catch {
      // ignore
    }
    activePeer = null;
  }
}

// Resolves with a Peer once it reports `open` (i.e. it has registered a peer
// id with the public broker and is ready to host or dial).
function createPeer(peerId) {
  ensurePeerLibrary();
  destroyExistingPeer();

  return new Promise((resolve, reject) => {
    let settled = false;
    const peer = peerId ? new window.Peer(peerId, PEER_OPTIONS) : new window.Peer(PEER_OPTIONS);

    const cleanupListeners = () => {
      peer.off("open", onOpen);
      peer.off("error", onError);
    };

    const onOpen = (id) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupListeners();
      activePeer = peer;
      resolve({ peer, id });
    };

    const onError = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanupListeners();
      try {
        peer.destroy();
      } catch {
        // ignore
      }
      reject(error);
    };

    peer.on("open", onOpen);
    peer.on("error", onError);
  });
}

// Host: register peer id == room code so joiners can address us by room code.
export async function hostPeer(roomCode) {
  const { peer, id } = await createPeer(roomCode);
  return { peer, peerId: id };
}

// Joiner: register an anonymous peer id, then dial the host's room code.
export async function joinPeer(roomCode) {
  const { peer, id } = await createPeer(null);
  return { peer, peerId: id, hostId: roomCode };
}

// Wait until the data channel is `open` (or fail). PeerJS data connections
// fire `open` once the underlying RTCDataChannel is ready for sends.
export function waitForConnectionOpen(connection, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    if (connection.open) {
      activeConnection = connection;
      resolve(connection);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Timed out waiting for the connection to open."));
    }, timeoutMs);

    const onOpen = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      activeConnection = connection;
      resolve(connection);
    };

    const onError = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onClose = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new Error("Connection closed before opening."));
    };

    function cleanup() {
      clearTimeout(timer);
      connection.off("open", onOpen);
      connection.off("error", onError);
      connection.off("close", onClose);
    }

    connection.on("open", onOpen);
    connection.on("error", onError);
    connection.on("close", onClose);
  });
}

export function setActiveConnection(connection) {
  activeConnection = connection;
}

export function getActiveConnection() {
  return activeConnection;
}

export function getActivePeer() {
  return activePeer;
}

export function teardown() {
  destroyExistingPeer();
}
