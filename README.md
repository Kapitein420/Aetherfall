# The Fracture of Aetherfall

This project is for a browser-playable fantasy deck building battle game with champion deck identity, summonable monsters, direct abilities, and support for 1v1, 2v2, and free-for-all multiplayer formats.

Play the current public build in your browser:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

Start with the planning document:

- [Game Design and Development Plan](docs/game-design-and-development-plan.md)
- [Hearthstone-Inspired Core Loop Notes](docs/research-hearthstone-core-loop.md)
- [Effect Sprite Library](docs/effect-sprite-library.md)
- [Champion Decks and Card Art](docs/class-decks-and-card-art.md)
- [V0 Roster Scope](docs/v0-roster-scope.md)
- [Project Handoff](docs/handoff.md)
- [Visual Upgrade Plan](docs/visual-upgrade-plan.md)

## Local Prototype

This first version is intentionally local-only and dependency-free. It uses plain browser modules plus a small PowerShell static file server, so it does not require npm or a global Node setup.

The current prototype includes generated full-card art, champion portraits, champion-specific card backs, a fantasy battlefield background, and image-backed combat VFX.

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
