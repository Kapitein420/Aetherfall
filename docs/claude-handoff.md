# Claude Handoff: Aetherfall Co-op Boss Prototype

This is the current source of truth for taking over the project in another assistant session.

## Repository

- GitHub repo: `https://github.com/Kapitein420/Aetherfall`
- Public browser preview: `https://raw.githack.com/Kapitein420/Aetherfall/main/index.html`
- Local workspace used by Codex: `C:\Users\noah_\Documents\New project`
- GitHub Desktop repo path: `C:\Users\noah_\Documents\GitHub\Aetherfall`
- Last known redesign commit before this handoff: `33f2e1d Redesign as cooperative boss fight`

The project is dependency-free. It uses plain HTML, CSS, and browser ES modules.

## How To Run Locally

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\local-server.ps1
```

Then open:

```text
http://127.0.0.1:4173/
```

If using the public browser preview, use:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

GitHub Pages is prepared through `.github/workflows/pages.yml`, but the Pages URL may return 404 until Pages is enabled in GitHub repository settings. RawGitHack is the working public preview route for now.

## Current Game Direction

The old PvP duel / Hearthstone-like version has been replaced. Do not continue the old Arian/Geert/Wouter/Noah PvP deck mechanics unless the user explicitly asks to revive them.

The current game is:

- 2-player co-op
- 1 boss monster
- Simultaneous planning
- Threat-based monster targeting
- 15-card deck per player
- Each round:
  - leftover hand cards are discarded
  - each player draws 5
  - max energy increases by 1
  - energy caps at 10
  - threat decays by 3
- Players start with 3 max energy and 3 current energy.
- The monster attacks the living player with the highest threat.
- The fight ends when the monster dies or both players are defeated.

## Current Characters

Character data is in `src/content/classes.js`.

Current playable characters:

- `rook`: Rook, the Iron Vanguard
  - role: Defender
  - max HP: 42
  - identity: block, taunt, threat control, team defense
- `lyra`: Lyra, the Ember Veil
  - role: Striker
  - max HP: 34
  - identity: burst damage, evasion, expose, threat reduction

The old class IDs still exist only in asset mapping for reused portraits:

- Rook currently reuses Arian portrait/card back art.
- Lyra currently reuses Wouter portrait/card back art.

## Current Deck Structure

Card data is in `src/content/cards.js`.

Each deck has exactly 15 cards:

- 4 attack cards
- 4 defense cards
- 1 healing card
- 1 support card
- 5 unique character cards

Current action types implemented in `src/engine/game.js`:

- `damage`
- `damageFromBlock`
- `executeDamage`
- `block`
- `heal`
- `draw`
- `threat`
- `reduceThreat`
- `weaken`
- `expose`

Card helper constructors live at the bottom of `src/content/cards.js`. When adding new cards, prefer adding a simple action object instead of custom one-off logic unless the mechanic will be reused.

## Engine Architecture

Main engine file:

```text
src/engine/game.js
```

Important exports:

- `createCoopBattle(config)`
- `queueCard(currentState, command)`
- `unqueueCard(currentState, command)`
- `resolveRound(currentState)`
- `getRemainingEnergy(player)`
- `getPlayer(state, playerId)`
- `targetKey(target)`

Important constants:

- `DRAW_PER_ROUND = 5`
- `STARTING_ENERGY = 3`
- `MAX_ENERGY = 10`
- `THREAT_DECAY = 3`

State shape:

```js
{
  mode: "coop-boss",
  phase: "planning" | "game-over",
  roundNumber,
  players: [
    {
      id,
      name,
      classId,
      role,
      maxHp,
      hp,
      block,
      energyMax,
      energy,
      deck,
      hand,
      discard,
      planned
    }
  ],
  monster: {
    id: "monster",
    name: "The Hollow Titan",
    maxHp: 120,
    hp: 120,
    baseAttack: 9,
    threat: {
      "player-1": 0,
      "player-2": 0
    },
    statuses: {
      exposed: 0,
      weakened: 0
    }
  },
  winner: null | "players" | "monster",
  log,
  events,
  nextEventId
}
```

Resolution order:

1. Each player's queued cards resolve in player array order.
2. Each card spends energy when resolved.
3. Damage adds threat equal to damage dealt.
4. Healing adds threat equal to half the actual healed amount, rounded up.
5. If the monster dies, the players win immediately.
6. If monster survives, it attacks the living player with highest threat.
7. New round starts: clear block, increase energy max, refill energy, decay threat, discard old hand, draw 5.

Design note: this is "simultaneous planning" but deterministic sequential resolution for the prototype. A future pass can add initiative/speed or batch resolution.

## UI Architecture

Main renderer:

```text
src/app.js
```

The app uses `innerHTML` rendering and event delegation on `#app`.

Main UI actions:

- `start-game`
- `queue-card`
- `unqueue-card`
- `resolve-round`
- `new-game`

The current interaction model is click-to-queue. The old drag-to-play code was removed during the redesign because the new flow is planning-based rather than turn/target based.

Styling:

```text
src/styles.css
```

The bottom of the stylesheet contains the newer co-op-specific styles:

- `.coop-table`
- `.coop-playmat`
- `.boss-panel`
- `.threat-board`
- `.coop-player-panel`
- `.coop-card`
- `.queued-card`

## Assets

Runtime asset registry:

```text
src/content/game-assets.js
```

Important asset folders:

- `assets/ui/`
- `assets/ui/portraits/`
- `assets/ui/card-backs/`
- `assets/ui/effects/`
- `assets/cards/`
- `assets/cards/crops/`

The old generated full-card images are still in the repo. They are not currently used by the redesigned Rook/Lyra decks.

Future art task:

- Generate proper Rook and Lyra card art.
- Generate or crop a boss portrait/token for The Hollow Titan.
- Replace reused Arian/Wouter portraits with Rook/Lyra-specific portraits.

## Deployment Notes

`index.html` uses relative paths:

```html
<link rel="stylesheet" href="./src/styles.css" />
<script type="module" src="./src/app.js"></script>
```

Asset URLs are generated through:

```text
src/content/asset-paths.js
```

This makes local hosting and hosted subpath previews work.

Public preview currently works through:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

After any push, this link may take a short moment to refresh because it proxies GitHub content.

## Git Notes

Normal `git` is not available in the terminal PATH in the Codex environment. GitHub Desktop's bundled Git has been used successfully:

```powershell
C:\Users\noah_\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe
```

Typical push flow from Codex:

```powershell
$git = 'C:\Users\noah_\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe'
$repo = 'C:\Users\noah_\Documents\GitHub\Aetherfall'
& $git -C $repo status --short
& $git -C $repo add -A
& $git -C $repo commit -m "Message"
& $git -C $repo push origin main
& $git -C $repo push origin main:gh-pages
```

When working from `C:\Users\noah_\Documents\New project`, changes must be copied into `C:\Users\noah_\Documents\GitHub\Aetherfall` before committing because that is the actual Git repository folder.

## Known Limitations

- No automated test suite yet.
- Node syntax checks could not be run in the Codex Windows sandbox because `node.exe` returned access denied.
- The public preview is RawGitHack, not true GitHub Pages yet.
- GitHub Pages workflow exists but Pages must be enabled in repository settings.
- There is no persistence, no multiplayer networking, and no save state.
- The monster is hard-coded as The Hollow Titan inside `createMonster()`.
- Player action resolution is deterministic in array order after simultaneous planning.
- Threat caps at 20, matching the user's threat tracker reference.
- Old docs and art prompts still mention the earlier PvP direction. Treat `docs/claude-handoff.md` and `docs/handoff.md` as the current direction.

## Recommended Next Steps

1. Playtest the current co-op loop for 5-10 rounds and tune numbers.
2. Add a visible monster intent before resolving the round.
3. Add more bosses with different threat behaviors.
4. Add action categories for "fast", "slow", or "reaction" if simultaneous resolution needs more nuance.
5. Add proper Rook/Lyra art prompts and new card sheet generation.
6. Add small unit tests for `queueCard`, `resolveRound`, threat changes, draw/discard, and monster targeting.
7. Decide whether the public link should stay RawGitHack or finish enabling GitHub Pages.
