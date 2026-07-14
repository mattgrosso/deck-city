# Deck City — Agent Instructions

Deck City is a deck-building city-builder game, built collaboratively by two
people — one working primarily with Claude, one with ChatGPT. This file is
the shared source of truth for both. If you're an AI assistant working in
this repo, read this before making changes.

## Stack

- **Vue 3** (Options API) — UI shell, menus, HUD
- **Phaser 3** — game engine, mounted inside a Vue component
- **Vite** — dev server & bundler
- **Vitest** + **@vue/test-utils** — testing
- **ESLint** (flat config) — linting
- **yarn** — package manager (yarn.lock is committed; don't switch to npm/pnpm)

The game is being built browser-first. The plan for Steam distribution is to
wrap this same Vue+Phaser build in Electron once the game is further along —
that hasn't been scaffolded yet, and shouldn't be until it's actually needed.

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
```

Before considering a change done: run `yarn lint` and `yarn test:run` and
make sure both are clean.

## Project structure

```
src/
  main.js          # Vue app entry point
  App.vue          # root component, mounts the Phaser game
  style.css        # global styles
  components/      # Vue UI components (menus, HUD, overlays)
  game/            # Phaser code
    config.js      # Phaser game config
    scenes/         # Phaser scenes
  test/            # Vitest tests
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
- Phaser needs a real canvas/WebGL context, which jsdom (the test environment)
  doesn't provide. Tests that touch Phaser mock it — see
  `src/test/App.test.js` for the pattern.

## Workflow

- No direct pushes to `main` — all changes go through a feature branch + PR.
- CI (`.github/workflows/ci.yml`) runs lint + tests on every push and PR.
- Merging to `main` triggers `.github/workflows/deploy.yml`, which builds the
  app and deploys it to AWS (S3 + CloudFront) automatically. There is no
  manual deploy step in the normal workflow.
- Keep PRs small and focused. Don't add new dependencies without a clear
  reason — this is a two-person project and every dependency is something
  both people need to be able to reason about.
