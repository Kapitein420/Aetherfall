// Meta-progression save layer. Persists across runs in localStorage
// (only sensible option for a static-site browser game). Counters
// are append-only; unlock flags flip true and never revert.
//
// Storage shape (key: META_KEY, version-tagged so we can migrate):
//   {
//     version: 1,
//     runs: { started, completed, failed },
//     fightsWon: number,
//     classesPlayed: { [classId]: count },
//     classesCompleted: { [classId]: true },  // any run-complete with this class
//     unlocks: { cards: { [cardId]: true } },
//     lastUnlock: { cardId, name, classId } | null  // most-recent for splash blurb
//   }
//
// Class-completion is the unlock trigger: finishing any run with a
// class unlocks that class's milestone card via milestonePools in
// content/cards.js. Subsequent runs see the milestone in the reward
// pool alongside the existing 6 reward-only cards.

const META_KEY = "aetherfall.meta.v1";

function defaultMeta() {
  return {
    version: 1,
    runs: { started: 0, completed: 0, failed: 0 },
    fightsWon: 0,
    classesPlayed: {},
    classesCompleted: {},
    unlocks: { cards: {} },
    lastUnlock: null,
  };
}

// Read once on module load and keep an in-memory mirror. All updates
// mutate the mirror and write back. Errors (private mode, quota,
// missing localStorage) degrade gracefully to an in-memory-only save.
let cached = null;

function safeRead() {
  if (typeof localStorage === "undefined") return defaultMeta();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    // Schema-guard: if version differs, drop and reset (we ship v1
    // first; future versions add a migrate() branch).
    if (!parsed || parsed.version !== 1) return defaultMeta();
    return { ...defaultMeta(), ...parsed };
  } catch {
    return defaultMeta();
  }
}

function safeWrite(meta) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Private mode / quota — silently keep working in-memory.
  }
}

export function getMeta() {
  if (!cached) cached = safeRead();
  return cached;
}

// Mutator helpers — each persists immediately. Keep them small +
// focused so callers describe intent ("a fight was won") rather
// than manipulating fields directly.

export function recordRunStart(classIds) {
  const m = getMeta();
  m.runs.started += 1;
  for (const id of classIds) {
    m.classesPlayed[id] = (m.classesPlayed[id] ?? 0) + 1;
  }
  safeWrite(m);
}

export function recordFightWin() {
  const m = getMeta();
  m.fightsWon += 1;
  safeWrite(m);
}

export function recordRunFailed() {
  const m = getMeta();
  m.runs.failed += 1;
  safeWrite(m);
}

// Run-complete is the unlock trigger. For every class the player ran
// this run, flip classesCompleted + unlock its milestone card (if a
// milestonePool entry exists for that class). Returns an array of
// newly-unlocked card defs so the run-complete screen can surface them.
export function recordRunComplete(classIds, milestonePools, cardDefinitions) {
  const m = getMeta();
  m.runs.completed += 1;
  const newlyUnlocked = [];
  for (const classId of classIds) {
    const wasFirstComplete = !m.classesCompleted[classId];
    m.classesCompleted[classId] = true;
    const milestoneIds = milestonePools[classId] ?? [];
    for (const cardId of milestoneIds) {
      if (m.unlocks.cards[cardId]) continue;
      m.unlocks.cards[cardId] = true;
      const def = cardDefinitions[cardId];
      if (def) {
        newlyUnlocked.push({ cardId, name: def.name, classId });
        m.lastUnlock = { cardId, name: def.name, classId };
      }
      // Only one milestone per class for v1; remaining entries
      // are reserved for future "second-clear" tiers.
      if (!wasFirstComplete) break;
    }
  }
  safeWrite(m);
  return newlyUnlocked;
}

// Read helper for roll filtering — does the player have access to
// this milestone card right now?
export function isCardUnlocked(cardId) {
  return !!getMeta().unlocks.cards[cardId];
}

// Diagnostics + a "wipe my save" affordance the title screen could
// invoke later. Resets to default + clears storage.
export function resetMeta() {
  cached = defaultMeta();
  if (typeof localStorage !== "undefined") {
    try { localStorage.removeItem(META_KEY); } catch { /* ignore */ }
  }
}
