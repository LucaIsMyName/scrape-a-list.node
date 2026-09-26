# Configuration (`scrape.defaults.json`)

The CLI and GUI load defaults from a JSON file in the project root by default. Override the path with `--config <path>` (CLI) or `SCRAPE_CONFIG_PATH` (CLI and GUI server process).

Copy [`scrape.defaults.example.json`](../scrape.defaults.example.json) to `scrape.defaults.json` to get started. Keep private URLs out of git by gitignoring your local file or pointing `SCRAPE_CONFIG_PATH` at a file outside the repo.

## Top-level shape

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `url` | string | For runs | Starting page URL (used for single-page and next-link pagination). |
| `container` | string | Yes | CSS selector for the list wrapper. |
| `item` | string | Yes | CSS selector for each row inside the container. |
| `fields` | string | Yes | Comma-separated `name:selector` or `name:selector@attribute` pairs. |
| `output` | string | No | CSV basename or relative path under `output/`. Empty → auto `list-YYYYMMDDHHMMSS.csv`. |
| `paginate` | boolean | No | Default `false`. |
| `strategy` | string | If paginate | `"next-link"` or `"url-pattern"`. |
| `nextSelector` | string | If next-link | Selector for the next-page control. |
| `nextUrlSourceSelector` | string | No | Optional URL source for JS-driven “next” controls. |
| `nextUrlAttribute` | string | No | Attribute on source/sibling (often `value`). |
| `nextSiblingSelector` | string | No | Sibling selector after advancing source (often `option`). |
| `urlTemplate` | string | If url-pattern | URL with `{page}` placeholder. **`url` is not used for fetching** in this mode. |
| `maxPages` | integer ≥ 0 | No | For url-pattern: `0` = auto until empty/duplicate page (cap 200). |
| `retryAttempts` | integer ≥ 0 | No | Retries per HTTP request on transient errors. |
| `retryDelayMs` | integer ≥ 0 | No | Delay between retries. |
| `pageDelayMs` | integer ≥ 0 | No | Delay between paginated pages. |
| `failOnPageError` | boolean | No | If true, fail the run on HTTP ≥400 during pagination; else stop paging and keep data. |
| `presets` | array | No | Named overrides (see below). |

Unknown keys are ignored. Known keys must use the types above or loading fails with a path-specific error message.

## Presets

Each preset object must include `presetName` (unique string) plus any of the same keys as the global section. At runtime, **defaults are merged with the preset**; preset values win.

CLI:

```bash
npm run start -- --preset myPreset
```

GUI: choose a preset in the dropdown (merged config comes from `GET /api/presets/:name`).

Required after merge for any run: `url`, `container`, `item`, `fields` (except url-pattern may warn that `url` is unused when `urlTemplate` is set).

## Output paths

- All CSV files are written under the project `output/` directory.
- Absolute paths and `../` escapes are rejected.
- Auto names use local time: `list-YYYYMMDDHHMMSS.csv` (no dashes between date parts).

## Secrets workflow

1. Add `scrape.defaults.json` to `.gitignore`, or  
2. Set `SCRAPE_CONFIG_PATH=/path/to/private/scrape.json` in your shell or systemd unit.

Redeploy rsync includes `scrape.defaults.json` from your machine unless excluded—avoid publishing secrets in that file.

## Environment (GUI server)

Server-side defaults when the UI leaves advanced fields blank are documented in [`.env.example`](../.env.example). See [API.md](./API.md) for HTTP behavior.
