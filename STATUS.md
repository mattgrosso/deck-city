# Deck City — status

A running handoff doc between the two of us (and our AI assistants) — what's
built, what's live, and where the design is headed next.
See [AGENTS.md](./AGENTS.md) for stack/commands/conventions.

_Last updated: 2026-10-29._

## 2026-10-29: the TV rebuild (branch `feature/goals-facilities-adjacency`)

Matt picked the project back up after three months and decided to go hard
solo for a while before bringing Brian back in, so this branch is now the
working branch: commits land on it directly, no PRs, and it deploys from
this machine with `yarn deploy`. One PR to `main` when it's time.

**Live at https://deckcity.aroundtableround.com** — part of the Around Table
Round family now (bucket `aroundtableround-deck-city`, CloudFront
`EEMSOM4VGCYG5`, Route 53 alias on the hub's wildcard cert). The hub card is
`data-admin-only hidden` like Commonwealth's: only a signed-in admin sees it
on aroundtableround.com. The old `deck-city` bucket / `E3OE80F3CN2B1X`
distribution and the GitHub Actions deploy on `main` still exist, untouched,
serving July's build; retire them when `main` catches up.

**The whole UI was rebuilt for a TV and a controller.** Phaser is gone;
the shell is plain Vue + CSS on a fixed 1920×1080 stage scaled to the
viewport. The design brief was Slay the Spire 1 and 2 — layout, hand,
board, cards, controls — and the lessons are written down in
[docs/STS-LESSONS.md](./docs/STS-LESSONS.md). The engine under
`src/game/core/` is untouched and still carries every test.

- `src/ui/input.js` — Gamepad API + keyboard → one action vocabulary
  (up/down/left/right, select A, back B, confirm Y, deck X, piles LB/RB,
  menu Start; arrows/Enter/Esc/E/Tab/Q/R/M on a keyboard). Held directions
  repeat. Y never ends a phase while a card is selected (the StS2
  accidental-end-turn lesson).
- `src/ui/layout.js` — the fan geometry (focused card rises and grows,
  neighbours slide apart) and the grid cursor (nearest valid cell in the
  pressed direction).
- `src/ui/cardText.js` — every card's rules text, keywords and family colour
  derived from its data, so a new card needs no copy.
- `src/App.vue` — the one orchestrator: modes `hand → target / civic`,
  `market`, `pile`, `summary`, `over`, `menu`. Build phase = the hand is
  lit; Done building (Y) → Acquire = the market rows are lit; End turn (Y)
  runs endOfTurn/cleanup/draw and shows an "Overnight" card with the log
  lines before the next hand.
- Components: `TopBar` (turn, population/target, jobs, next budget, status
  counts, disaster clock), `CityBoard` (roads as edges, tiles, targeting
  cursor and ghost), `Hand`, `GameCard`, `Market` (city row + goals with
  READY badges and the expiry countdown), `PileView` (draw/discard/whole
  deck), `Overlay` (title, summary, win/lose, pause), `ButtonLegend`,
  `CardInfo` (keyword definitions for the focused card).

**House kit** (bug button + resolution notices on the hub's Firebase
project under `deckCityBugReports`, auto-update, tap-to-reload build stamp,
usage ping, offline PWA) is in; it's the res-arcana copy adapted for an app
with no store. Sentry is wired but off: neither API token on this Mac may
create a project — paste a DSN into `src/sentry.js` when one exists.

**Real graphics (same day, after Matt: "this doesn't look good enough. Take
some lessons from Commonwealth… these hand-spun cards look bad").** The
Commonwealth recipe: three.js inside the Vue app with Kenney's CC0 kits.
- `public/models/{suburban,commercial,industrial,roads}/` — Kenney's City
  Kit (Suburban / Commercial / Industrial / Roads), GLB + the kit's
  `Textures/colormap.png` (the kits ship palette "variations"; variation A
  is copied in as the colormap the GLBs ask for). `License.txt` in each.
  Fetched from kenney.nl through its `download-link/<hex of assets/<kit>>`
  endpoint with a cookie jar (the page's Download button does the same).
- `src/world/cityLayout.js` — PURE, tested: the engine's grid + buildings +
  roads-as-edges → placements (model, position, yaw, scale, tint). Lots
  are 1.0 units with a 0.48 road gap; an edge with a road is a scaled
  `road-straight`, a corner node where roads meet is the matching
  end/straight/bend/T/crossroad tile. `RECIPES` says what each card id
  builds (residential/commercial/industrial have variants picked by the
  instance's number; facilities are tinted commercial/industrial buildings
  with a prop; parks are trees on green; goals are a gold tower on a
  plaza). Empty cells get 0-2 trees from `treesFor(x, y)`, fixed per cell.
- `src/world/cityWorld.js` — three.js: fixed isometric orthographic
  camera framed once on the grid, hemisphere + sun with shadows, diff by
  placement id with pop-in/shrink-out, valid lots lit green, a white ring
  under the cursor, the selected card's recipe as a translucent ghost.
  Transparent background: the board floats on the stage.
- `src/components/CityScene.vue` — the canvas + crisp HTML chips (name,
  stats) projected under each building; a flat fallback when WebGL is
  missing (jsdom, old TVs).
- `src/world/cardArt.js` + `dev-art.html` + `scripts/render-card-art.mjs`
  — every card's picture is a small diorama of Kenney parts (buildings use
  their board recipe, so the card shows what you get), rendered ONCE to
  `public/art/<id>.png` by Playwright against the dev server
  (`node scripts/render-card-art.mjs http://localhost:5177`). Re-run after
  changing a scene. `cardArt.test.js` fails if a card has no scene or a
  scene has no PNG.
- `dev-models.html` — a line-up of any kit (`?kit=industrial&page=1`) and
  `window.__measure()` for footprints; measure before placing a new model.
- Type: Rubik (SIL OFL, `public/fonts/`), one variable file.

**Round two (same day; Matt read off a list).** Done:
- *"It should just be a green field … a faintly outlined grid when placing"* -
  one rounded grass slab under the whole city; plot lines are invisible at
  rest and show while aiming; a pale lot + white breathing ring mark the
  cursor; a Road card's ghost is a translucent street around the lot.
- *"The road tiles … look like shit … rotated wrong"* - the kit's 1×1 road
  tiles are gone from the board (they could not be scaled into a 0.48-wide
  street). Streets are drawn from plain geometry in `cityWorld.js`:
  asphalt beds, pavements along both sides, lane dashes, and a pavement
  across every junction side with no street leading off it. The layout
  hands out `roadEdges` (with an axis) and `roadNodes` (with arms).
- *"The whole thing feels kind of dark"* - daylight palette: a pale sky
  stage, white panels, dark ink, warm sun and hemisphere light with soft
  shadows; cards are cream stock (status/disaster cards stay slate).
- *"Everything's kind of chunky … finer lines … smaller"* - the map stayed
  the same size; everything else came down ~25%: 1.5px borders, 22px pills,
  200×292 hand cards, 150×222 market cards, 44px legend, 128px budget orb.
- *"The price on the top left of the cards is gross … a proper card
  frame"* - `GameCard.vue` is a frame now: card stock with a double inner
  rule, a family-coloured name band carrying a small gold coin for the
  cost, an inset picture window, the type line and rules under it. No free
  CC0 frame set fit a modern city game (the free ones are fantasy or plain
  playing cards), so the frame is built in CSS; swap in art if it ever
  exists. Goal cards lost the "becomes a Monument" line (the keyword panel
  says it) so their text fits.

**Round three (same day; Matt's brain dump while playing).** Done:
- *"The labels don't match the buttons on my controller"* - `padKind()` in
  `src/ui/input.js` reads the Gamepad id (Xbox / PlayStation / Switch /
  generic; Xbox is checked first because its id contains Sony's bare
  "Wireless Controller") and `GLYPHS` labels every action per family; the
  legend, the end-phase button and every overlay hint use them. Buttons
  are mapped by POSITION, only the letters change.
- *"The road card art is still the old art"* - Road and Clean Streets are
  drawn from `src/world/streets.js`, the same geometry the board uses.
- *"Get my cursor up to the items in the top bar"* - Up from the hand (or
  the market) enters **look** mode: the cursor walks the plots and an
  `InfoPanel` says what stands there (its rules, slots used) or whether an
  empty plot touches a street. Up past the top row reaches **stats** mode:
  left/right across the top bar, each number explained with today's
  values. B or Down steps back.
- *"I don't know how to play"* - `HowTo.vue`, six screens, opens on the
  first game (localStorage `deck-city:howto-seen`) and from the pause menu.
- *"The grid is isometric but it expects orthogonal directions"* - aiming
  is in SCREEN directions now: every target (plot or edge) carries its
  stage-pixel position from `CityScene.screenOfCell/Edge`, and the d-pad
  picks the nearest target in the pressed direction (`stepCursor` rejects
  anything more than ~60° off).
- *"Roads wrap an entire square … I'd rather have individual segments"* -
  engine change: `addRoadEdge(grid, key)`, `listAllEdges`, `placeRoad(state,
  card, { edge })`, `playCard(id, { edge })` for Road cards; the starting
  city is a two-segment street through the middle. Aiming a Road lights
  every unroaded edge and ghosts the street under the cursor.
- The building chip sits at the plot's front corner now.
- *"Doesn't seem to matter where I put things"* - noted, not changed:
  today only Park (adjacency) and three goals (rows, pairs) care. A design
  conversation, not a bug.

**Not done / next:** nobody has played a full game on the TV yet — that's
the point of all this. Then: tune every number (all still first guesses),
decide whether Build and Acquire should be one phase, sound, the road-chain
goal condition, more goals, art.

## What was merged and playable in `main` as of July

Four PRs landed so far, in order:

1. **Core engine framework** (`src/game/core/`) — plain-JS, zero
   Phaser/Vue imports, fully unit-tested. A data-driven card schema
   (building/status/goal/disaster/civic), a generic effect registry, Deck/Row
   pile primitives, player state, and a 5-phase turn manager (draw → build →
   acquire → endOfTurn → cleanup). `createGame(...)` in `game.js` is the
   single entry point everything else uses.
2. **Minimal HUD** — turn/phase/treasury/log sidebar wired to a live game
   instance.
3. **City grid + hand bar + card visuals** — a Phaser-rendered grid, cards
   rendered as color-coded visuals (`CardView.vue`, colors/icons centralized
   in `src/game/theme.js`), hand pinned to the bottom of the screen.
4. **Roads-as-edges + a real starter deck** — roads paint the 4 borders of a
   cell instead of occupying it; every other building requires road frontage;
   the starter deck (`cards/starterCards.js`, 10 cards) is real content.

## Not yet merged: the full game loop (feature/goals-facilities-adjacency)

Everything the "design direction" section below used to describe as
*agreed-but-not-built* is now built, on a feature branch, not yet in `main`.
This is the biggest single change to the engine since the original core
framework — worth a careful read before merging, and likely still needs a
real playtest pass for balance (every number in it is a first-pass judgment
call, same disclaimer `starterCards.js` already carries).

**Budget rework**: treasury hard-resets every 'draw' phase to
`calcStatTotal(revenue) + baseRevenue` (default 4) — no banking, calculated
at the start of turn as designed. `baseRevenue` is a new, undesigned addition
though: a pure production-based reset means turn 1 (zero buildings) resets
straight to 0 and the game can never recover on its own, so a flat municipal
income floor was necessary to make the reset model bootstrap at all. The
escape valve is `state.treasuryRolloverCap` (0 by default, raised by the City
Bank goal) — up to that much of last turn's leftover carries forward on top
of the reset.

**Adjacency**: `calcStatTotal` now folds in `card.adjacency.statBonus` (a
building granting a stat bonus to matching-tagged neighbors), and a new
`gainStatusPerAdjacent` effect covers the other half (status generation keyed
off neighbor count). Both are exercised by Park, the one adjacency card that
exists so far.

**Facility ecosystem**: one dedicated consumer per status type — Police
Station (Crime), Sanitation Center (Trash), Clinic (Pollution) — plus Fire
Station (heads off the disaster timer permanently via a new `headOffDisaster`
effect, `onBuild`) and Park (the adjacency showcase). All five live in the
city row now (`cards/facilityCards.js`, `CITY_DECK_CARDS` — 2 copies each,
10-card deck, revealed 4 at a time), acquirable with treasury during the
`acquire` phase — the city row was previously wired up in the engine but
never actually given content, so it always rendered empty.

**Disaster hookup**: the disaster timer (4-turn countdown) was already
tracked but genuinely inert before this — nothing consumed a deadline hit.
Now, hitting the deadline unheaded-off shuffles a random disaster card
(`cards/disasterCards.js`: Flood, Blackout) into the draw pile; disasters
bite via a new `onDraw` trigger, resolved immediately as a card enters hand
(previously declared in `exampleCards.js`'s FLOOD but never actually wired to
anything).

**Goal deck/row/condition system**: a second market row
(`cards/goalCards.js`, `GOAL_DECK_CARDS`, one copy of each of 7 goals,
revealed 3 at a time — `game.actions.claimGoal`), gated by a small condition
DSL (`src/game/core/conditions/` — `populationAtLeast`, `treasuryAtLeast`,
`buildingCountAtLeast`, `statusCountAtMost`, `adjacentPair`, `adjacentChain`,
`all`/`any`) instead of treasury. A claimed goal becomes a free, buildable
"monument" (`skipsRoadRequirement: true`, a new card flag) with a uniform
+1 revenue / +1 population — not hand-tuned per goal yet, a deliberate scope
cut to keep this pass from turning into a full balancing pass. Every 4 turns,
the lowest-`tier` unclaimed visible goal expires (`piles/row.js`'s new
`expireLowestValue`, a generic value-based variant of `expireOldest`).

**Win/lose**: population ≥ `populationTarget` (default 20, checked every
`endOfTurn`) wins; the goal deck's draw pile, discard pile, and visible row
all being simultaneously empty loses. `state.gameStatus` gates
build/acquire/claim (not phase advancement) once it leaves `'playing'`; the
Vue layer shows a full-screen win/lose banner.

**Known gap from this pass**: the original design's "Historic District" goal
(3 Roads in an unbroken line) isn't implemented — roads are grid *edges*, not
built instances, so the `adjacentChain` condition (built for cell-based
chains) can't express it as-is. Substituted a Residential-row goal
(`goal-housing-row`) that the existing condition machinery can actually
evaluate; a road-specific chain condition is future work if that exact goal
is wanted.

**Also new**: MainScene.js's rendering got a real pass — shadow/sheen layers
per cell for a sense of depth, small stat-badge readouts under built
structures (population/jobs/revenue, plus used/capacity for consumer
buildings), a gold outline for monuments, rounded road joints, and a pulsing
glow on placement-eligible cells — all still plain Phaser primitives (no art
pipeline), but meaningfully more readable than flat color blocks.

**Bug found and fixed during this pass, worth flagging**: `Hud.vue`'s city
row and goal row were keyed by `card.id` — harmless while the city row was
always empty, but a real bug once it actually held 2 simultaneous copies of
the same facility (duplicate Vue `:key`s corrupt list rendering rather than
throwing). Fixed by keying on position instead, matching the pattern
`HandBar.vue` already used for hand cards for the identical reason.

## Next step

Not merged to `main` yet. Before that: a real playtest pass (numbers are
untuned), and canvas-click build-placement specifically should get a manual
check — automated browser testing in this environment couldn't reliably
verify pixel-perfect grid clicks (a tooling/coordinate-mapping limitation,
not a code change — the click-handling wiring itself is untouched from what
was already shipped), though every other interaction (phase advancement,
acquiring, arming a card, the budget reset, disaster ticking) was confirmed
working live.
