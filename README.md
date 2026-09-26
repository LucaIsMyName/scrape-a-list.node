# scrape-a-list

A simple Node.js CLI tool that scrapes list items from websites and exports them as CSV. Supports pagination via "next page" links or URL patterns. Optional local web GUI with the same engine.

## Install

```bash
npm install
```

Requires Node.js 20+ (ES modules).

## Usage

```bash
node index.js
# or
npm run start
```

### Documentation

| Doc | Contents |
| --- | --- |
| [docs/CONFIG.md](docs/CONFIG.md) | `scrape.defaults.json` schema, presets, secrets |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, pipeline, constants |
| [docs/API.md](docs/API.md) | `runScrapeJob`, HTTP routes, SSE events |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | No browser, bot walls, CLI vs GUI |
| [docs/DEPLOY.md](docs/DEPLOY.md) | VPS deploy, auth, security |

### Default prompt values (config file)

Interactive prompts are **prefilled** from [`scrape.defaults.json`](scrape.defaults.json) in the project root. Override with `--config path/to/file.json` or `SCRAPE_CONFIG_PATH`.

- **Template:** [`scrape.defaults.example.json`](scrape.defaults.example.json)
- **Presets:** named overlays; run with `--preset yourPresetName`
- **Output name:** empty → automatic `list-YYYYMMDDHHMMSS.csv` (local time, compact timestamp) under `output/`

See [docs/CONFIG.md](docs/CONFIG.md) for all keys.

### Run a preset directly in CLI

```bash
npm run start -- --preset yourPresetName
# or
node index.js --preset yourPresetName
```

### CLI flags

```bash
node index.js --help
node index.js --version
node index.js --preset yourPresetName
node index.js --config /path/to/scrape.json
node index.js --allow-private   # allow local/private URLs when ALLOW_PRIVATE_NETWORK_TARGETS=false
```

- **URL safety (CLI):** Private/local targets are **allowed by default** for local dev. Set `ALLOW_PRIVATE_NETWORK_TARGETS=false` to match GUI hardening, or use `--allow-private` for one run when env blocks.

### Pagination note for JS-driven websites

Some sites expose a “next” control without `href`. Use `strategy: "next-link"` with optional `nextUrlSourceSelector`, `nextUrlAttribute`, and `nextSiblingSelector` (documented in CONFIG.md).

Interactive prompts cover URL, selectors, fields (`name:selector` or `name:selector@attr`), pagination, and output path. A summary is shown before scraping.

## Example

```
Starting page URL: https://example.com/concerts
CSS selector for the list container: .event-list
CSS selector for each item: .event-card
Fields: title:.event-title, date:.event-date, venue:.event-venue
Pagination: yes → follow "next page" link → a.pagination-next
Output: (default) list-YYYYMMDDHHMMSS.csv under output/
```

Result: `output/list-20260505143045.csv` (timestamp varies).

## Web GUI

```bash
npm run gui
```

The UI uses Tailwind CSS via CDN in the browser.

Opens [http://127.0.0.1:3000](http://127.0.0.1:3000). Progress streams over SSE; download CSV when done. **Advanced** fields map to `SCRAPE_*` env vars ([`.env.example`](.env.example)).

- **Stop:** cancels the job; no CSV written for that run.
- **Presets:** server-merged config via `/api/presets/:name`.
- **Security:** blocks private/local URLs unless `ALLOW_PRIVATE_NETWORK_TARGETS=true`.

## Deploy

Public instance: [https://scrape-a-list.lucamack.at](https://scrape-a-list.lucamack.at).

```bash
./scripts/deploy.sh
```

Auth: `./scripts/auth.sh add USERNAME` — see [docs/DEPLOY.md](docs/DEPLOY.md).

## Programmatic use

```js
import { runScrapeJob } from 'scrape-a-list.node/orchestrator';
import { scrapePage, parseFields } from 'scrape-a-list.node/scraper';
```

Or relative paths under `src/`. Full contract: [docs/API.md](docs/API.md).

## License

MIT
