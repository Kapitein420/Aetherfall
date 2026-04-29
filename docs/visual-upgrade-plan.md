# Visual Upgrade Plan

## Goal

Make the local prototype feel like a polished fantasy card battler while keeping the implementation practical. The card sheets now prove the art direction works, so the next visual pass should extend that same premium fantasy look into the board, heroes, card backs, effects, and UI chrome.

## Guiding Rules

- Use generated bitmap assets for mood, material, and fantasy presence.
- Keep readable UI text rendered by the browser where possible.
- Avoid relying on generated text except on full-card mockups we already accepted.
- Keep assets modular: board backgrounds, hero portraits, card backs, icons, effect atlases.
- Do not copy any existing card game's exact frame, board, or icon language.
- Make every deck feel like the same universe, with different material accents.

## Asset Pass 1: Battle Board

Generate one main battle board background.

Purpose:

- Replace the current CSS grid playmat with an illustrated fantasy battlefield.
- Give the board depth, atmosphere, and a clear center lane.
- Leave clean zones where cards, heroes, and monsters can sit.

Recommended asset:

- `assets/ui/board-aetherfall-battlefield.png`
- Size: 2400 x 1400
- No text, no UI labels, no card slots drawn too strongly.
- Dark enough behind cards, but not muddy.

Implementation:

- Set it as `.playmat` background image with a subtle overlay.
- Keep CSS field slots and interactive elements above it.
- Add a vignette and soft radial lighting behind each hero.

## Asset Pass 2: Champion Hero Portraits

Generate one 2x2 sheet with the four champion portraits.

Purpose:

- Replace abstract hero capsules with illustrated hero portrait medallions.
- Make it immediately obvious who is playing which deck.

Recommended asset:

- `assets/ui/champion-portraits.png`
- 2 columns x 2 rows
- Arian, Geert, Wouter, Noah.
- No text, no frames, just portrait art with transparent-feeling dark background.

Implementation:

- Crop via CSS or slice into 4 files.
- Add portrait medallion in `.hero-portrait`.
- Keep HP/block/status text rendered in HTML.

## Asset Pass 3: Card Backs

Generate a 2x2 card-back sheet.

Purpose:

- Opponent hand and deck piles should look premium.
- Card backs can share one global Aetherfall style or have deck-specific versions.

Recommended asset:

- `assets/cards/card-backs.png`
- 2 columns x 2 rows: Arian, Geert, Wouter, Noah.
- No text.

Implementation:

- Use class-specific card backs for hidden hands and deck piles.
- Keep them darker and less visually loud than playable hand cards.

## Asset Pass 4: Effect Sprite Atlases

Generate VFX sheets for common actions.

First atlas:

- `assets/effects/core-effects.png`
- 4 columns x 4 rows
- transparent background if possible
- effects: summon, spell hit, physical hit, block, ward, draw, discard, mana, evasion, trap, crit, polarity, pressure, instability, defeat, backlash.

Implementation:

- Start with CSS background images or simple animated overlays.
- Use semantic event names already emitted by the engine.
- Keep duration short: 500-900ms.
- Motion should be snappy, not noisy.

## Asset Pass 5: UI Material Kit

Generate a small UI texture kit.

Recommended asset:

- `assets/ui/aetherfall-ui-kit.png`
- 4 columns x 4 rows
- panels, dividers, buttons, gem sockets, status badges, turn orb, pile frame, field slot frame, tooltip panel.
- No readable text.

Implementation:

- Use slices as CSS backgrounds or crop into individual files.
- Start with the highest-impact parts: hero frame, pile frame, field slot, turn orb.

## Polish Sequence

1. Board background and subtle overlay.
2. Hero portraits and deck-specific hero accents.
3. Card backs for hidden hand and deck piles.
4. Replace CSS effect shapes with bitmap VFX for the most common events.
5. UI material kit for frames, buttons, and status badges.
6. Add motion polish:
   - hand hover lift,
   - card play travel,
   - summon pop,
   - attack lunge,
   - damage shake,
   - block shield flash,
   - end-turn pulse.
7. Responsive check on desktop and mobile.

## Implementation Notes

Prefer sliced individual PNGs over CSS sprite background-position for now. The card-sheet issue showed that hardcoded files are more reliable at this stage.

Suggested folders:

```text
assets/
  cards/
    crops/
    backs/
  ui/
    board/
    portraits/
    kit/
  effects/
    crops/
```

Suggested data files:

```text
src/content/card-images.js
src/content/hero-portraits.js
src/content/card-backs.js
src/effects/effect-assets.js
```

Keep game logic unchanged. Visual changes should map existing state/events to better assets.
