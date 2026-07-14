# Deck City

A deck-building city-builder game.

Built with Vue 3 + Phaser 3, browser-first, with an eye toward an eventual
Steam release.

See [STATUS.md](./STATUS.md) for what's built, what's playable right now,
and where the design is headed next.

## Project setup

```
yarn install
```

### Dev server with hot reload

```
yarn dev
```

### Production build

```
yarn build
```

### Preview a production build locally

```
yarn preview
```

### Lint

```
yarn lint
yarn lint:fix
```

### Tests

```
yarn test           # watch mode
yarn test:run        # single run
yarn test:coverage   # with coverage
```

## Contributing

1. Create a branch off `main`
2. Make your changes
3. Open a PR into `main` — CI runs lint + tests automatically
4. Merge — this automatically deploys to production (see below)

Direct pushes to `main` aren't used; everything goes through a PR.

## Deploys

Merging to `main` triggers a GitHub Action
(`.github/workflows/deploy.yml`) that builds the app and deploys it to AWS
(S3 + CloudFront). There's no manual deploy step — merge is deploy.

## For AI assistants

See [AGENTS.md](./AGENTS.md) — shared conventions and context for Claude.
