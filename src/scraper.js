import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateTargetUrl } from './urlSafety.js';

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/**
 * True if the error came from axios abort / AbortSignal cancellation.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isAbortError(err) {
  if (!err || typeof err !== 'object') return false;
  if (axios.isCancel?.(err)) return true;
  return (
    err.code === 'ERR_CANCELED' ||
    err.name === 'CanceledError' ||
    err.name === 'AbortError'
  );
}

/**
 * Fetches a page and extracts items from it.
 *
 * @param {string} url - The URL to fetch
 * @param {object} opts
 * @param {string} opts.container - CSS selector for the list container
 * @param {string} opts.item - CSS selector for each item inside the container
 * @param {Array<{name: string, selector: string}>} opts.fields - Fields to extract from each item
 * @param {object} [reqOpts]
 * @param {AbortSignal} [reqOpts.signal] - Passed to axios to allow cancellation
 * @param {number} [reqOpts.timeoutMs]
 * @param {number} [reqOpts.maxResponseBytes]
 * @param {boolean} [reqOpts.allowPrivateNetwork]
 * @returns {Promise<{items: object[], $: cheerio.CheerioAPI}>}
 */
export async function scrapePage(url, { container, item, fields }, { signal, timeoutMs, maxResponseBytes, allowPrivateNetwork } = {}) {
  const safeUrl = validateTargetUrl(url, { allowPrivateNetwork });
  const { data: html } = await axios.get(safeUrl.href, {
    signal,
    timeout: Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_HTTP_TIMEOUT_MS,
    maxContentLength: Number(maxResponseBytes) > 0 ? Number(maxResponseBytes) : DEFAULT_MAX_RESPONSE_BYTES,
    maxBodyLength: Number(maxResponseBytes) > 0 ? Number(maxResponseBytes) : DEFAULT_MAX_RESPONSE_BYTES,
    responseType: 'text',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(html);
  const items = [];

  const containerEl = $(container);
  containerEl.find(item).each((_i, el) => {
    const row = {};
    for (const field of fields) {
      const text = $(el).find(field.selector).text().replace(/\s+/g, ' ').trim();
      row[field.name] = text;
    }
    items.push(row);
  });

  return { items, $ };
}

/**
 * Parses a fields string like "title:.title, date:.date" into an array of {name, selector}.
 *
 * @param {string} fieldsStr
 * @returns {Array<{name: string, selector: string}>}
 */
export function parseFields(fieldsStr) {
  return fieldsStr
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) {
        throw new Error(`Invalid field format: "${pair}". Expected "name:selector".`);
      }
      const name = pair.slice(0, colonIdx).trim();
      const selector = pair.slice(colonIdx + 1).trim();
      if (!name || !selector) {
        throw new Error(`Invalid field format: "${pair}". Both name and selector are required.`);
      }
      return {
        name,
        selector,
      };
    });
}
