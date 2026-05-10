# Project Handoff

## Project

The Fracture of Aetherfall is a browser prototype for a fantasy co-op deck-building boss fight. It currently runs without npm or Node dependencies through a small PowerShell static server.

## Pick up here (latest)

**Most recent session handoff:** [`docs/handoff-2026-05-10.md`](handoff-2026-05-10.md)

That file has the TL;DR, what's open in PR #51, and a "do this first tomorrow" list. Read it before touching anything.

For the full takeover brief (architecture, history), read:

```text
docs/claude-handoff.md
```

Important: the current design is the co-op boss fight. Older docs and generated art still reference the previous PvP duel concept, but those mechanics are no longer the active game direction.

Local URL:

```text
http://127.0.0.1:4173/
```

Live GitHub Pages URL:

```text
https://kapitein420.github.io/Aetherfall/
```

Immediate public browser preview:

```text
https://raw.githack.com/Kapitein420/Aetherfall/main/index.html
```

Server command:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\local-server.ps1
```

## Current Playable State

- 2-player co-op boss fight.
- One monster: The Hollow Titan.
- Two 15-card player decks:
  - Rook, the Iron Vanguard.
  - Lyra, the Ember Veil.
- Each deck has 4 attack cards, 4 defense cards, 1 healing card, 1 support card, and 5 unique cards.
- Each round discards leftover hand cards, draws 5, increases max energy by 1, and decays threat by 3.
- Players queue actions simultaneously, then resolve the round together.
- The monster attacks the living player with the highest current threat.
- Cards are data-driven in `src/content/cards.js`.
- Core rules live in `src/engine/game.js`.
- UI rendering lives in `src/app.js`.
- Styling and current CSS effects live in `src/styles.css`.
- Hand cards are clicked into each player's queued action plan.

## Current Visual State

The generated card sheets have been copied into the project and sliced into individual card images. A first visual upgrade pass has also been integrated for board atmosphere, champion identity, deck backs, and battle VFX.

Source sheets:

- `assets/cards/arian-full-card-sheet.png`
- `assets/cards/geert-full-card-sheet.png`
- `assets/cards/wouter-full-card-sheet.png`
- `assets/cards/noah-full-card-sheet.png`

Individual card crops:

- `assets/cards/crops/*.png`

The old full-card images are still stored in the repo for reference, but the redesigned co-op decks currently use procedural browser-rendered cards. New card art should be generated later for the new Rook and Lyra decks.

Runtime UI assets:

- `assets/ui/battlefield-aetherfall.png`
- `assets/ui/portraits/*.png`
- `assets/ui/card-backs/*.png`
- `assets/ui/effects/*.png`

The app maps these through `src/content/game-assets.js`.

## Visual Upgrade Plan

The next visual pass should continue piece by piece:

1. Improve responsive layout around the new battlefield.
2. Crop and integrate the UI frame/menu kit.
3. Replace procedural monster tokens with dedicated token art.
4. Add resource/status icons.
5. Add board interaction overlays.
6. Add arena variants.

Prompts are in:

- `docs/image-prompts/aetherfall-visual-upgrade-assets.json`
- `docs/visual-upgrade-plan.md`

## Asset Rules

- Prefer individual PNG files over CSS sprite background-position for now.
- If an image is generated as a sheet, slice it into individual files before using it in the app.
- Store final usable assets under `assets/`.
- Keep browser text rendered as HTML/CSS where possible.
- Generated readable text on final game UI should be avoided, except for the current full-card mockups.

## Important Notes

- `git` is not available in the normal terminal PATH.
- GitHub Desktop's bundled Git can be used from `C:\Users\noah_\AppData\Local\GitHubDesktop\app-3.5.8\resources\app\git\cmd\git.exe`.
- The GitHub Desktop repository path is `C:\Users\noah_\Documents\GitHub\Aetherfall`.
- GitHub Pages deploy is configured through `.github/workflows/pages.yml`.
- If GitHub Pages is not enabled in settings yet, use the RawGitHack public preview URL for browser testing.
