# The Fracture of Aetherfall

This project is for a browser-playable fantasy deck-building boss fight. The current prototype is a redesigned 2-player co-op battle where both players plan actions together, spend energy, build threat, and try to defeat one monster before it overwhelms them.

Play the current public build in your browser:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

Start here if another assistant is taking over:

- [Claude Handoff](docs/claude-handoff.md)
- [Project Handoff](docs/handoff.md)

Older planning and asset documents:

- [Game Design and Development Plan](docs/game-design-and-development-plan.md)
- [Hearthstone-Inspired Core Loop Notes](docs/research-hearthstone-core-loop.md)
- [Effect Sprite Library](docs/effect-sprite-library.md)
- [Champion Decks and Card Art](docs/class-decks-and-card-art.md)
- [V0 Roster Scope](docs/v0-roster-scope.md)
- [Visual Upgrade Plan](docs/visual-upgrade-plan.md)

## Local Prototype

This first version is intentionally local-only and dependency-free. It uses plain browser modules plus a small PowerShell static file server, so it does not require npm or a global Node setup.

Current rules:

- 2 players vs 1 monster.
- 15-card deck per player.
- Each round, leftover hand cards are discarded and each player draws 5.
- Players start at 3 energy, gain +1 max energy per round, and cap at 10.
- Players queue actions at the same time, then resolve the round together.
- Monster threat is tracked separately per player.
- Monster attacks the living player with the highest current threat.
- The fight ends when the monster dies or both players fall.

Run it locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\local-server.ps1
```

Then open:

```text
http://127.0.0.1:4173/
```

## Live Test Build

The current public build can be played directly from the GitHub repository through RawGitHack:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

GitHub Pages deployment is also prepared from `main`:

```text
https://kapitein420.github.io/Aetherfall/
```

If the GitHub Pages link returns 404, use the RawGitHack link above until Pages is enabled in repository settings.
