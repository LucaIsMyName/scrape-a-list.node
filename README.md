# scrape-a-list

A simple Node.js CLI tool that scrapes list items from websites and exports them as CSV. Supports pagination via "next page" links or URL patterns.

## Install

```bash
npm install
```

## Usage

```bash
node index.js
# or
npm run start
```

### Default prompt values (config file)

Interactive prompts are **prefilled** from [`scrape.defaults.json`](scrape.defaults.json) in the project root (same folder as `package.json`). Edit that file to set your usual URL, selectors, fields, and pagination—no code changes needed.

- **Template:** [`scrape.defaults.example.json`](scrape.defaults.example.json) has the same shape; copy it to `scrape.defaults.json` if you start from a clone without defaults.
- **Global keys:** `url`, `container`, `item`, `fields`, `output` (optional; see below), `paginate` (boolean), `strategy` (`"next-link"` or `"url-pattern"`), `nextSelector`, `urlTemplate`, `maxPages` (number; `0` means automatic paging until pages stop, with a safety cap).
- **Presets:** optional `presets` array. Every preset is an object with required `presetName` plus any of the same scrape keys. Preset values override global keys when selected.
- **Output name:** Omit `output`, set it to `""`, or accept the prompt default to use an automatic name `list-YYYY-MM-DD-HH-MM-SS.csv` (local time). Files are written under `output/` unless you use an `output/...` or absolute path. Set `output` to a non-empty string (e.g. `concerts.csv`) to use a fixed basename instead.
- **Missing file:** If `scrape.defaults.json` is absent, the CLI warns and uses empty defaults; the default output name is still a fresh `list-YYYY-MM-DD-HH-MM-SS.csv`.
- **Invalid JSON:** The CLI exits with an error and the path to the file.
- **Sensitive URLs:** If a default URL should not be committed, add `scrape.defaults.json` to `.gitignore` and keep a private copy locally, or maintain a private overlay workflow outside this repo.

You can still change any value at each prompt before scraping.

### Run a preset directly in CLI

Use a named preset to skip interactive prompts:

```bash
npm run start -- --preset yourPresetName
# or
node index.js --preset yourPresetName
```

Behavior:
- The CLI merges `scrape.defaults.json` global keys with the selected preset.
- If required values are missing after merge (`url`, `container`, `item`, `fields`), the CLI exits with a clear error.
- If the preset name is unknown, the CLI exits and lists available preset names.

The tool will interactively prompt you for:

1. **Starting page URL** — the page containing the list
2. **Container selector** — CSS selector for the list wrapper (e.g. `.concerts-list`)
3. **Item selector** — CSS selector for each item inside the container (e.g. `.concert-card`)
4. **Fields** — comma-separated `name:selector` pairs to extract from each item (e.g. `title:.title, date:.date, venue:.venue`)
5. **Pagination** — whether the list spans multiple pages
6. **Output filename** — by default a timestamped name `list-YYYY-MM-DD-HH-MM-SS.csv` under `output/`. Relative paths without an `output/` prefix are placed in `output/`. Paths that already start with `output/` and absolute paths are left as-is.

A summary is shown before scraping starts so you can confirm everything looks correct. The summary shows the resolved output path (for example `output/list-2026-05-05-14-30-45.csv`).

## Example

Scraping a concert listing site:

```
Starting page URL: https://example.com/concerts
CSS selector for the list container: .event-list
CSS selector for each item: .event-card
Fields: title:.event-title, date:.event-date, venue:.event-venue
Pagination: yes → follow "next page" link → a.pagination-next
Output: (default) list-YYYY-MM-DD-HH-MM-SS.csv under output/
```

Result: `output/list-2026-05-05-14-30-45.csv` (timestamp varies) with columns `title`, `date`, `venue`.

## Web GUI

```bash
npm run gui
```

Opens a small local server (default [http://127.0.0.1:3000](http://127.0.0.1:3000)) with the same scrape options as the CLI. Progress streams into a dialog; when finished you can download the CSV from there.

- **Stop:** While a scrape is running, use **Stop** in the dialog header to cancel. The in-flight page request is aborted and pagination stops; **no CSV file is written** for that run. If the job has already finished, **Stop** is no longer available (the server returns 409 for a second cancel).
- **Presets:** A preset dropdown appears above the URL field. Selecting a preset applies global defaults overlaid by that preset values (no hardcoded presets in the app).
- **Security defaults:** GUI mode only allows `http/https` targets and blocks local/private-network URLs by default. To explicitly allow private targets, set `ALLOW_PRIVATE_NETWORK_TARGETS=true`.
- **Server binding:** GUI binds to `127.0.0.1` by default. Override host/port with `GUI_HOST` and `PORT` if needed.
- **Network guards:** Requests use default timeout and size limits (`SCRAPE_TIMEOUT_MS`, `SCRAPE_MAX_RESPONSE_BYTES`) to avoid hanging on slow or oversized responses.

## Architecture

The core scraping logic lives in `src/` and has no CLI dependencies — it can be imported directly by a future web app or API:

```js
import { scrapePage, parseFields, isAbortError } from './src/scraper.js';
import { paginateByNextLink, paginateByPattern } from './src/paginator.js';
import { toCSV, writeCSV, listTimestampBasename } from './src/csv.js';
import { runScrapeJob } from './src/orchestrator.js';
```

## License

MIT
