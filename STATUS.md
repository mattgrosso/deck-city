# Deck City — status

A running handoff doc between the two of us (and our AI assistants) — what's
built, what's live in `main` right now, and where the design is headed next.
See [AGENTS.md](./AGENTS.md) for stack/commands/conventions.

_Last updated: 2026-07-14_

## What's merged and playable in `main` right now

Four PRs landed so far, in order:

1. **Core engine framework** (`src/game/core/`) — plain-JS, zero
   Phaser/Vue imports, fully unit-tested. A data-driven card schema
   (building/status/goal/disaster/civic), a generic effect registry
   (~7 handlers: gainTreasury, spendTreasury, gainStatus, consumeStatus,
   drawCards, discardCards, expandSlots), Deck/Row pile primitives, player
   state (treasury, built structures with per-instance consumer slots,
   goals, disaster timer), and a 5-phase turn manager (draw → build →
   acquire → endOfTurn → cleanup). `createGame(...)` in `game.js` is the
   single entry point everything else uses.
2. **Minimal HUD** — turn/phase/treasury/log sidebar wired to a live game
   instance.
3. **City grid + hand bar + card visuals** — the game actually looks like
   something now: a Phaser-rendered grid, cards rendered as color-coded
   visuals (`CardView.vue`, colors/icons centralized in `src/game/theme.js`),
   hand pinned to the bottom of the screen. Building is click-to-target:
   arm a hand card, click an empty grid cell.
4. **Roads-as-edges + a real starter deck** — roads paint the 4 borders of
   a cell instead of occupying it (`state/cityGrid.js`); every other
   building now requires road frontage to be placed; new games start with
   a small pre-roaded patch. The starter deck is real content now
   (`cards/starterCards.js`, 10 cards: 3 Road, 2 Residential, 2 Commercial,
   2 Industrial, 1 Civic Works), separate from the illustrative
   `cards/exampleCards.js` the engine's own tests use. Civic Works is a
   discard-2/draw-2 card with genuine player choice (click it, then click
   2 hand cards to mark them).

**Playable today**: draw a hand, build Road/Residential/Commercial/
Industrial on a grid gated by road access, watch status cards (Crime/
Trash/Pollution) pile into your discard pile, cycle your hand with Civic
Works. No facilities, no adjacency effects, no goals, no win/lose
condition yet — see below.

Run it with `yarn dev`. Test with `yarn test:run` (104 tests passing as of
the last PR). See [AGENTS.md](./AGENTS.md) for the full command list and
workflow (feature branch + PR, no direct pushes to `main`).

## Design direction agreed for the next phase (not yet built)

We worked through a fairly complete game design for what comes after the
framework — this is agreed direction, not yet implemented:

**Budget**: treasury hard-resets each turn to what your city currently
produces (no accumulation) — calculated at the start of turn, not the end.
This is a deliberate departure from typical deckbuilders (Dominion-style
banking), closer to a city's tax-base budget. The escape valve is earned,
not automatic (see City Bank goal card below).

**Adjacency**: buildings can affect grid neighbors two ways — a stat bonus
(e.g. Park: +1 revenue to adjacent Residential) and/or triggered status
generation at turn start (e.g. Park: +1 Crime per adjacent Residential).
Both reuse existing engine patterns (`calcStatTotal`, the `onTurnStart`
trigger already used by consumer buildings) rather than needing a new
resolution system.

**Facility ecosystem**: tightening to one status per zone type, each with
exactly one dedicated consumer facility, so facilities are something you
*want*, not just afford:
- Residential → Crime → **Police Station**
- Commercial → Trash → **Sanitation Center**
- Industrial → Pollution → **Clinic**
- **Fire Station** — doesn't consume a status; heads off the disaster
  timer instead, finally giving the existing (currently inert)
  disaster-timer mechanic a real counterplay.
- **Park** — the adjacency card above.

**Goals as the game's clock — this is the win/lose condition**: a second
depleting deck, 3 cards visible at a time (same market-row pattern as the
city row). Claiming a goal is free — its condition (not treasury) is the
price — and claimed goals become placeable "monument" buildings that skip
the road-frontage requirement. Every 4 turns, whichever visible goal has
the *lowest rank* and hasn't been claimed expires unclaimed and is
replaced — so cheap/early goals are the fragile, time-pressured ones, and
tough ones stick around longer. **Win**: population hits a target
(checked every turn, independent of the goal deck). **Lose**: the goal
deck + row are exhausted before that happens. Ten example goal cards were
drafted with deliberately varied condition shapes (thresholds, building
adjacency pairs, "zero of X" cleanliness checks, spatial line/chain
patterns) — e.g. **City Bank** (treasury ≥8 in one turn → permanent budget
rollover up to 10), **Prison** (pop ≥20 + 2 Police Stations → auto-eats 1
Crime/turn but generates Unrest, which only Park/School can offset),
**Historic District** (3 Roads in an unbroken line → +1 revenue to
everything touching it).

Engine-wise this implies: a grid-aware stat calculation (adjacency), a
second depleting deck alongside the city row, a small generic condition
DSL (`populationAtLeast`, `buildingCountAtLeast`, `statusCountAtMost`,
`adjacentPair`, `adjacentChain`, `all`/`any`) evaluated the same way
effects already are, and ~15 new content cards (5 facilities + 10 goals).

## Next step

This is a bigger lift than any single PR so far — likely scoped into
several: (1) budget rework + adjacency-aware stats, (2) facility content +
Fire Station/disaster hookup, (3) the goal deck/row/condition system +
goal card content. Not yet planned in detail or started.
