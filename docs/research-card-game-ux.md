# Card-Game & Deckbuilder UX/UI Research

> **Date:** 2026-05-04
> **Method:** Research subagent ran Steam reviews, Reddit threads, design postmortems, GDC talks, and critic reviews via WebSearch/WebFetch. 30+ sources, citation-backed.
> **Games covered:** Slay the Spire (1 + 2), Hearthstone, Marvel Snap, MTG Arena, Inscryption, Monster Train, Balatro, Legends of Runeterra, Wildfrost, Cobalt Core, **Across the Obelisk** (most relevant — co-op deckbuilder), Fights in Tight Spaces.
> **Companion:** [`ux-improvement-plan.md`](ux-improvement-plan.md) translates these findings into prioritized work for Aetherfall.

---

## 1. Top-line takeaways (universally loved)

1. **Snappy input that beats animation.** Slay the Spire: "you can cast cards before you're done drawing your hand. This is really nice for when that louse has 2 HP." Players never want to be blocked by their own UI. ([Cloudfall](https://www.cloudfallstudios.com/blog/2018/2/20/flash-thoughts-slay-the-spires-ui))
2. **Telegraphed enemy intent.** Showing what enemies are about to do is now baseline: "Revealing what enemies are about to do unlocks a tremendous amount of tactical and strategic depth." ([STS Wiki](https://slaythespire.wiki.gg/wiki/Intent), [Gordian Blade](https://gordianblade.com/reveal-enemy-intents-or-how-i-run-rpg-combats-like-slay-the-spire/))
3. **Layered audiovisual feedback on every action.** Hearthstone's "preparation → emphasis → aftermath" three-phase pattern; Balatro's "screen shake, card flip animations, exponentially jumping numbers, rising fire effects, and crisp chip sound effects." Multiple feedback channels stack. ([JB Oger on Hearthstone](https://jboger.substack.com/p/hearthstone), [Balatro Design Analysis](https://medium.com/@yyh19971004/balatro-design-analysis-visual-packaging-and-interactive-feedback-cc6fa6a65370))
4. **Magnetic, physical-feeling card handling.** Balatro: "simulated physical inertia that pushes adjacent cards, along with a magnetic damping feel when snapping into place." The indie reference for hand-feel.
5. **Hover-tooltip rabbit holes.** Hearthstone-style nested keyword tooltips are the genre default; Wildfrost and Balatro both "instantly display clear Tooltips when a player hovers over any card or icon with specific affixes" instead of tutorials. ([Wildfrost Wiki keywords](https://wildfrostwiki.com/Keywords))
6. **Big, forgiving hitboxes for targeting.** Slay the Spire's "'hitboxes' for targeted attacks and spells are absolutely massive, and enemies are very spaced out… You will never accidentally target the wrong person" — vs MTG Arena's "should be more intuitive." ([MTG Arena feedback](https://feedback.wizards.com/forums/918667-mtg-arena-bugs/filters/new?category_id=352600))
7. **Tutorials short or absent.** Marvel Snap's tutorial "takes just a couple of minutes"; Balatro "discards lengthy standalone tutorials or cumbersome index menus." Onboarding happens through play + tooltips.
8. **Cards prioritized in the visual hierarchy.** Marvel Snap: "UI serving to highlight the cards whenever possible." UI chrome should never out-compete card art. ([Marvel Snap UI study](https://www.michaelcalcada.com/snap.html))

---

## 2. Top-line gripes (universally hated)

1. **Animations that block input or eat the turn timer.** Hearthstone: "excruciatingly slow animation… forced watching an animation instead of doing the play you had planned." Players literally lose games to this. ([Blizzard EU forums](https://eu.forums.blizzard.com/en/hearthstone/t/animations-are-so-slow-its-painful/5411))
2. **Hidden mechanics that punish but were never visible.** Wildfrost: "You overlooked or forgot a random charm effect on an enemy you had seen and dealt with hundreds of times before? Run over." Players distinguish "difficult" from "punishing." ([Steam thread](https://steamcommunity.com/app/1811990/discussions/0/3826413850823344641/))
3. **No combat/battle log.** Repeatedly requested for Slay the Spire 1 and 2; community shipped multiple mods to fill the gap. ([STS suggestion](https://steamcommunity.com/app/646570/discussions/2/2650805212045372980/), [Adventure Log mod](https://www.nexusmods.com/slaythespire2/mods/595))
4. **Tiny touch targets when scaling to small screens.** STS mobile: "Tapping tiny icons for relics, potions, or status effects may take several tries." ([Jon Quixote review](https://jlericson.com/2021/03/04/slay_the_spire_ios.html))
5. **Drag-only card play (no click fallback).** Across the Obelisk: "Cards can only be played using drag and drop, and this makes playing with a trackpad a pain." ([Co-Optimus](https://www.co-optimus.com/game/8648/pc/across-the-obelisk.html))
6. **Excess clicks for routine actions.** LoR: "to cast a spell with a single target, you must first drag it to the battlefield, then choose your target… no button for 'attack-with-everything'." ([PC Gamer](https://www.pcgamer.com/legends-of-runeterra-review/))
7. **Co-op slowness from sequential turns + chat.** Across the Obelisk: "with multiplayer it can take even longer as people chat and take time to input their turn." ([Steam](https://steamcommunity.com/app/1385380/discussions/0/3428948355371256579/))
8. **Weak accessibility.** Slay the Spire: "There is no colour-blind mode… The 'Larger Text' setting increases text size to a negligible degree." Color-blind players struggle with elite icons because shape is identical, only color differs. ([Family Gaming DB](https://www.familygamingdatabase.com/accessibility/Slay+the+Spire), [STS elite icons thread](https://steamcommunity.com/app/646570/discussions/0/2805074491020289038/))

---

## 3. Topic-by-topic findings

### 3.1 Card readability

Establish a typographic hierarchy — "title text should be most prominent, followed by effect descriptions, then secondary information like cost and keywords" ([Gunslinger's Revenge guide](https://www.gunslingersrevenge.com/posts/development/deckbuilder-ui-design-best-practices.html)). Cobalt Core praised because "the design of the cards themselves is concise and aesthetically appropriate, cleanly displaying information like card effects and which pilot it belongs to" ([PC Gamer](https://www.pcgamer.com/cobalt-core-review/)). On mobile, STS's text density backfires: "the text is quite small… seems to be a scaled-down version of the normal text."

**For Aetherfall:** Painted bespoke art is a strength but pushes effect text into a smaller area. Pin cost in a fixed corner so 2-player players can scan their queue at a glance.

### 3.2 Hand management

Slay the Spire's "cast zone" is "perfectly lined up to make flicking out targetless spells super easy and quick." Balatro's hand has "magnetic damping feel when snapping into place" with "simulated physical inertia that pushes adjacent cards." Best practice: "Allow players to reorder hand cards to match their strategic thinking, and remember preferred arrangements between turns" ([Gunslinger guide](https://www.gunslingersrevenge.com/posts/development/deckbuilder-ui-design-best-practices.html)).

**For Aetherfall:** Two players queueing into a shared resolution want unambiguous *own-hand* visibility while planning. Reorder + remember pattern matches our queue model.

### 3.3 Targeting & telegraphing

Intent symbols work because "turns are in a fixed order. The player takes his or her actions, then the enemies take theirs." Slay the Spire 2 expanded this: "When enemies intend to do multiple things at once, the indicators are placed side by side, rather than on top of each other" ([Untapped.gg](https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent)). Community asks for *more* intent transparency, not less ([STS2 expanded intents request](https://steamcommunity.com/app/2868840/discussions/0/4633736723121165181/)).

For player → target action: oversize hitboxes and well-spaced enemies. Avoid MTG Arena's "should be more intuitive… on-screen clutter that makes it impossible to see the card you're targeting."

**For Aetherfall:** We have fixate/threat. Show fixate and threat with persistent visual icons on the targeted character, not just numeric tooltip — and telegraph each phase change before it lands.

### 3.4 Information density on the board

Marvel Snap solves this with "dark 'piano glass' visual theme with buttons and UI elements made of light projected as holograms… UI serving to highlight the cards whenever possible." MTG Arena fails: "deck format dropdowns are partially or fully hidden behind UI panels."

Status effects are the biggest density risk. Wildfrost: "tooltips explain these things, they're easy details to gloss over… you can outright die from overlooking a single potential interaction."

**For Aetherfall:** Multi-element damage (water/toxic/overclock) means stack icons. Each must be persistently visible AND have a hover-tooltip.

### 3.5 Animations & pacing

STS pattern: "You can cast your cards as quickly as you'd like, and the animations will just do their own pace." Balatro: "Allowing players to compress waiting animations essentially shortens the feedback loop for receiving positive reinforcement and respects the user's sense of control."

Counter-example: Hearthstone Battlegrounds — "iPad players finishing the combat phase up to 20 seconds later than computer players" ([Blizzard battlegrounds anim thread](https://us.forums.blizzard.com/en/hearthstone/t/slow-combat-animations-in-battlegrounds-%E2%80%93-unfair-turn-time/148375)).

**For Aetherfall:** Animation can be lush on first encounter, but **must** be skippable / speed-uppable on repeat fights, and must never block input on the next turn's planning.

### 3.6 Battle log / history

One of the clearest community pain points. STS community filed multiple feature requests: "tracking becomes difficult in later acts with complex synergies and multi-turn effects." Two top-tier mods exist solely to add this: Adventure Log "provides a scrollable run log of every card played, damage dealt, power applied, relic triggered, energy gained, and card recalled" ([Nexus Mods](https://www.nexusmods.com/slaythespire2/mods/595)); STS2CombatLogMod gives "in-game log and post-game detailed breakdown."

Fights in Tight Spaces gets praise for letting players "watch a cinematic replay of how it all went down."

**For Aetherfall:** Our compact corner widget is on the right track. Community would *cheer* a battle log with: latest-first, expandable, filtered (damage / status / phase change), and the option to step through a round retrospectively.

### 3.7 Run / progression chrome

Marvel Snap: "Cards are prioritized in the visual hierarchy, with the UI serving to highlight the cards whenever possible." Slay the Spire treats relics as a fixed top bar: "mouse over relics to see their descriptions, or left click on a relic in your relics lineup to see its close-up and description."

**For Aetherfall:** Per-fight blessings are the relic-equivalent. They need to live in a persistent strip with hover-to-expand and click-to-pin.

### 3.8 Co-op / multiplayer

Across the Obelisk is the most-cited co-op deckbuilder reference, with both wins and losses to learn from:

**What works:**
- "In battle, there are emotes and the ability to prompt / suggest cards for the current player, as well as the always present chat."
- "Players vote on what tile to visit next and what choice to make in events, with disagreements being broken by a low / high / closest to 2 card draw" — voting is a feature, ties resolved deterministically.

**What players still ask for:**
- "an option to buy items for other characters with a confirmation popup" — cross-player resource gifting with friction.

**What hurts:**
- "Across the Obelisk runs take forever, especially in co-op… a deep run can take hours, while with multiplayer it can take even longer as people chat and take time to input their turn."
- Saves stored host-side cause "desyncs or disconnects."

**For Aetherfall:** In a 2-player co-op deckbuilder, deepest UX wins are: (1) *show your partner's hand*, (2) provide a "ping/suggest this card" emote, (3) "blessing draft together" UI that locks both votes and resolves deterministically, (4) make session state recoverable client-side so a disconnect doesn't kill the run.

### 3.9 Tooltips & nested info

Balatro: "instantly displaying clear Tooltips when a player hovers over any card or icon with specific affixes." Wildfrost: "Keywords are special ability words that condense long effects into a concise form." Hearthstone-style hover patterns are the de-facto reference.

The risk is "nested tooltips" where you have to dig multiple layers. The fix the deckbuilder UI guide proposes: "Effective icon systems reduce cognitive load by replacing text with recognizable symbols" + tooltip back-up — most info glanceable, only deep info a hover away.

### 3.10 Onboarding & tutorial

Best practice: short, in-flow, on-demand. Marvel Snap's tutorial "takes just a couple of minutes" then puts new players against AI for "a good few hours rather than being thrown to competitive players immediately." Balatro skips tutorials altogether in favor of tooltip discovery.

**For Aetherfall:** First session is co-op, so onboarding must NOT be a single-player wall. A first fight that ramps up boss complexity gradually, with hover-tooltips on every keyword, beats a tutorial level.

### 3.11 Mobile vs desktop

Mobile breaks two specific things: text density (STS mobile "the small display means the game's UI needs to convey a lot of information… players report eye strain") and tiny touch targets. Marvel Snap was *designed* mobile-first: "evolving ergonomics of phones, moving interactive elements closer to the bottom half of the screen."

**For Aetherfall:** Browser-first, but we should test the layout at narrow viewports now. The painted PNG art will hold up; the hover-reveal secondary buttons in the bottom bar may not work on touch.

### 3.12 Accessibility

Slay the Spire repeatedly cited as *insufficient*: "no colour-blind mode" and the larger-text setting "increases text size to a negligible degree." Color-blind players struggle to distinguish elites from normal enemies because "the icon shape is the same and the color is the only difference."

**For Aetherfall:** Cheap wins — never use color as the *sole* differentiator (always pair with shape/icon), respect `prefers-reduced-motion`, add at least one text-scale option.

### 3.13 Cross-cutting complaints

Repeated, multi-game pain points:
- Animations that gate input.
- Hidden state (Wildfrost-style "I didn't see the charm").
- No combat log.
- Drag-only with no click fallback.
- Touch-target / scaling problems.
- Co-op slowness with no hand visibility.
- Weak accessibility.

These show up across Hearthstone, MTG Arena, Wildfrost, Across the Obelisk, STS mobile, and LoR — the *entire genre* fails in roughly the same places. Indie quality of life can punch above its weight here.

---

## 4. Specifically applicable to Aetherfall (concrete recommendations)

1. **Never block input on animations.** Mirror Slay the Spire: let a player queue/preview/cancel cards while resolution effects play their own pace.
2. **Persistent boss-intent strip with phase preview.** Show next-turn intent (damage, status, fixate target) AND a "next phase at X HP" indicator. Community asks for *more* intent transparency, not less.
3. **Status icon + tooltip pairing on every entity.** Each element-type debuff (water/toxic/overclock) gets a persistent icon with stack count *and* hover-tooltip — Wildfrost's failure was tooltips alone.
4. **Click-to-cast with auto-target fallback, drag as alternate.** Avoid Across the Obelisk's "cards can only be played using drag and drop" trap. Trackpad/mobile users get punished by drag-only.
5. **Massive, generously spaced target hitboxes.** Slay the Spire's "you will never accidentally target the wrong person" is the bar.
6. **Battle log: keep the corner widget; latest-first; expandable to full overlay; filterable by damage / status / phase.** This single feature beats a third of STS mods that exist *because* the base game lacks it.
7. **Show your partner's hand in 2P co-op.** Across the Obelisk forces players into chat/emote workarounds; we can be radically more transparent.
8. **Blessing draft = synchronized picker.** Both players see both options, both vote, deterministic tiebreak — Across the Obelisk's voting+tiebreak pattern, applied to the blessing screen.
9. **Suggest-card / ping emote for the planning phase.** "I think you should slot this card third."
10. **Skippable / speed-up resolution on repeat fights.** First boss kill cinematic; second run instant.
11. **Bake in the cheap accessibility wins now.** Color + shape for elements (never color alone), `prefers-reduced-motion` respect, real text-scale slider.
12. **Test the bottom action-bar hover-reveal at narrow viewports.** Hover on small screens / touch is unreliable. Either keep secondary buttons visible-but-quiet, or have an explicit toggle, not pure hover.

---

## 5. Sources

- https://www.cloudfallstudios.com/blog/2018/2/20/flash-thoughts-slay-the-spires-ui
- https://medium.com/@yyh19971004/balatro-design-analysis-visual-packaging-and-interactive-feedback-cc6fa6a65370
- https://www.gameuidatabase.com/gameData.php?id=1935
- https://slaythespire.wiki.gg/wiki/Intent
- https://slay-the-spire.fandom.com/wiki/Intent
- https://gordianblade.com/reveal-enemy-intents-or-how-i-run-rpg-combats-like-slay-the-spire/
- https://sts2.untapped.gg/en/guides/how-to-read-enemy-intent
- https://steamcommunity.com/app/2868840/discussions/0/4633736723121165181/ (STS2 expanded intents)
- https://steamcommunity.com/app/646570/discussions/2/2650805212045372980/ (STS combat log suggestion)
- https://steamcommunity.com/app/2868840/discussions/0/802341528343324130/ (STS2 combat log request)
- https://www.nexusmods.com/slaythespire2/mods/595 (Adventure Log mod)
- https://www.nexusmods.com/slaythespire2/mods/100 (STS2CombatLogMod)
- https://www.familygamingdatabase.com/accessibility/Slay+the+Spire
- https://steamcommunity.com/app/2868840/discussions/0/802341195824274153/ (STS2 text size)
- https://steamcommunity.com/app/646570/discussions/0/2805074491020289038/ (Elite icons & colorblind)
- https://afb.org/aw/spring2025/low-vision-game-survey
- https://jlericson.com/2021/03/04/slay_the_spire_ios.html
- https://eu.forums.blizzard.com/en/hearthstone/t/animations-are-so-slow-its-painful/5411
- https://us.forums.blizzard.com/en/hearthstone/t/slow-combat-animations-in-battlegrounds-%E2%80%93-unfair-turn-time/148375
- https://jboger.substack.com/p/hearthstone (Hearthstone Dramatic Signs & Feedbacks)
- https://www.michaelcalcada.com/snap.html (Marvel Snap UI/UX)
- https://bootcamp.uxdesign.cc/marvels-snap-ui-ux-case-study-9f727d8f3875
- https://www.marvel.com/articles/games/a-starter-guide-on-how-to-play-marvel-snap
- https://feedback.wizards.com/forums/918667-mtg-arena-bugs/filters/new?category_id=352600
- https://www.pcgamer.com/legends-of-runeterra-review/
- https://www.pcgamer.com/cobalt-core-review/
- https://wildfrostwiki.com/Keywords
- https://steamcommunity.com/app/1811990/discussions/0/3826413850823344641/ (Wildfrost difficulty)
- https://store.steampowered.com/app/1385380/Across_the_Obelisk/
- https://www.co-optimus.com/game/8648/pc/across-the-obelisk.html
- https://steamcommunity.com/app/1385380/discussions/0/3428948355371256579/ (ATO co-op review)
- https://steamcommunity.com/app/1385380/discussions/2/ (ATO bugs/suggestions)
- https://www.gunslingersrevenge.com/posts/development/deckbuilder-ui-design-best-practices.html
- https://gameanatomy.blog/2025/05/04/simultaneous-planning-in-games/
- https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics (Megacrit GDC 2019)
- https://forum.paradoxplaza.com/forum/threads/reminder-to-the-devs-that-nested-tooltips-is-bad-ux-design.1702017/
- https://rogueliker.com/roguelike-deckbuilders/
