import { scrapePage, parseFields } from './scraper.js';
import { paginateByNextLink, paginateByPattern } from './paginator.js';

/**
 * Execute one scrape run with shared CLI/GUI behavior.
 *
 * @param {object} config
 * @param {string} config.url
 * @param {string} config.container
 * @param {string} config.item
 * @param {string} config.fieldsRaw
 * @param {boolean} config.paginate
 * @param {'next-link'|'url-pattern'} [config.strategy]
 * @param {string} [config.nextSelector]
 * @param {string} [config.urlTemplate]
 * @param {number} [config.maxPages]
 * @param {(page:number,count:number)=>void} [onPage]
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.allowPrivateNetwork]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxResponseBytes]
 * @returns {Promise<{items: object[], fields: Array<{name:string, selector:string}>}>}
 */
export async function runScrapeJob(config, onPage, options = {}) {
  const fields = parseFields(config.fieldsRaw);
  const scrapeOpts = {
    container: config.container,
    item: config.item,
    fields,
  };
  const fetchOpts = {
    signal: options.signal,
    allowPrivateNetwork: options.allowPrivateNetwork,
    timeoutMs: options.timeoutMs,
    maxResponseBytes: options.maxResponseBytes,
  };

  let items;
  if (!config.paginate) {
    const result = await scrapePage(config.url, scrapeOpts, fetchOpts);
    items = result.items;
    if (onPage) onPage(1, items.length);
  } else if (config.strategy === 'next-link') {
    items = await paginateByNextLink(config.url, config.nextSelector, scrapeOpts, onPage, fetchOpts);
  } else {
    items = await paginateByPattern(config.urlTemplate, Number(config.maxPages) || 0, scrapeOpts, onPage, fetchOpts);
  }

  return { items, fields };
}
