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

// Per-field validation of the deserialised payload. localStorage is
// trivially writable by extensions / devtools / shared-device users,
// so we never trust the structure — only pull each field through a
// type-shaped guard. Anything that fails its check falls back to the
// default. Prevents prototype-pollution-via-spread and prevents a
// junk shape (e.g. `unlocks: "oops"`) from crashing the consumer.
function safeRead() {
  if (typeof localStorage === "undefined") return defaultMeta();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) return defaultMeta();
    const def = defaultMeta();
    const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
    const num = (v, fallback = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0) ? v : fallback;
    const bool = (v) => v === true;
    const strMap = (obj, predicate) => {
      if (!isObj(obj)) return {};
      const out = {};
      for (const key of Object.keys(obj)) {
        // Drop dangerous keys outright; coerce values through predicate.
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (typeof key !== "string") continue;
        const v = predicate(obj[key]);
        if (v !== undefined) out[key] = v;
      }
      return out;
    };
    const runs = isObj(parsed.runs) ? parsed.runs : {};
    const unlocks = isObj(parsed.unlocks) ? parsed.unlocks : {};
    const lastUnlock = isObj(parsed.lastUnlock)
      && typeof parsed.lastUnlock.cardId === "string"
      && typeof parsed.lastUnlock.name === "string"
      && typeof parsed.lastUnlock.classId === "string"
        ? { cardId: parsed.lastUnlock.cardId, name: parsed.lastUnlock.name, classId: parsed.lastUnlock.classId }
        : null;
    return {
      version: 1,
      runs: {
        started: num(runs.started, def.runs.started),
        completed: num(runs.completed, def.runs.completed),
        failed: num(runs.failed, def.runs.failed),
      },
      fightsWon: num(parsed.fightsWon, def.fightsWon),
      classesPlayed: strMap(parsed.classesPlayed, (v) => num(v, undefined)),
      classesCompleted: strMap(parsed.classesCompleted, (v) => bool(v) ? true : undefined),
      unlocks: { cards: strMap(unlocks.cards, (v) => bool(v) ? true : undefined) },
      lastUnlock,
    };
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
