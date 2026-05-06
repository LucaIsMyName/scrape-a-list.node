import { scrapePage, isAbortError } from './scraper.js';
import { createHash } from 'node:crypto';

const HARD_PAGE_LIMIT = 200;
const COMMON_URL_ATTRS = ['href', 'data-href', 'data-url', 'data-next', 'data-next-url', 'value'];

function hashItems(items) {
  return createHash('md5').update(JSON.stringify(items)).digest('hex');
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveAttrUrl(raw, currentUrl) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  try {
    return new URL(value, currentUrl).href;
  } catch {
    return null;
  }
}

function extractUrlFromElement($, candidate, currentUrl, preferredAttr = '') {
  const attrs = uniq([preferredAttr, ...COMMON_URL_ATTRS]);

  const directNodes = [
    candidate,
    $(candidate).closest('a').get(0),
    ...$(candidate).find('a, [href], [data-href], [data-url], [data-next], [data-next-url]').toArray(),
  ].filter(Boolean);

  for (const node of directNodes) {
    for (const attr of attrs) {
      const resolved = resolveAttrUrl($(node).attr(attr), currentUrl);
      if (resolved) return resolved;
    }
  }
  return null;
}

function resolveFallbackNextUrl(
  $,
  currentUrl,
  { nextUrlSourceSelector = '', nextUrlAttribute = '', nextSiblingSelector = '' } = {},
) {
  if (!nextUrlSourceSelector) return null;
  const source = $(nextUrlSourceSelector).first();
  if (!source.length) return null;

  let target = null;
  if (nextSiblingSelector) {
    target = source.next(nextSiblingSelector).first();
  } else {
    target = source.next().first();
  }
  if (!target?.length) return null;

  const attrs = uniq([nextUrlAttribute, 'href', 'value', 'data-href', 'data-url', 'data-next', 'data-next-url']);
  for (const attr of attrs) {
    const resolved = resolveAttrUrl(target.attr(attr), currentUrl);
    if (resolved) return resolved;
  }

  return extractUrlFromElement($, target.get(0), currentUrl, nextUrlAttribute);
}

function resolveNextUrl(
  $,
  currentUrl,
  nextSelector,
  visitedUrls,
  { nextUrlAttribute = '', nextUrlSourceSelector = '', nextSiblingSelector = '' } = {},
) {
  const candidates = $(nextSelector).toArray().reverse();
  for (const candidate of candidates) {
    const resolved = extractUrlFromElement($, candidate, currentUrl, nextUrlAttribute);
    if (resolved && !visitedUrls.has(resolved)) {
      return resolved;
    }
  }

  const fallbackUrl = resolveFallbackNextUrl($, currentUrl, {
    nextUrlSourceSelector,
    nextUrlAttribute,
    nextSiblingSelector,
  });
  if (fallbackUrl && !visitedUrls.has(fallbackUrl)) {
    return fallbackUrl;
  }
  return null;
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
  const {
    signal,
    nextUrlSourceSelector,
    nextUrlAttribute,
    nextSiblingSelector,
    ...fetchOpts
  } = options;
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

    const nextUrl = resolveNextUrl($, currentUrl, nextSelector, visitedUrls, {
      nextUrlSourceSelector,
      nextUrlAttribute,
      nextSiblingSelector,
    });
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
