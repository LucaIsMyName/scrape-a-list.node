import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractFieldValue } from './extractField.js';
import { extractImdbChartItems, isBotChallengeHtml } from './htmlFallbacks.js';
import { createPublicLookup, validateTargetUrl } from './urlSafety.js';

const FIELD_ATTR_SUFFIX = /^(.+)@([A-Za-z][\w-]*)$/;

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_RETRY_DELAY_MS = 0;
const MAX_REDIRECTS = 5;
const publicLookup = createPublicLookup();
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND']);

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

function hasErrorCode(err, code) {
  let current = err;
  const seen = new Set();
  while (current && typeof current === 'object' && !seen.has(current)) {
    if (current.code === code) return true;
    seen.add(current);
    current = current.cause;
  }
  return false;
}

function isRetryableError(err) {
  if (isAbortError(err)) return false;
  if (hasErrorCode(err, 'ERR_UNSAFE_URL')) return false;
  const status = err?.response?.status;
  if (typeof status === 'number' && RETRYABLE_STATUS_CODES.has(status)) return true;
  if (typeof err?.code === 'string' && RETRYABLE_NETWORK_CODES.has(err.code)) return true;
  return !err?.response;
}

async function sleep(ms, signal) {
  if (!(ms > 0)) return;
  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const aborted = new Error('Request aborted');
      aborted.name = 'AbortError';
      aborted.code = 'ERR_CANCELED';
      reject(aborted);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      const aborted = new Error('Request aborted');
      aborted.name = 'AbortError';
      aborted.code = 'ERR_CANCELED';
      reject(aborted);
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

/**
 * Fetches a page and extracts items from it.
 *
 * @param {string} url - The URL to fetch
 * @param {object} opts
 * @param {string} opts.container - CSS selector for the list container
 * @param {string} opts.item - CSS selector for each item inside the container
 * @param {Array<{name: string, selector: string, attribute?: string}>} opts.fields - Fields to extract from each item
 * @param {object} [reqOpts]
 * @param {AbortSignal} [reqOpts.signal] - Passed to axios to allow cancellation
 * @param {number} [reqOpts.timeoutMs]
 * @param {number} [reqOpts.maxResponseBytes]
 * @param {boolean} [reqOpts.allowPrivateNetwork]
 * @param {number} [reqOpts.retryAttempts]
 * @param {number} [reqOpts.retryDelayMs]
 * @returns {Promise<{items: object[], $: cheerio.CheerioAPI}>}
 */
export async function scrapePage(
  url,
  { container, item, fields },
  { signal, timeoutMs, maxResponseBytes, allowPrivateNetwork, retryAttempts = 0, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  const safeUrl = validateTargetUrl(url, { allowPrivateNetwork });
  const maxRetries = Number(retryAttempts) > 0 ? Number(retryAttempts) : 0;
  const delayMs = Number(retryDelayMs) > 0 ? Number(retryDelayMs) : DEFAULT_RETRY_DELAY_MS;
  const byteLimit = Number(maxResponseBytes) > 0 ? Number(maxResponseBytes) : DEFAULT_MAX_RESPONSE_BYTES;
  let html;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.get(safeUrl.href, {
        signal,
        timeout: Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_HTTP_TIMEOUT_MS,
        maxContentLength: byteLimit,
        maxBodyLength: byteLimit,
        maxRedirects: MAX_REDIRECTS,
        proxy: false,
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        beforeRedirect(options) {
          validateTargetUrl(options.href, { allowPrivateNetwork });
        },
        ...(allowPrivateNetwork ? {} : { lookup: publicLookup }),
      });
      html = response.data;
      break;
    } catch (err) {
      const lastAttempt = attempt >= maxRetries;
      if (!isRetryableError(err) || lastAttempt) {
        throw err;
      }
      await sleep(delayMs, signal);
    }
  }

  const $ = cheerio.load(html);
  const items = [];

  const containerEl = $(container);
  containerEl.find(item).each((_i, el) => {
    const row = {};
    for (const field of fields) {
      row[field.name] = extractFieldValue($, el, field, safeUrl.href);
    }
    items.push(row);
  });

  if (items.length === 0) {
    const fallbackItems = extractImdbChartItems(html, safeUrl);
    if (fallbackItems?.length) {
      items.push(...fallbackItems);
    }
  }

  if (items.length === 0 && isBotChallengeHtml(html)) {
    const err = new Error(
      'The server returned a bot-protection page instead of the list (common on IMDb). This app uses plain HTTP fetching, not a browser, so those pages cannot be scraped. Try another preset or scrape a site that serves the list in the initial HTML.',
    );
    err.code = 'ERR_BOT_CHALLENGE';
    throw err;
  }

  return { items, $ };
}

/**
 * Parses a fields string like "title:.title, link:a@href" into field definitions.
 *
 * @param {string} fieldsStr
 * @returns {Array<{name: string, selector: string, attribute?: string}>}
 */
export function parseFields(fieldsStr) {
  return fieldsStr
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) {
        throw new Error(`Invalid field format: "${pair}". Expected "name:selector" or "name:selector@attribute".`);
      }
      const name = pair.slice(0, colonIdx).trim();
      const selectorPart = pair.slice(colonIdx + 1).trim();
      if (!name || !selectorPart) {
        throw new Error(`Invalid field format: "${pair}". Both name and selector are required.`);
      }
      const attrMatch = selectorPart.match(FIELD_ATTR_SUFFIX);
      if (attrMatch) {
        const selector = attrMatch[1].trim();
        const attribute = attrMatch[2];
        if (!selector) {
          throw new Error(`Invalid field format: "${pair}". Selector is required before @attribute.`);
        }
        return { name, selector, attribute };
      }
      if (selectorPart.includes('@')) {
        throw new Error(`Invalid field format: "${pair}". Attribute name after @ must start with a letter.`);
      }
      return { name, selector: selectorPart };
    });
}
