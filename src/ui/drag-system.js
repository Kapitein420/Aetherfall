// Pointer-events drag-to-target system for Aetherfall hand cards.
//
// Phase 1 ships the new layout but keeps interaction click-only. The full
// pointer logic is filled in during Phase 2. These exports are no-ops so
// app.js can import them unconditionally and still ship a playable site.

export function initDragSystem() {
  // Phase 2 will register pointer listeners and ghost rendering here.
}

export function refreshDragSystem() {
  // Phase 2 will reset hover/highlight state on each rerender.
}

export function teardownDragSystem() {
  // Phase 2 will detach pointer listeners on game-over / new-game.
}
