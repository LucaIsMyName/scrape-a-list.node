# Limitations

## No browser engine

This tool fetches HTML over HTTP and parses it with Cheerio. It does **not** run JavaScript in a headless browser.

- Lists built entirely client-side (React/Vue hydration only) often return empty results unless the site embeds data in the initial HTML (JSON-LD, `__NEXT_DATA__`, etc.).
- “Next page” controls that only update the URL via JS without a usable `href`/`value` in the DOM need the **next URL source** fields documented in the README.

## Bot protection and WAF

Some sites (notably IMDb) return AWS WAF or similar challenge pages. When detected, scraping fails with `ERR_BOT_CHALLENGE`. The included IMDb chart fallback reads embedded JSON when selectors fail on IMDb chart URLs only—it does not bypass active bot walls.

## Selector-only extraction

Field values come from CSS selectors (and optional `@attribute`). There is no AI, XPath mode, or automatic structure detection.

## Pagination caps

Automatic paging stops at **200 pages** (`HARD_PAGE_LIMIT`) even when `maxPages` is `0`.

## CLI vs GUI safety

| Surface | Private/local URLs | Cancel mid-run |
| --- | --- | --- |
| CLI | Allowed by default; set `ALLOW_PRIVATE_NETWORK_TARGETS=false` to block (same checks as GUI). | N/A (Ctrl+C kills process). |
| GUI | Blocked unless `ALLOW_PRIVATE_NETWORK_TARGETS=true`. | Stop button; no CSV if cancelled before done. |

## Hosted GUI abuse model

When the GUI is exposed (even behind Apache basic auth), authenticated users can ask the **server** to fetch arbitrary public URLs. Treat credentials as trusted-user access only. Keep `ALLOW_PRIVATE_NETWORK_TARGETS=false` on VPS. See [DEPLOY.md](./DEPLOY.md#security-and-ssrf).

## Dependencies

CSV export uses `json2csv` (alpha channel). Pin versions in production deploys (`npm ci`).
