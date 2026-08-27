# Player Lab

Player Lab is a static Premier League player flashcard app. It is designed for GitHub Pages and uses the official Premier League player directory as its data source.

Live site: <https://kevin-ewing.github.io/pl_recall/>

## Requirements

- Node.js 22.13 or newer (Node 24 is used by GitHub Actions)
- npm
- `make` is optional; each command below also has an npm equivalent.

## Get started

```bash
git clone https://github.com/kevin-ewing/pl_recall.git
cd pl_recall
make install
make dev
```

Open <http://localhost:3000>. The development server automatically reloads after source changes.

Without `make`:

```bash
cd web
npm ci
npm run dev
```

## Common commands

| Command | What it does |
| --- | --- |
| `make dev` | Starts the local development server. |
| `make sync` | Refreshes the roster, preferred display names, official photos, team badges, and nationality flags. |
| `make lint` | Runs ESLint. |
| `make typecheck` | Runs TypeScript without writing output. |
| `make build` | Produces a root-hosted static build in `web/dist/client`. |
| `make build-pages` | Produces the artifact layout used by this repository’s GitHub Pages site. |
| `make check` | Runs linting, type checks, and a static build. |

## Player data and assets

`make sync` runs `scripts/import-premier-league-players.mjs`. It pages through the official Premier League API, enriches players with their official display names, and downloads club/nationality SVGs. It excludes players whose available image is a placeholder.

The web app reads the generated roster from:

```text
web/public/data/premier-league-players-2026.json
```

Downloaded badges and flags live in `web/public/assets`. Player photographs remain on Premier League image URLs; this keeps the repository compact while showing official headshots.

## Static builds and GitHub Pages

The app is intentionally static: it has no server-side database or API route. `scripts/build-static.mjs` sets the requested base path, runs the web build, and arranges framework assets at the root of the deployable artifact.

This repository’s deployment workflow is [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). It runs whenever a commit is pushed to `master` and it:

1. Installs locked dependencies.
2. Refreshes the official roster and assets.
3. Builds the artifact for the GitHub Pages project path (`/pl_recall`).
4. Deploys `web/dist/client` to GitHub Pages.

To enable deployments, open the repository’s **Settings → Pages** and select **GitHub Actions** as the source. Push to `master`, then use the **Actions** tab to confirm that “Deploy Player Lab to GitHub Pages” is green. You can also choose **Run workflow** there for a manual deployment.

## Project layout

```text
web/app/                  Flashcard UI, styles, and page metadata
web/public/               Data, local SVG assets, favicon, and social preview image
scripts/import-*.mjs      Official Premier League roster/asset importer
scripts/build-static.mjs  Reusable static build and GitHub Pages artifact preparation
.github/workflows/        GitHub Pages deployment
Makefile                  Friendly development, sync, build, and check commands
```

## Notes for contributors

- Browser progress is stored in local storage only; it is not shared between devices.
- The first eight cards in a fresh or restarted deck prefer 500px official headshots whenever the active filters contain them.
- Run `make check` before committing UI or build changes.
