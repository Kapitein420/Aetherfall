# Aetherfall — AAA Menu & Title Screen Design Spec

This document is the design + technical brief for the pre-game flow:
**Boot logo → Title splash ("press any key") → Main menu → Encounter selection → Class selection → Loading transition → Combat**.

The matching art-asset rows live in `asset-inventory.xlsx` (sheet "Menu and Title") and the machine-readable spec is in `asset-manifest.json`. This file is the **how-it-feels-and-works** companion.

---

## 1. The flow at a glance

```
[Boot logo, 1 frame, 3s]
        ↓
[Title splash]   ← parallax background, embers, "PRESS ANY KEY"
        ↓ (any key / click)
[Main menu]      ← Continue / New / Options / Credits / Multiplayer
        ↓
[Encounter selection]   ← scenario cards with hover tilt
        ↓
[Class selection]       ← carousel of class banners
        ↓
[Loading transition]    ← banner sweep + tip text
        ↓
[Combat]
```

Each transition is **≤ 600ms** and uses the same easing curve (`cubic-bezier(0.2, 0.8, 0.2, 1)`) so the whole flow feels rhythmically consistent.

---

## 2. Title splash — the Elden Ring moment

This is the first impression. It does **three** things:

1. Sets the tone (atmospheric, weighty, unhurried).
2. Confirms the game is responsive (key press → state change).
3. Hides the cost of warming up the audio system, the menu DOM, and any preloads.

### Layout

| Layer | Z-index | Element |
| --- | --- | --- |
| 0 | 0 | **Background — sky / sigil** (parallax far) |
| 1 | 1 | **Background — ruins / monsters** (parallax mid) |
| 2 | 2 | **Foreground — character silhouette** (parallax near) |
| 3 | 3 | **Particle layer** (tsParticles canvas — embers/dust) |
| 4 | 4 | **Game logo** (centered, slow vertical bob) |
| 5 | 5 | **"PRESS ANY KEY" prompt** (slow opacity breath, 4s loop) |
| 6 | 6 | **Audio cue surface** (invisible, captures any keydown / click / touch) |

### Parallax math

- Each layer translates by `mouseOffsetX * (layerDepth / 100)` and `mouseOffsetY * (layerDepth / 100)`.
- Far = 1, mid = 2, near = 3 (in %).
- `transform: translate3d(...)` so the GPU does it; no JS layout.
- Library: **tsParticles' built-in parallax mover** (pure CSS works fine for 3 layers).

### Particles

- 80–120 ember particles, low contrast against the background.
- Mouse repulsion radius ~120px (cursor pushes them aside).
- Slow upward drift, occasional flicker.
- tsParticles `confetti` preset is **wrong** — too playful. Use the `fire` or `ember` slim bundle config tuned with `move.speed: 0.6`, `opacity.value: { min: 0.05, max: 0.4 }`.

### "Press any key" prompt

- Centered horizontally, 60% down the screen (rule-of-thirds bottom).
- Fades in after **1.2s** so the title art has a beat to land first.
- Slow opacity breath (3s loop, 0.55 → 1.0 → 0.55).
- Listens for **any** of: keydown, mousedown, touchstart. Captures once, then transitions.

### Audio

- Atmospheric drone loop, 60–120s, gentle reverb.
- Music ducks to 60% on the press; transition WHOOSH plays at 100%.
- Library: **Howler.js** (rock-solid web audio with sprite support).

### Acceptance

- [ ] First paint < 250ms (everything else lazy-loads behind the splash).
- [ ] Logo bob is barely-perceptible, not goofy.
- [ ] Prompt never strobes — the breath is slower than 3s.
- [ ] Pressing any input transitions in ≤ 600ms.

---

## 3. Main menu

### Style

Vertical menu, items list-aligned (no center). Each item:

- 120px row, transparent background by default.
- On hover: scale 1.04, faction-color underline grows from left, soft glow, 200ms ease.
- Active (selected): persistent underline + brightness 1.1.

### Items

1. **Continue** — only if a save exists (faded if not).
2. **New game** — primary action, slightly heavier weight.
3. **Multiplayer** — opens the existing host/join panel (currently bottom-right) as a modal.
4. **Options** — sound, video, accessibility (high-contrast, reduced motion).
5. **Credits**.
6. **Quit** (web build: returns to splash).

### Audio

- Hover plays a short ui-hover swoosh.
- Click plays ui-click + a 600ms transition out.

---

## 4. Encounter selection — the showpiece

### Layout

Three encounter cards at first; scrollable for more. Each card:

- 480 × 320 hero card.
- Encounter banner art covers the top 70%.
- Title strip (encounter name + role + summary) covers the bottom 30%.
- Default state: subtle drop shadow, 0.95 brightness.
- **Hover: 3D tilt** — `transform: rotateY(...) rotateX(...)` driven by mouse position relative to card center.
- Hover also: scale 1.06, brightness 1.08, faction-color glow.
- **Selected**: persistent lift (translateY -8px) + thick faction-color border.

### 3D tilt math (CSS-only)

Inspired by the [3D Card Hover examples on CodePen](https://codepen.io/boom123bam/pen/YzBboEJ) and the [holographic card effects](https://prismic.io/blog/css-hover-effects):

```js
card.addEventListener('mousemove', (e) => {
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const rotateY = ((x / rect.width) - 0.5) * 14;   // -7° to +7°
  const rotateX = -((y / rect.height) - 0.5) * 10; // -5° to +5°
  card.style.transform = `perspective(800px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) scale(1.04)`;
});
card.addEventListener('mouseleave', () => { card.style.transform = ''; });
```

Performance: animate `transform` only (compositor-friendly), 60fps even on integrated GPUs. The same pattern is documented as best practice in the [CSS hover effect performance notes](https://cssauthor.com/css-hover-effects/).

### Audio

- Subtle whoosh on hover-in.
- Click plays a "select" cue + 400ms transition into class selection.

---

## 5. Class selection

### Layout — horizontal carousel

- Active class: center, 100% size, full banner visible.
- Adjacent classes: 60% scale, 60% opacity, partially off-screen left/right.
- Mouse wheel / arrow keys cycle. A short 240ms slide animation plus a slight inertia overshoot.

### Info panel

Below the active card:

- Tagline (large)
- Role · faction
- Aspect chips (Burst / Risk-Reward / Storm Charge ...)
- Summary paragraph
- Bottom: a row of mini card faces showing the deck's "signature 4" cards

### Multiplayer note

If multiplayer is connected, each connected peer's selection is shown as a small avatar above their picked class. Switching is disabled if a peer locks in.

---

## 6. Loading transition

When the player commits to an encounter, before combat starts:

1. Encounter banner sweeps in left → right (300ms).
2. A "tip" line appears below ("Drop one Pack Hunter fast or take sustained pressure.").
3. Hold 1500ms; preload monster portraits, card sprites, audio.
4. Banner fades, combat fades in.

---

## 7. Recommended libraries

| Need | Library | Why |
| --- | --- | --- |
| Ambient particles | [tsParticles](https://particles.js.org/) | Modern, framework-agnostic, parallax & mouse-repel built-in |
| Audio | [Howler.js](https://howlerjs.com/) | Reliable web audio, sprite sheets, ducking |
| Animation orchestration | [Motion One](https://motion.dev) or **GSAP** | Timeline-based, easy stagger; both performant |
| 3D card tilt | Pure CSS + 1 listener (no library needed) | See math above |
| Menu transitions | CSS `view-transition-name` (modern browsers) or manual fade | 1 line for cross-fade if browser supports it |

The library set is **deliberately minimal** — every import is one HTTP request the splash has to wait on. The current stack is no-build, plain ES modules; that doesn't have to change. Each of the above ships an ESM import that's < 30KB gzipped.

---

## 8. References & inspiration

### Title screen
- [Elden Ring main menu — Game UI Database](https://www.gameuidatabase.com/gameData.php?id=1371) — minimalist title art + "PRESS ANY BUTTON"
- [Elden Ring loading screen — Wiki](https://eldenring.fandom.com/wiki/Loading_Screen) — concept-art splash, persistent identity
- [A mini deep dive into Elden Ring's UI/UX — Marcel Bonzani](https://medium.com/@marcelbonzani/a-mini-deep-dive-into-elden-rings-ui-ux-9ccbc271cc9b) — what works and why

### Particle backgrounds
- [tsParticles homepage](https://particles.js.org/) — the canonical modern library
- [Interactive React backgrounds with tsParticles](https://www.somethingsblog.com/2024/10/20/interactive-react-backgrounds-with-tsparticles/) — 2024 walkthrough
- [Pure CSS particle animation — CodePen](https://codepen.io/tonkotsuboy/pen/zJbKNN) — proves you can do it with zero JS for very lightweight setups

### Card hover effects
- [3D Card Hover + Animated Background — CodePen](https://codepen.io/boom123bam/pen/YzBboEJ) — the exact tilt + glow we want for encounter cards
- [43 CSS Card Hover Effects — Free Frontend](https://freefrontend.com/css-card-hover-effects/) — broad menu of approaches
- [40+ CSS hover effects with code — cssauthor](https://cssauthor.com/css-hover-effects/) — performance commentary on each
- [40 engaging CSS hover animations — Prismic](https://prismic.io/blog/css-hover-effects) — categorized by technique

### Card-game UI prototypes
- [Card game UI — CodePen by Souji](https://codepen.io/Souji/pen/JJwJMB) — full-flow flip / hand fan
- [CSS menu examples — Freebie Supply](https://freebiesupply.com/blog/css-menus/) — vertical menu treatments

---

## 9. Implementation phasing

The splash + main menu work can ship in three increments without blocking gameplay:

### Phase A — Skeleton (1 PR, no new art)
- Routing: `setup.phase === 'splash' | 'main' | 'encounter' | 'class' | 'loading' | 'combat'`.
- Plain CSS placeholders for each screen.
- Keyboard / click input wired to advance.
- Goal: **flow works**, ugly.

### Phase B — Atmosphere (1 PR, banner art reused)
- tsParticles ember layer.
- Howler audio loop + click duck.
- Cubic-bezier transitions between screens.
- Goal: **feels alive**, art still placeholder.

### Phase C — Showpiece (1 PR, real splash art)
- Title splash art (3-layer parallax PNGs).
- 3D card tilt on encounter selection.
- Class carousel with carousel inertia.
- Goal: **AAA polish**.

---

## 10. Accessibility

- Every animation gates on `prefers-reduced-motion: reduce` — collapses to fades.
- Every audio cue gates on a Settings toggle; defaults to ON but respects browser autoplay rules.
- Color cues (faction palette, intent tier) always pair with a text label or icon shape so they don't fail on color-blind users.
- Menu navigable via keyboard alone (Tab + Enter + arrows).

---

*Last updated: 2026-05-10. See `asset-inventory.xlsx` for the complete art shopping list.*
