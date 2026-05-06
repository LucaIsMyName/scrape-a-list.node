import { scrapePage, isAbortError } from './scraper.js';
import { createHash } from 'node:crypto';

const HARD_PAGE_LIMIT = 200;

function hashItems(items) {
  return createHash('md5').update(JSON.stringify(items)).digest('hex');
}

/**
 * Scrapes multiple pages by following a "next page" link.
 *
 * @param {string} startUrl - The first page URL
 * @param {string} nextSelector - CSS selector for the next-page link
 * @param {object} scrapeOpts - Options passed to scrapePage (container, item, fields)
 * @param {function} [onPage] - Optional callback called with (pageNumber, itemCount) after each page
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Abort in-flight requests and stop between pages
 * @returns {Promise<object[]>} All items collected across pages
 */
export async function paginateByNextLink(startUrl, nextSelector, scrapeOpts, onPage, options = {}) {
  const { signal, ...fetchOpts } = options;
  const allItems = [];
  const visitedUrls = new Set();
  let currentUrl = startUrl;
  let page = 1;

  while (currentUrl) {
    if (signal?.aborted) return allItems;
    if (visitedUrls.has(currentUrl)) break;
    if (page > HARD_PAGE_LIMIT) break;
    visitedUrls.add(currentUrl);

    let items;
    let $;
    try {
      const result = await scrapePage(currentUrl, scrapeOpts, { signal, ...fetchOpts });
      items = result.items;
      $ = result.$;
      allItems.push(...items);
      if (onPage) onPage(page, items.length);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (err.response && err.response.status >= 400) break;
      throw err;
    }

    // Find the next-page link: pick the last matching element whose href
    // points to a URL we haven't visited yet (pagination links typically
    // list previous pages first, with "next" at the end).
    let nextUrl = null;
    const candidates = $(nextSelector).toArray().reverse();
    for (const candidate of candidates) {
      const href = $(candidate).attr('href');
      if (!href) continue;
      const resolved = new URL(href, currentUrl).href;
      if (!visitedUrls.has(resolved)) {
        nextUrl = resolved;
        break;
      }
    }
    if (!nextUrl) break;
    currentUrl = nextUrl;
    page++;
  }

  return allItems;
}

/**
 * Scrapes multiple pages using a URL pattern with a {page} placeholder.
 *
 * @param {string} urlTemplate - URL with {page} placeholder, e.g. "https://example.com/list?page={page}"
 * @param {number} maxPages - Maximum number of pages to scrape (0 = auto-stop up to safety cap)
 * @param {object} scrapeOpts - Options passed to scrapePage (container, item, fields)
 * @param {function} [onPage] - Optional callback called with (pageNumber, itemCount) after each page
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - Abort in-flight requests and stop between pages
 * @returns {Promise<object[]>} All items collected across pages
 */
export async function paginateByPattern(urlTemplate, maxPages, scrapeOpts, onPage, options = {}) {
  const { signal, ...fetchOpts } = options;
  const allItems = [];
  const seenHashes = new Set();
  let page = 1;
  const limit = maxPages > 0 ? Math.min(maxPages, HARD_PAGE_LIMIT) : HARD_PAGE_LIMIT;

  while (page <= limit) {
    if (signal?.aborted) return allItems;
    const url = urlTemplate.replace('{page}', String(page));
    try {
      const { items } = await scrapePage(url, scrapeOpts, { signal, ...fetchOpts });

      if (items.length === 0) break;

      // Detect duplicate page content (site returning same page for out-of-range numbers)
      const hash = hashItems(items);
      if (seenHashes.has(hash)) {
        if (onPage) onPage(page, 0);
        break;
      }
      seenHashes.add(hash);

      allItems.push(...items);
      if (onPage) onPage(page, items.length);
      page++;
    } catch (err) {
      if (isAbortError(err)) throw err;
      // If we get a 404 or similar, assume we've run out of pages
      if (err.response && err.response.status >= 400) break;
      throw err;
    }
  }

  return allItems;
}
