# Project Handoff

## Project

The Fracture of Aetherfall is a local-only browser prototype for a fantasy deck-building battle game. It currently runs without npm or Node dependencies through a small PowerShell static server.

Local URL:

```text
http://127.0.0.1:4173/
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

## Current Visual State

The generated card sheets have been copied into the project and sliced into individual card images.

Source sheets:

- `assets/cards/arian-full-card-sheet.png`
- `assets/cards/geert-full-card-sheet.png`
- `assets/cards/wouter-full-card-sheet.png`
- `assets/cards/noah-full-card-sheet.png`

Individual card crops:

- `assets/cards/crops/*.png`

There are 36 generated card crop images, one for each champion card. The app uses these directly through `src/content/card-sheets.js`, via `getCardImage(cardId)`.

## Visual Upgrade Plan

The next visual pass should happen piece by piece:

1. Battle board background.
2. Champion portraits.
3. Card backs.
4. Core effect/VFX atlas.
5. UI material kit.
6. Monster tokens and status markers.
7. Resource/status icons.
8. Board interaction overlays.
9. Menu/deck selection assets.
10. Optional arena variants.

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

- `git` is not available in the current terminal PATH.
- GitHub Desktop was not found via terminal search, but the project folder is ready to be added manually.
- Before pushing to GitHub, confirm that generated assets are intended to be shared because that uploads local files to a third-party service.
