# Hearthstone-Inspired Core Loop Notes

Research sources:

- Blizzard game guide: https://hearthstone.blizzard.com/en-us/game-guide/lessons/
- Hearthstone gameplay overview: https://hearthstone.wiki.gg/wiki/Gameplay
- Hearthstone mana overview: https://hearthstone.wiki.gg/wiki/Mana
- Hearthstone minion overview: https://hearthstone.wiki.gg/wiki/Minion

## Useful Patterns To Adapt

- The active player sees their hand at the bottom of the board.
- The opponent is visually placed at the top, with hidden hand cards represented as card backs.
- Mana is the main pacing resource, grows by one each turn, refills at the start of turn, and caps at 10.
- Minions persist on the board and can attack enemy minions or the enemy hero.
- Defensive minions protect the hero until removed.
- Playable cards should be visually clear in hand, while unaffordable cards should look inactive.
- Attacking an enemy minion should cause both minions to deal combat damage.

## Intentional Differences

- We are not copying Hearthstone art, card names, UI assets, class identities, or copyrighted presentation.
- Our class/race system remains central.
- Our ultimate system remains a custom layer.
- The game is local hotseat first, so the active player swaps to the bottom each turn.
- Monster placement is automatic for now; choosing exact field slots can come later.

