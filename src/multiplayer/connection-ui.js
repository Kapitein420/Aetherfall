// Multiplayer connection UI. Renders a small floating panel in the top-right
// of the page so it survives full re-renders of the main #app element. The
// panel exposes Host / Join controls and surfaces the current connection
// status. URL params: `?room=aether-xxxxx` triggers an auto-join on load.

import {
  disconnect,
  getConnectionStatus,
  hostGame,
  joinGame,
  onStatusChange,
} from "./sync.js";
import { isRoomCode } from "./peer.js";

const PANEL_ID = "multiplayer-panel";
const ROOT_ID = "multiplayer-root";

let mounted = false;
let rootEl = null;
let unsubscribeStatus = null;

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

function buildShareUrl(roomCode) {
  if (typeof window === "undefined" || !roomCode) {
    return "";
  }
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomCode);
  url.hash = "";
  return url.toString();
}

function renderPanel(status) {
  const { state, roomCode, error } = status;
  const shareUrl = roomCode ? buildShareUrl(roomCode) : "";
  const slot = state === "connected"
    ? roomCode
      ? "Player 1 (host)"
      : "Player 2 (joined)"
    : null;

  let body = "";

  if (state === "idle" || state === "error") {
    body += `
      <div class="mp-row">
        <button type="button" class="mp-btn mp-btn-primary" data-mp-action="host">Host game</button>
        <button type="button" class="mp-btn" data-mp-action="join-prompt">Join via code</button>
      </div>
      <p class="mp-hint">Share the link with a friend after hosting.</p>
    `;
    if (state === "error" && error) {
      body += `<p class="mp-error">${escapeHtml(error)}</p>`;
    }
  } else if (state === "hosting") {
    body += `
      <div class="mp-row">
        <span class="mp-pill mp-pill-warn">Waiting for friend...</span>
      </div>
    `;
    if (roomCode) {
      body += `
        <div class="mp-room">
          <span class="mp-room-label">Room code</span>
          <code class="mp-room-code">${escapeHtml(roomCode)}</code>
        </div>
        <div class="mp-row">
          <button type="button" class="mp-btn" data-mp-action="copy-link" data-mp-payload="${escapeHtml(shareUrl)}">Copy invite link</button>
          <button type="button" class="mp-btn mp-btn-ghost" data-mp-action="disconnect">Cancel</button>
        </div>
      `;
    }
  } else if (state === "joining") {
    body += `
      <div class="mp-row">
        <span class="mp-pill mp-pill-warn">Joining ${escapeHtml(roomCode ?? "")}...</span>
      </div>
      <div class="mp-row">
        <button type="button" class="mp-btn mp-btn-ghost" data-mp-action="disconnect">Cancel</button>
      </div>
    `;
  } else if (state === "connected") {
    body += `
      <div class="mp-row">
        <span class="mp-pill mp-pill-good">Connected${slot ? ` - ${escapeHtml(slot)}` : ""}</span>
      </div>
      ${roomCode ? `<div class="mp-room"><span class="mp-room-label">Room</span><code class="mp-room-code">${escapeHtml(roomCode)}</code></div>` : ""}
      <div class="mp-row">
        ${roomCode ? `<button type="button" class="mp-btn" data-mp-action="copy-link" data-mp-payload="${escapeHtml(shareUrl)}">Copy invite link</button>` : ""}
        <button type="button" class="mp-btn mp-btn-ghost" data-mp-action="disconnect">Disconnect</button>
      </div>
    `;
  }

  return `
    <section id="${PANEL_ID}" class="mp-panel mp-state-${escapeHtml(state)}" aria-live="polite">
      <header class="mp-header">
        <span class="mp-title">Multiplayer</span>
        <span class="mp-state-badge">${escapeHtml(state)}</span>
      </header>
      ${body}
    </section>
  `;
}

function ensureRoot() {
  if (rootEl) {
    return rootEl;
  }
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ROOT_ID;
    document.body.appendChild(el);
  }
  rootEl = el;
  return rootEl;
}

function update(status) {
  const root = ensureRoot();
  root.innerHTML = renderPanel(status);
}

async function copyText(text) {
  if (!text) {
    return false;
  }
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function showFlash(message) {
  const root = ensureRoot();
  const panel = root.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    return;
  }
  let flash = panel.querySelector(".mp-flash");
  if (!flash) {
    flash = document.createElement("p");
    flash.className = "mp-flash";
    panel.appendChild(flash);
  }
  flash.textContent = message;
  setTimeout(() => {
    if (flash && flash.parentElement) {
      flash.parentElement.removeChild(flash);
    }
  }, 2000);
}

async function handleClick(event) {
  const button = event.target.closest("[data-mp-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.mpAction;

  if (action === "host") {
    try {
      await hostGame();
    } catch (err) {
      console.error("[multiplayer] host failed", err);
    }
    return;
  }

  if (action === "join-prompt") {
    const code = window.prompt("Enter room code (e.g. aether-7k3m9):");
    if (!code) {
      return;
    }
    const trimmed = code.trim();
    if (!isRoomCode(trimmed)) {
      window.alert("That doesn't look like a room code. Codes start with 'aether-'.");
      return;
    }
    try {
      await joinGame(trimmed);
    } catch (err) {
      console.error("[multiplayer] join failed", err);
    }
    return;
  }

  if (action === "copy-link") {
    const ok = await copyText(button.dataset.mpPayload ?? "");
    showFlash(ok ? "Invite link copied" : "Copy failed - copy manually");
    return;
  }

  if (action === "disconnect") {
    disconnect();
  }
}

function maybeAutoJoin() {
  if (typeof window === "undefined") {
    return;
  }
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const room = params.get("room");
  if (!room || !isRoomCode(room)) {
    return;
  }
  // Defer slightly so the panel renders the "joining..." state first.
  setTimeout(() => {
    joinGame(room).catch((err) => {
      console.error("[multiplayer] auto-join failed", err);
    });
  }, 50);
}

export function mountConnectionUI() {
  if (mounted) {
    return;
  }
  mounted = true;

  const root = ensureRoot();
  root.addEventListener("click", handleClick);

  // Render once with current status, then keep up to date.
  update(getConnectionStatus());
  unsubscribeStatus = onStatusChange((status) => update(status));

  maybeAutoJoin();
}

export function unmountConnectionUI() {
  if (!mounted) {
    return;
  }
  mounted = false;
  if (unsubscribeStatus) {
    unsubscribeStatus();
    unsubscribeStatus = null;
  }
  if (rootEl) {
    rootEl.removeEventListener("click", handleClick);
    rootEl.innerHTML = "";
  }
}
