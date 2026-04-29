# Project Handoff

## Project

The Fracture of Aetherfall is a local-only browser prototype for a fantasy deck-building battle game. It currently runs without npm or Node dependencies through a small PowerShell static server.

Local URL:

```text
http://127.0.0.1:4173/
```

Live GitHub Pages URL:

```text
https://kapitein420.github.io/Aetherfall/
```

Server command:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\local-server.ps1
```

## Current Playable State

- Local 1v1 hotseat match.
- Four champion decks:
  - Arian, the Still Colossus.
  - Geert, the Polarity Architect.
  - Wouter, the Veilstalker.
  - Noah, Lord of Unwritten Chaos.
- Cards are data-driven in `src/content/cards.js`.
- Core rules live in `src/engine/game.js`.
- UI rendering lives in `src/app.js`.
- Styling and current CSS effects live in `src/styles.css`.
- Hand cards can be clicked or dragged toward the center drop zone to play them.

## Current Visual State

The generated card sheets have been copied into the project and sliced into individual card images. A first visual upgrade pass has also been integrated for board atmosphere, champion identity, deck backs, and battle VFX.

Source sheets:

- `assets/cards/arian-full-card-sheet.png`
- `assets/cards/geert-full-card-sheet.png`
- `assets/cards/wouter-full-card-sheet.png`
- `assets/cards/noah-full-card-sheet.png`

Individual card crops:

- `assets/cards/crops/*.png`

There are 36 generated card crop images, one for each champion card. The app uses these directly through `src/content/card-sheets.js`, via `getCardImage(cardId)`.

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
