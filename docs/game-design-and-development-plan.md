# Game Design and Development Plan

## North Star

Build a browser deck building battle game where players choose an Aetherfall champion deck, summon monsters onto fields, cast abilities directly, and fight in 1v1, 2v2, or 1v1v1v1 modes.

The game should be data-driven: a card is mostly a definition made of values, targeting rules, actions, timing rules, and an assigned image. The engine should not care whether a card is a Fireball, a Shield, a monster, or an ultimate; it should resolve card definitions through the same action system.

## Core Game Shape

Players have:

- A hero with HP, armor/block, champion identity, race identity, and mana.
- A deck, hand, discard pile, and removed/exhausted pile.
- A battlefield with a limited number of monster slots.
- Champion/race modifiers and a unique ultimate tied to the deck identity.

Cards can be:

- Attack cards: direct damage, ranged damage, critical effects, splash damage.
- Defense cards: block, armor, prevention, barriers.
- Monster cards: summon units to the field with attack, HP, traits, and abilities.
- Skill cards: draw, steal, buff, debuff, stealth, slow, stun, speed, precision.
- Ultimate cards or skills: unlocked by champion identity, charge meter, or condition.

Active V0 champion inspiration:

- Arian, the Still Colossus: Accumulation, stone giant identity, Pressure, stored damage, armor, and seismic payoff attacks.
- Geert, the Polarity Architect: Control, tinkerer/artificer identity, Polarity, Combo Charge, magnetic buffs, and chain reactions.
- Wouter, the Veilstalker: Precision, elf rogue/hunter identity, evasion, loot, ambush damage, traps, and critical strikes.
- Noah, Lord of Unwritten Chaos: Chaos, demon warlock identity, random damage, Instability, self-risk, and unstable spellcasting.

The earlier generic fantasy class/race idea remains useful inspiration, but the playable V0 now uses four named champion decks instead of free class/race pairing.

## Proposed Gameplay Loop

1. Choose mode: 1v1, 2v2, or free-for-all.
2. Choose champion deck.
3. Choose or generate starter deck.
4. Draw opening hand.
5. On a turn, a player can play cards, summon monsters, attack with ready monsters, use direct abilities, and end turn.
6. Damage, block, buffs, debuffs, and status effects resolve through a shared effect system.
7. Win condition depends on the mode:
   - 1v1: defeat the opposing hero.
   - 2v2: defeat both opposing heroes, or use shared team life if we decide that feels better.
   - FFA: last player standing.

## Architecture Direction

The game should be split into three major layers:

- Game engine: pure rules, deterministic state updates, card resolution, turn order, targeting, win checks.
- Content data: cards, classes, races, monsters, ultimates, images, starter decks.
- Browser client: UI, animations, drag/drop, field rendering, deck builder, menus, multiplayer screens.

Recommended early folder shape:

```text
src/
  engine/
    state/
    rules/
    actions/
    targeting/
    modes/
  content/
    cards/
    classes/
    races/
    decks/
  ui/
    screens/
    components/
    board/
    cards/
  assets/
    cards/
    ui/
```

The most important architectural rule: the UI should send player intents to the engine, and the engine should return a new game state plus events. The UI should not directly decide whether damage, block, targeting, or turn transitions are valid.

Example intent:

```ts
{
  type: "PLAY_CARD",
  playerId: "player-1",
  cardInstanceId: "hand-card-3",
  targets: ["player-2"]
}
```

Example card definition:

```ts
{
  id: "arian.stone_breath",
  name: "Stone Breath",
  type: "spell",
  class: "arian",
  cost: 1,
  image: "assets/cards/arian-sheet.png#0,0",
  targeting: {
    allowed: ["enemyHero", "enemyMonster"]
  },
  actions: [
    { type: "DAMAGE", amount: 3 },
    { type: "GAIN_COUNTER", counter: "pressure", amount: 1 }
  ]
}
```

This lets us add content by creating definitions instead of hard-coding every card.

## Multiplayer Model

Design for multiplayer from the beginning, even if the first playable version is local/hotseat.

Use a command/event model:

- Client sends command: play card, choose target, end turn, attack.
- Engine validates command.
- Engine applies command to state.
- Engine emits events: damage dealt, card drawn, monster summoned, player defeated.
- UI animates from events.

This structure supports:

- Local single-browser testing.
- Hotseat play.
- Online play later through WebSockets.
- Replays and debugging.
- Future AI opponents.

Mode-specific logic should live in mode adapters:

- `duel`: 1v1 turn order and targeting.
- `teams`: 2v2 allies/enemies, shared or separate team rules.
- `freeForAll`: 4-player turn order and target politics.

## Phase Plan

### Phase 0: Project Foundation

Goal: create the base app and agree on technical direction.

Deliverables:

- Choose frontend stack.
- Create browser app scaffold.
- Add TypeScript.
- Add basic test runner.
- Add lint/format scripts.
- Create first placeholder route/screen.

Recommended stack:

- Vite + TypeScript for fast browser development.
- React for UI if we want rich menus, deck builder, and state-driven screens.
- A lightweight animation layer first; only add a game canvas library if the board needs it.
- Vitest for engine tests.

Decision needed:

- React DOM board, canvas board, or hybrid. For a card game, React DOM is likely enough at the start.

### Phase 1: Rules Prototype

Goal: prove the core game loop without art or complex UI.

Deliverables:

- Game state model.
- Player, hero, deck, hand, discard, field slots.
- Turn order.
- Draw card.
- Play card.
- End turn.
- Direct damage and block.
- Basic target validation.
- Unit tests for all rules.

First test cards:

- Fireball: deal 4 damage.
- Ice Spike: deal 2 damage and apply slow.
- Magic Shield: gain 3 block.
- Frost Barrier: gain 2 block and draw 1 card.

### Phase 2: Data-Driven Card System

Goal: make cards configurable through data definitions.

Deliverables:

- Card schema.
- Action resolver.
- Targeting resolver.
- Status effect model.
- Card instance model for deck/hand/discard.
- First content pack for the Arian, Geert, Wouter, and Noah champion cards.
- Image field support on cards.

Important action types:

- `DAMAGE`
- `BLOCK`
- `DRAW`
- `HEAL`
- `SUMMON`
- `BUFF`
- `DEBUFF`
- `APPLY_STATUS`
- `PREVENT_NEXT_ATTACK`
- `STEAL_CARD`

### Phase 3: Battlefield and Monsters

Goal: make the board feel like a tactical creature battle, not only direct spell casting.

Deliverables:

- Monster card type.
- Monster stats: HP, attack, speed/ready state, traits.
- Field slots per player.
- Summon rules.
- Monster attacks.
- Targeting heroes and monsters.
- Death/removal rules.
- Basic keywords such as guard, ranged, stealth, slow.

Open design choice:

- Decide whether monsters attack automatically, attack manually once per turn, or trigger based on speed/initiative.

### Phase 4: First Playable 1v1

Goal: create a complete 1v1 match that can be played in the browser.

Deliverables:

- Main menu.
- Champion deck selection.
- Starter decks.
- Playable board UI.
- Hand UI.
- Target selection.
- Turn indicator.
- Health/block display.
- Win/loss screen.
- Basic animations for damage, summon, draw, and discard.

Success condition:

- Two local players can complete a full match from start to finish.

### Phase 5: Champion Identity and Deck Depth

Goal: make choices before the match matter.

Deliverables:

- Champion definitions.
- Race identity definitions.
- Passive modifiers.
- Ultimate definitions.
- Starter decks for Arian, Geert, Wouter, and Noah.
- Champion-specific counters such as Pressure, Polarity, Loot, and Instability.
- Ultimate charge or unlock system.

Possible passive examples:

- Arian: defense cards gain extra block, but payoffs are slower.
- Geert: polarity changes unlock bonus chain effects.
- Wouter: starts with one extra card and can gain evasion.
- Noah: rolls and random effects can spike high but may cause self-damage.

### Phase 6: Multiplayer Modes

Goal: expand the same engine to support the planned match formats.

Deliverables:

- 1v1 mode adapter.
- 2v2 mode adapter.
- Free-for-all mode adapter.
- Team targeting rules.
- Player defeat rules.
- Turn order for four players.
- Shared test fixtures for all modes.

Important decisions:

- In 2v2, do allies share one team HP pool, or does each hero stay separate?
- Can players target allies with healing/buffs?
- In FFA, do temporary alliances exist only socially, or do cards reference "non-owner" and "enemy" mechanically?

### Phase 7: Deck Builder and Progression

Goal: let players customize decks instead of only using starter decks.

Deliverables:

- Deck editor screen.
- Card collection view.
- Filters by champion, race identity, cost, type.
- Deck validation rules.
- Save/load local decks.
- Starter deck templates.
- Optional draft mode later.

Early deck rules:

- Minimum and maximum deck size.
- Max copies per card.
- Champion-locked cards.
- Neutral cards.
- Race identity cards or race-enhanced versions.

### Phase 8: Art Style and UI Direction

Goal: define visual identity after the game loop is fun enough to preserve.

Deliverables:

- Art style moodboard.
- Card frame layout.
- Board layout.
- UI components.
- Color and typography direction.
- Placeholder image pipeline.
- Final image pipeline.

Suggested art style lanes to compare:

- Painted fantasy: classic, readable, familiar.
- Stylized tactical board game: cleaner shapes, easier to produce consistently.
- Dark comic fantasy: punchy, high contrast, strong character identity.
- Cozy adventure fantasy: approachable, colorful, broader appeal.

Card frame should support:

- Name.
- Cost.
- Type.
- Champion/race identity markers.
- Image.
- Rules text.
- Attack/HP for monsters.
- Rarity or set marker later.

### Phase 9: Balance, Content, and Feel

Goal: make the game replayable and understandable.

Deliverables:

- Balance spreadsheet or content JSON review process.
- Debug mode showing state/events.
- Match log.
- Card tooltip system.
- Better animations and feedback.
- Sound pass.
- More cards per champion.
- Neutral cards.
- AI or scripted opponent if desired.

Balance goals:

- Each champion should have a clear strength and weakness.
- Race identity should change flavor and small strategy, not decide the game alone.
- Ultimates should feel exciting but not instantly decide every match.
- Monsters and direct abilities should both be viable.

### Phase 10: Online Play and Deployment

Goal: make the game playable across browsers/machines.

Deliverables:

- WebSocket server or hosted realtime backend.
- Lobby creation.
- Invite/join flow.
- Player reconnection.
- Server-authoritative command validation.
- Deployment pipeline.
- Match persistence if needed.

This phase should wait until the local game is already fun. Online multiplayer adds complexity quickly, so the engine should be stable first.

## Early MVP Scope

The first truly playable MVP should include:

- Local 1v1.
- Four starting champion decks: Arian, Geert, Wouter, Noah.
- Four locked race identities: Ancient Giant / Stone Troll, Tinkerer / Arcane Artificer, Elf Rogue / Forest Hunter, Demon Sorcerer / Chaos Warlock.
- One starter deck per champion.
- 30-40 total cards.
- 8-12 monster cards.
- 1 ultimate per champion identity.
- Basic board UI.
- Placeholder art.
- Deterministic engine tests.

This keeps the first version small enough to finish while still proving the central idea: cards can summon, attack, defend, and cast direct abilities.

## Open Questions

- Should the game use mana/energy each turn, or a fixed number of actions?
- Should deck building happen before matches only, or should players build during a run like a roguelike deck builder?
- Should monsters remain until killed, or clear after a number of turns?
- How many field slots should each player have?
- Should turns be one player at a time, or team turns in 2v2?
- Should race identities only give passives, or also unlock race-specific cards later?
- Do ultimates live as cards in the deck, hero buttons, or charge-meter skills?

## Recommended Next Step

Start Phase 0 by scaffolding a Vite + TypeScript browser app, then immediately build Phase 1 as a tested rules engine before investing in art. The art and UI will matter a lot, but the game will be much easier to design once the core loop can be played with simple placeholder cards.
