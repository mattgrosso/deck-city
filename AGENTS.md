# Deck City — Agent Instructions

Deck City is a deck-building city-builder game, built collaboratively by two
people, both working with Claude. This file is the shared source of truth
for both. If you're an AI assistant working in this repo, read this before
making changes.

## Stack

- **Vue 3** (Options API) — the whole UI, on a fixed 1920×1080 stage scaled
  to the viewport (TV-first; see docs/STS-LESSONS.md). Phaser was dropped
  in the 2026-10-29 rebuild.
- **three.js** — the city board (`src/world/`), Kenney CC0 city kits in
  `public/models/`; card pictures are pre-rendered from the same models
  (`scripts/render-card-art.mjs`). See STATUS.md "Real graphics".
- **Vite** — dev server & bundler (vite.config.js also defines the
  `process.env.VUE_APP_*` values the shared house modules read)
- **Vitest** + **@vue/test-utils** — testing
- **ESLint** (flat config) — linting
- **yarn** — package manager (yarn.lock is committed; don't switch to npm/pnpm)

The game is built browser-first, played on a TV with a controller (Gamepad
API; the keyboard mirrors every button). The plan for Steam distribution is
to wrap this same build in Electron once the game is further along — not
scaffolded yet, and shouldn't be until it's actually needed.

## Commands

```
yarn install       # install dependencies
yarn dev           # dev server with hot reload
yarn build         # production build to dist/
yarn preview       # preview a production build locally
yarn lint          # eslint
yarn lint:fix      # eslint --fix
yarn test          # vitest, watch mode
yarn test:run      # vitest, single run (use this in CI / before committing)
yarn test:coverage # vitest with coverage
yarn deploy        # lint + tests + build + S3 sync + CloudFront invalidation (--profile personal)
yarn fetch-bug-reports / yarn resolve-bug-report   # the hub's bug-button loop (.env.local)
```

Before considering a change done: run `yarn lint` and `yarn test:run` and
make sure both are clean.

## Project structure

```
src/
  main.js          # Vue app entry point + house kit (usage ping, Sentry, SW)
  App.vue          # the orchestrator: game instance, modes, input dispatch
  style.css        # tokens + the scaled stage
  ui/              # pure helpers: input.js, layout.js, cardText.js, icons.js
  world/           # cityLayout.js (pure), cityWorld.js (three.js), cardArt.js
  components/      # the screen (TopBar, CityBoard, Hand, GameCard, Market, ...)
  components/shared/, utils/, firebase.js, sentry.js   # house modules (hub copies)
  game/core/       # the rules engine: plain JS, no Vue, fully unit-tested
  test/            # App.test.js drives the shell by controller actions
```

Path alias `@` points to `src/` (configured in vite.config.js, vitest.config.js,
and jsconfig.json — keep all three in sync if it changes).

As game logic grows, prefer keeping rules/state (cards, decks, the city grid,
turn logic) in plain JS modules under `src/game/`, separate from Phaser
rendering code. Plain JS is easier to unit test than code entangled with a
Phaser Scene.

## Conventions

- 2-space indentation, no enforced quote style (see eslint.config.js)
- Vue Options API, not Composition API — matches the author's other projects
- Everything the player does goes through `App.act(action)`, so a feature is
  testable by firing actions (`src/test/App.test.js`), and a screenshot run
  is a Playwright script pressing keys.
- House standards (bug button, resolution notices, auto-update, build stamp)
  are present and expected to stay.

## Workflow

- No direct pushes to `main` — all changes go through a feature branch + PR.
  (2026-10-29: Matt is working solo on `feature/goals-facilities-adjacency`
  for a while; commits land there directly and deploy from his machine. One
  PR to `main` when Brian comes back in.)
- CI (`.github/workflows/ci.yml`) runs lint + tests on every push and PR.
- Merging to `main` triggers `.github/workflows/deploy.yml`, which builds the
  app and deploys it to AWS (S3 + CloudFront) automatically. There is no
  manual deploy step in the normal workflow.
- Keep PRs small and focused. Don't add new dependencies without a clear
  reason — this is a two-person project and every dependency is something
  both people need to be able to reason about.

## The economy (read before changing a number)

Every card is priced in **budget**, one coin of this turn's treasury
(Matt, 2026-10-29: "a unified and consistent economy", the way Commonwealth
prices everything in shifts). Three files:

- `src/game/core/economy/economy.js` - the VALUES: what a point of revenue,
  a person, a job, a status card, a draw... is worth in budget, plus the
  dials (`HORIZON` turns a lasting effect counts over, `SPEND` of revenue
  that actually gets spent, `CYCLE`, `FAIR` band) and `BARGAINS`, the
  named, reasoned exceptions.
- `src/game/core/economy/priceList.js` - prices every card: PLAY (cost vs
  one build), BUY (market `price` + build `cost` vs one build and a spare),
  GOALS (reward now + the Monument card; rewards must rise with tier),
  THREATS (what status cards, disasters and unemployment cost you).
- `src/game/core/economy/economy.test.js` - FAILS when anything lands off
  the line without a named bargain, when a card uses an effect with no
  value, or when goal rewards stop rising with tier.

`yarn price` writes `docs/ECONOMY.md`; `yarn reprice` sets every
`null` cost in cityCards.js from the economy (`--all` re-prices every
city card); `yarn selfplay [n]` plays whole games with a robot for
pacing. **Changing a card or adding one:**
price it (run `yarn price`), move it onto the line, or add a BARGAIN with
its reason. A new effect type gets a value in `valueOfEffect`; a new
card property that is worth something (like `clears`, `blocksDisasters`)
gets a line in `valueOfBuild`. Market cards carry `price` (to buy) apart
from `cost` (to build).
