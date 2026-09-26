# agents.md — scrape-a-list

Project-specific instructions for AI agents and contributors.

## Project metadata

- **App name:** scrape-a-list (package `scrape-a-list.node`)
- **Runtime:** Node.js 20+ (ES modules)
- **Package manager:** npm
- **Entry points:** CLI [`index.js`](index.js), GUI [`gui/server.js`](gui/server.js)

## Critical flows

1. **Interactive CLI scrape:** `npm run start` → Inquirer prompts → `runScrapeJob` → `output/*.csv`
2. **Preset CLI scrape:** `npm run start -- --preset NAME` (non-interactive after summary)
3. **GUI scrape:** `npm run gui` → POST `/api/scrape` → SSE progress → download CSV
4. **Deploy:** `./scripts/deploy.sh` (see [docs/DEPLOY.md](docs/DEPLOY.md))

## Folder layout

```
cli/           Prompts, CLI run loop, thin re-export of config
src/           Core scraper (no Inquirer/Express)
  config/      scrape.defaults.json loading and validation
  lib/         Shared helpers (e.g. sleep)
gui/           Express server + static UI
tests/         node:test suites
docs/          CONFIG, ARCHITECTURE, API, LIMITATIONS, DEPLOY
```

Shared scrape execution: **`src/orchestrator.js`** (`runScrapeJob`). Both CLI and GUI must use it.

Config file default: project root **`scrape.defaults.json`**. Override with `SCRAPE_CONFIG_PATH` or `--config`.

## Commands

```bash
npm install
npm run lint
npm test
npm run ci:test
npm run start
npm run gui
```

## Security defaults

- **GUI:** `allowPrivateNetwork` false unless `ALLOW_PRIVATE_NETWORK_TARGETS=true`
- **CLI:** allows private/local URLs by default; `ALLOW_PRIVATE_NETWORK_TARGETS=false` or use GUI-style hardening

## Documentation

Update [README.md](README.md) for user-facing quick start; deeper changes go in `docs/`. Do not commit secrets in `scrape.defaults.json`.

## Definition of done

- `npm run ci:test` passes
- Behavior changes reflected in relevant `docs/` file
- Minimal, focused diffs; match existing ESM and naming style
