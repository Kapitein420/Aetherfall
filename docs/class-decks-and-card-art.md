# Champion Decks and Card Art

## Current Starter Deck Direction

Each champion now has a 15-card starter deck built from a focused 9-card identity set.

- Arian: slow pressure, armor, stored damage, seismic delay, and giant payoff attacks.
- Geert: polarity states, magnetic setup, combo charge, chain reactions, and overclocked control.
- Wouter: fast tempo, evasion, loot, ambush damage, traps, and precision burst.
- Noah: random damage, instability, risk-reward spells, self-damage, and unstable summons.

The active deck data lives in `src/content/cards.js`.

## Current Art Direction

Cards use a code-native art key for now:

```js
{
  id: "arian.stone_breath",
  artKey: "stone"
}
```

The art key maps to metadata in `src/content/card-art.js`, while the visual treatment is handled in `src/styles.css`.

This gives every card champion-flavored art immediately:

- Arian: stone, moss, seismic pressure, cracked earth, and amber force.
- Geert: magnetism, metal fragments, electric arcs, and blue-white machinery.
- Wouter: relics, shadow, traps, daggers, precision marks, and twilight forest energy.
- Noah: void, dice, chaos, demonic energy, crimson magic, and fractured reality.
- Neutral: coin.

## Future Bitmap Path

When we are ready for final art, each `artKey` can become either:

- a generated image path,
- a sprite-sheet frame key,
- or a hand-painted/imported asset path.

The card definitions already keep `image: null` fields so we can replace the current procedural panels without redesigning the deck format.

## Sprite Sheet Plan

Each champion should get one 3 by 3 sprite sheet containing the 9 unique card artworks for that deck. The browser prototype can then map card IDs to sprite coordinates while keeping rules text and balance values in JSON.

Recommended first naming:

- `assets/cards/arian-full-card-sheet.png`
- `assets/cards/geert-full-card-sheet.png`
- `assets/cards/wouter-full-card-sheet.png`
- `assets/cards/noah-full-card-sheet.png`

For final production, the safest pipeline may still be frameless/textless art plus browser-rendered text. For the current visual pass, all four champions use full-card mockup sheets so we can test whether generated complete cards feel good in the hand.

## Current Sheet Integration

All four current champions are wired as full-card sprite sheets through `src/content/card-sheets.js`.

The expected Arian grid order is:

1. Stone Breath
2. Granite Skin
3. Tectonic Wait
4. Stored Impact
5. Mossbound Guardian
6. Seismic Pressure
7. Faultline Slam
8. Kindly Cataclysm
9. Worldbreaker Patience

If `assets/cards/arian-full-card-sheet.png` exists, the hand cards use cropped frames from that sheet. If it is missing, the prototype falls back to procedural cards.
