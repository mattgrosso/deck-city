# Deck City — status

A running handoff doc between the two of us (and our AI assistants) — what's
built, what's live in `main` right now, and where the design is headed next.
See [AGENTS.md](./AGENTS.md) for stack/commands/conventions.

_Last updated: 2026-07-22._

## What's merged and playable in `main` right now

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
