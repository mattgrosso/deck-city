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

**Round four (same day; Matt played a game and talked).** This one changed
RULES, all in `src/game/core/` with tests, plus the interface for them:
- **A starting city** (Suburbia's opening: your first tiles ARE your income).
  `createGame({ startingBuildings })` stands buildings with `seedStructure`
  (no effects, no cards). The app starts a house, a shop and a factory on
  the starting street: population 2, jobs 5, budget 5. `baseRevenue` is 0.
- **Roads lay two segments** (`roadSegments: 2`; `playCard(id, { edges })`
  takes 1-2) and **a street must touch a street** (`isEdgeConnected`,
  `listConnectedEdges`; the first street of an empty city may go anywhere).
  The UI aims the second segment from the first; B keeps just one.
- **The field is 12×8** and the world canvas covers the whole stage: the
  grass runs under every panel and the camera frames the city (plus
  whatever is being aimed at) into the clear area, easing out as it grows.
- **Status cards are cleared by hand**: facilities carry `clears: 'crime'`
  etc. and slots; `game.actions.clearStatus(cardId)` trashes a Crime card
  from your hand into a Police Station with a free slot. Nothing happens
  on its own any more.
- **Jobs matter**: at the end of a turn with more people than jobs, one
  Crime card joins the deck (`unemployment` in phases.js).
- **Goals have clocks**: `createRow({ timerFor })` gives each goal its own
  countdown (3 + tier turns), `tickTimers` runs every end of turn, the
  market shows "N turns left" per goal; the goals sit above the city row
  in a gold box. **One claim a turn** (`goalsClaimedThisTurn`).
  **Monuments need a street** like any building.
- **Disasters escalate, Fire Stations block**: the Nth strike brings N
  disaster cards; each standing Fire Station (`blocksDisasters`) blocks
  one. `headOffDisaster` stays registered but no card uses it.
- **The overnight card reads in words**: "Budget this turn: 5 (5 from
  buildings).", "Unemployment: 4 people, 2 jobs. +1 Crime card.",
  "Disaster 2: Flood and Blackout shuffled into your deck (1 blocked by
  Fire Station)." Effects log "Lost 3 budget.", not "-3 treasury".
- Status/disaster cards are light stock with a red band (the slate ones
  were unreadable); the tutorial and keyword panel say the new rules.

Open design threads from this round, not changed: whether unemployment
should have a tolerance; one buy a turn too; the city row's price
gradient (Suburbia); what else placement should matter for.

**Goals are objectives, not cards** (Matt: "they should make it clear what
they require and show what progress we have made towards them"). The
market draws each goal as a `GoalTile.vue`: name, its clock, one line per
requirement with a progress bar and count (`conditionProgress` in
coreConditions.js measures every condition type; 'all' is flattened),
then what claiming it gives, ending with the Monument card that joins
your deck. The goal deck and Monument cards are unchanged underneath.
Building chips on the map show only in look mode (Matt: "only when I am
inspecting the map").

**Adjacency is the decision now** (Matt: "I really want to add a layer of
decision around what gets built next to what"). `instanceStats(state,
instance)` in playerState.js is a building's stats with its four
neighbours counted in (`card.adjacency.statBonus`: `amount` of `stat` per
neighbour tagged `targetTag`, negatives allowed, never below zero per
stat); `calcStatTotal` sums it, so budget, population, jobs, the win
check and unemployment all see it. The first rules: houses +1 pop per
neighbouring house, −1 per neighbouring factory; shops +1 revenue per
neighbouring house, −1 per neighbouring shop; factories +1 revenue per
neighbouring factory; parks unchanged. `previewPlacement` stands a
building in for a moment (on `toRaw` state - on the reactive proxy it
loops) and reports its own stats, the reasons, each neighbour's change and
the city's net change; the aiming panel shows it and green/red chips sit
over the neighbours that change. Look mode explains a building's number
the same way. The starting city now earns 6 (the shop is beside the house;
the factory is kept off it).

**The economy** (Matt: unify every price behind one core value, as
Commonwealth did with shifts). The unit is one budget. See AGENTS.md "The
economy" and the generated `docs/ECONOMY.md`. The first audit moved:
- Commercial cost 3 -> 4 (returned over twice its cost).
- Industrial revenue 2 -> 1 (factories are for jobs; with the cluster bonus
  they returned over twice their cost). Starting city now earns 5.
- Park: no more Crime per neighbouring house each turn (it cost ~10 budget
  over a game against ~2.4 earned); cost 3 -> 2. Just the house's friend now.
- Market cards have a `price` separate from their build `cost` (the market
  used to charge the full build cost, so every facility cost double):
  facilities buy for 1, Fire Station for 2, Park for 1. The market shows a
  gold "Buy N" tag under each card.
- City Bank +3 budget on claim (a tier-3 reward was below every tier-2).
- Road and Civic Works are named bargains; everything else is fair.

**One buy a turn** (Matt: "I can buy way too many cards"): `state.buys`
resets to 1 every draw; `gainBuys` and `buysBonus` add more.

**The city catalogue** (Matt: "a much larger base of buildings... tiered...
much more interesting abilities... just go crazy"). `src/game/core/cards/
cityCards.js`: 113 buildings and 12 civic cards across three tiers, plus
four tokens (Tourist, Commuter, Volunteer, Investor) and a Debt status card.
Families: residential, commercial, industrial, green, services, transit,
leisure & culture, landmarks. The engine vocabulary they use:
- triggers `onNeighborBuilt`, `onClear` beside onBuild/onTurnStart/onPlay;
- effects `gainTreasuryPerAdjacent`, `gainTreasuryPerCount`,
  `gainTreasuryPerStatus`, `clearAnyStatus`, `gainCard` (tokens),
  `gainCardPerAdjacent`, `gainBuys`;
- passives `handSizeBonus`, `buysBonus`, `discount: { tag, amount }`
  (`effectiveCost`), `blocksDisasters: n`, `clears` lists, `unique`,
  `exhaust` (tokens), and city-wide adjacency (`scope: 'city'`, `max`).
Tier I is in the market from the start (with the five services); tier II
joins at 12 people and tier III at 22 (`cityTiers` in createGame,
`unlockTiers` in phases.js). The win is now 30 people. Six goals were
added (Green City, Commuter Town, Industrial Heartland, School District,
Tourist Trap, Full Service City) on a new `tagCountAtLeast` condition.

**Every city card's cost is set by the economy**: write it with `null`
and run `yarn reprice` (tools/reprice.mjs), which writes the cost that
lands it on the line; `price` follows. Five cards could not land and were
redesigned: Trailer Park (4 people), Coal and Chemical Plants (pollute
once, not every turn), Casino (revenue 6), Playground (+pop beside
schools too); Property Tax pays per home.

**Looks**: `src/world/looks.js` draws every city card - hand-picked parts
for the recognisable ones (airport, water tower, stadium, junkyard...),
pooled by family and tier for the rest, scaled from each model's measured
footprint (`footprints.json`). Every card has a picture (159 PNGs).

**`yarn selfplay [n]`** (tools/selfplay.mjs) plays whole games with a
greedy robot (now whole runs; `EARLY=0` stops it calling elections early). Before the run existed: With tiers at 12/22: ~75% won around turn 20, tier II about
turn 4, tier III about turn 14, no losses (the goal deck never ran out),
and decks bloat past 100 cards from status cards. Those are the next
design questions.

**The run (2026-10-29), replacing "30 people wins":** three eras, each
ending in an election judged on a **Mandate** the player picks from two
(`src/game/core/cards/mandates.js`, five per era). **Public Patience** is
each era's clock (`src/game/core/turn/run.js`): it drains every turn by
time, bad cards in the deck, unemployment, a disaster strike and a random
"mood of the town"; `patience` passives on parks, culture and civic
buildings slow it, but never below the drain `floor`. At zero the
election is held: miss the Mandate and the run is lost. A met Mandate can
be called early from the market (half the patience left carries over).
Each era widens the city limits (`grid.limits`, `isInLimits`) and adds a
tier to the City Row. Winning the third era offers an endless city.
Roads are always for sale beside the row (`supplyCardIds`). Boulevard
(3 segments) and Highway (4) joined the transit cards.
`src/game/runSetup.js` holds every number and is what both App.vue and
`yarn selfplay` build from. Self-play with blind Mandate picks: eras of
about 31 to 55 turns, a whole run 110 to 140 turns, the robot passes
about half of Era I. Policies (relics) are set aside for later.

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
