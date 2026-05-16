import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateTargetUrl } from './urlSafety.js';

const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_RETRY_DELAY_MS = 0;
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

function isRetryableError(err) {
  if (isAbortError(err)) return false;
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
 * @param {Array<{name: string, selector: string}>} opts.fields - Fields to extract from each item
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
  let html;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.get(safeUrl.href, {
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
