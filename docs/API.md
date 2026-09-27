# API reference

## Programmatic: `runScrapeJob`

```js
import { runScrapeJob } from '../src/orchestrator.js';
```

### Config object

| Field | Type | Notes |
| --- | --- | --- |
| `url` | string | Start URL (single-page and next-link). |
| `container`, `item` | string | Cheerio selectors. |
| `fieldsRaw` | string | Same format as config `fields`. |
| `paginate` | boolean | |
| `strategy` | `'next-link' \| 'url-pattern'` | When `paginate` is true. |
| `nextSelector` | string | Required for next-link. |
| `nextUrlSourceSelector`, `nextUrlAttribute`, `nextSiblingSelector` | string | Optional next-link helpers. |
| `urlTemplate` | string | Required for url-pattern; must include `{page}`. |
| `maxPages` | number | url-pattern only. |
| `retryAttempts`, `retryDelayMs`, `pageDelayMs` | number | Optional. |
| `failOnPageError` | boolean | Optional. |

### Options (third argument)

| Option | Type | Notes |
| --- | --- | --- |
| `signal` | AbortSignal | Cancel in-flight work. |
| `allowPrivateNetwork` | boolean | CLI default allows private targets unless env/flag says otherwise; GUI default false. |
| `timeoutMs`, `maxResponseBytes` | number | Override fetch limits. |
| `onWarning` | function | Receives `{ type: 'http-page-error', ... }` during pagination. |

### Returns

`Promise<{ items: object[], fields: Array<{ name, selector, attribute? }> }>`

CSV writing is the caller’s responsibility (`writeCSV` from `src/csv.js`).

### Other exports

- `scrapePage`, `parseFields`, `isAbortError` — [`src/scraper.js`](../src/scraper.js)
- `paginateByNextLink`, `paginateByPattern` — [`src/paginator.js`](../src/paginator.js)
- `validateTargetUrl`, `createPublicLookup` — [`src/urlSafety.js`](../src/urlSafety.js)

---

## HTTP GUI API

Base URL: `http://127.0.0.1:3000` (or your `GUI_HOST` / `PORT`).

### `GET /api/health`

`{ "ok": true }`

### `GET /api/defaults`

Legacy: returns global defaults object only.

### `GET /api/config`

`{ defaults: {...}, presets: [...] }`

### `GET /api/presets/:name`

Returns merged config for one preset:

```json
{ "presetName": "my-preset", "config": { "url": "...", ... } }
```

404 if unknown preset or load error.

### `POST /api/scrape`

Body: JSON with `url`, `container`, `item`, `fields`, optional pagination and advanced fields (same names as config, camelCase for multi-word next-link keys in JSON — see server validation).

Response: `{ "jobId": "uuid" }` or 400/429.

### `GET /api/scrape/events/:jobId`

Server-Sent Events stream. Each message is JSON in `data:`:

| `type` | Payload |
| --- | --- |
| `start` | |
| `page` | `{ page, count }` |
| `warning` | `{ warning: { type, message, ... } }` |
| `done` | `{ count, preview, csvPath }` — `csvPath` null if cancelled or zero items |
| `error` | `{ message }` |
| `cancelled` | |

### `POST /api/scrape/cancel/:jobId`

Aborts the job. 409 if already finished.

### `GET /api/outputs`

Lists CSV files in `output/` after applying the storage quota. Response:

```json
{ "files": [{ "name": "list-….csv", "path": "/abs/path", "size": 123, "mtimeMs": 1 }], "totalBytes": 123, "limitBytes": 2147483648 }
```

### `GET /api/outputs/preview?file=`

Returns the first 20 rows of a jailed CSV (`headers`, `rows`, `truncated`).

### `DELETE /api/outputs`

Body `{ "file": "<path>" }` (or `?file=`). Deletes one CSV under `output/`. 403 on traversal.

### `GET /api/download?file=`

Downloads a CSV under `output/`. Path traversal returns 403.

`OUTPUT_MAX_BYTES` (default 2 GiB) caps the combined size of CSVs in `output/`. After each write (and when listing files) the oldest CSVs are deleted until the folder is under the limit.

---

## CLI flags

| Flag | Description |
| --- | --- |
| `--preset <name>` | Non-interactive preset run. |
| `--config <path>` | Config file path. |
| `--allow-private` | Allow private/local URLs for this run (overrides `ALLOW_PRIVATE_NETWORK_TARGETS=false`). |
| `--help`, `--version` | |

Environment: `SCRAPE_CONFIG_PATH`, `ALLOW_PRIVATE_NETWORK_TARGETS` (CLI: unset or `true` allows private; `false` blocks unless `--allow-private`).

See [LIMITATIONS.md](./LIMITATIONS.md) for what this stack cannot scrape.
