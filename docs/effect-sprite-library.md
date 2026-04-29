# Effect Sprite Library

The prototype uses a code-native sprite library for action feedback. These are CSS/HTML effect sprites rather than bitmap sprite sheets, which makes them easy to tune while the rules and board layout are still changing.

Library metadata lives in `src/effects/effect-library.js`. The actual sprite shapes and animation keyframes live in `src/styles.css`.

## Current Effects

- `summon`: green arrival aura for monsters entering the board.
- `spellHit`: blue arcane burst for spell damage.
- `physicalAttack`: fast slash trail when a monster attacks.
- `physicalHit`: impact burst on the target of a physical attack.
- `block`: shield flash when block is gained or damage is absorbed.
- `ward`: stronger shield flash for prevented damage.
- `draw`: small card movement effect when a card is drawn.
- `mana`: blue crystal pulse when temporary mana is gained.
- `slow`: icy cross effect for slow.
- `defeat`: dust burst when a monster is removed.

## Architecture

The engine emits semantic events into `state.events`, such as:

```js
{
  id: 12,
  type: "summon",
  target: { type: "monster", playerId: "player-1", slotIndex: 3 },
  label: "Arcane Sentinel"
}
```

The UI reads new events, creates temporary effect instances, and renders them on the matching hero or board slot. This keeps game logic independent from presentation.

## Future Bitmap Sprite Sheet Path

When the game feel is more stable, the same event names can map to real sprite sheets:

- `src/assets/effects/summon.png`
- `src/assets/effects/spell-hit.png`
- `src/assets/effects/physical-hit.png`
- `src/assets/effects/block.png`

No engine changes should be needed for that upgrade. Only the renderer/CSS would change.
