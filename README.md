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
- **Keys:** `url`, `container`, `item`, `fields`, `output` (optional; see below), `paginate` (boolean), `strategy` (`"next-link"` or `"url-pattern"`), `nextSelector`, `urlTemplate`, `maxPages` (number; `0` means no limit for URL-pattern pagination).
- **Output name:** Omit `output`, set it to `""`, or accept the prompt default to use an automatic name `list-YYYY-MM-DD-HH-MM-SS.csv` (local time). Files are written under `output/` unless you use an `output/...` or absolute path. Set `output` to a non-empty string (e.g. `concerts.csv`) to use a fixed basename instead.
- **Missing file:** If `scrape.defaults.json` is absent, the CLI warns and uses empty defaults; the default output name is still a fresh `list-YYYY-MM-DD-HH-MM-SS.csv`.
- **Invalid JSON:** The CLI exits with an error and the path to the file.
- **Sensitive URLs:** If a default URL should not be committed, add `scrape.defaults.json` to `.gitignore` and keep a private copy locally, or maintain a private overlay workflow outside this repo.

You can still change any value at each prompt before scraping.

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

## Architecture

The core scraping logic lives in `src/` and has no CLI dependencies — it can be imported directly by a future web app or API:

```js
import { scrapePage, parseFields } from './src/scraper.js';
import { paginateByNextLink, paginateByPattern } from './src/paginator.js';
import { toCSV, writeCSV, listTimestampBasename } from './src/csv.js';
```

## License

MIT
