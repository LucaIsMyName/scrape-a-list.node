# scrape-a-list

A simple Node.js CLI tool that scrapes list items from websites and exports them as CSV. Supports pagination via "next page" links or URL patterns.

## Install

```bash
npm install
```

## Usage

```bash
node index.js
```

The tool will interactively prompt you for:

1. **Starting page URL** — the page containing the list
2. **Container selector** — CSS selector for the list wrapper (e.g. `.concerts-list`)
3. **Item selector** — CSS selector for each item inside the container (e.g. `.concert-card`)
4. **Fields** — comma-separated `name:selector` pairs to extract from each item (e.g. `title:.title, date:.date, venue:.venue`)
5. **Pagination** — whether the list spans multiple pages
6. **Output filename** — defaults to `output.csv`

A summary is shown before scraping starts so you can confirm everything looks correct.

## Example

Scraping a concert listing site:

```
Starting page URL: https://example.com/concerts
CSS selector for the list container: .event-list
CSS selector for each item: .event-card
Fields: title:.event-title, date:.event-date, venue:.event-venue
Pagination: yes → follow "next page" link → a.pagination-next
Output: concerts.csv
```

Result: `concerts.csv` with columns `title`, `date`, `venue`.

## Architecture

The core scraping logic lives in `src/` and has no CLI dependencies — it can be imported directly by a future web app or API:

```js
import { scrapePage, parseFields } from './src/scraper.js';
import { paginateByNextLink, paginateByPattern } from './src/paginator.js';
import { toCSV, writeCSV } from './src/csv.js';
```

## License

MIT
