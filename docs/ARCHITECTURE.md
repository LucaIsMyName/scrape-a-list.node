# Architecture

## Module map

| Path | Role |
| --- | --- |
| [`index.js`](../index.js) | CLI entry: argument parsing, dispatches to `cli/index.js`. |
| [`cli/`](../cli/) | Interactive prompts (Inquirer), preset resolution, CSV write. |
| [`src/orchestrator.js`](../src/orchestrator.js) | Single entry for scrape runs (CLI + GUI). |
| [`src/scraper.js`](../src/scraper.js) | HTTP fetch, Cheerio extraction, field parsing, retries. |
| [`src/paginator.js`](../src/paginator.js) | Next-link and url-pattern pagination. |
| [`src/csv.js`](../src/csv.js) | CSV serialization, output path jail, formula injection guard. |
| [`src/urlSafety.js`](../src/urlSafety.js) | http(s) only, block private/local hosts and DNS rebinding. |
| [`src/htmlFallbacks.js`](../src/htmlFallbacks.js) | IMDb chart JSON-LD / `__NEXT_DATA__` when selectors match nothing. |
| [`src/config/loadScrapeConfig.js`](../src/config/loadScrapeConfig.js) | Load and validate `scrape.defaults.json`. |
| [`gui/server.js`](../gui/server.js) | Express API, SSE job progress, static UI. |
| [`gui/public/`](../gui/public/) | HTML + client script. |

## Scrape pipeline

```mermaid
sequenceDiagram
  participant User
  participant Entry as CLI_or_GUI
  participant Orch as orchestrator
  participant Scraper as scraper
  participant Paginator as paginator
  participant CSV as csv

  User->>Entry: config
  Entry->>Orch: runScrapeJob
  alt single page
    Orch->>Scraper: scrapePage
  else next-link
    Orch->>Paginator: paginateByNextLink
    Paginator->>Scraper: scrapePage per page
  else url-pattern
    Orch->>Paginator: paginateByPattern
    Paginator->>Scraper: scrapePage per page
  end
  Scraper-->>Orch: items
  Entry->>CSV: writeCSV
```

### Pagination

- **next-link:** Follow resolved URLs from `nextSelector` (and optional source/sibling helpers). Stops on missing next link, revisit, or `HARD_PAGE_LIMIT` (200).
- **url-pattern:** Replace `{page}` in `urlTemplate`. Stops on empty items, duplicate page hash, HTTP ≥400 (unless `failOnPageError`), or cap.

### Constants (defaults)

| Constant | Value | Location |
| --- | --- | --- |
| HTTP timeout | 15s | `scraper.js`, overridable via `SCRAPE_TIMEOUT_MS` in GUI |
| Max response size | 5 MiB | `scraper.js`, `SCRAPE_MAX_RESPONSE_BYTES` |
| Max pages (safety) | 200 | `paginator.js` |
| Max redirects | 5 | `scraper.js` |

## GUI assets and CDN

The UI is static files under `gui/public/`. [`index.html`](../gui/public/index.html) loads **Tailwind CSS** from `https://cdn.tailwindcss.com` in the browser, with an inline `tailwind.config` mapping theme tokens to CSS variables on `[data-theme]`.

Fonts load from Google Fonts (Geist). Offline or locked-down networks may show unstyled layout or system fonts until CDN access is available.

## Programmatic use

Prefer package exports (see `package.json` `"exports"`) or import paths:

```js
import { runScrapeJob } from 'scrape-a-list.node/orchestrator';
```

Details: [API.md](./API.md).

## Error codes

| Code | Meaning |
| --- | --- |
| `ERR_UNSAFE_URL` | URL blocked by safety policy. |
| `ERR_BOT_CHALLENGE` | Bot/WAF page instead of list HTML. |
| `ERR_CANCELED` | User cancelled (GUI) or abort signal. |

HTTP errors surface axios `response.status` on the error object.
