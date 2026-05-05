import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { listTimestampBasename } from '../src/csv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const CONFIG_BASENAME = 'scrape.defaults.json';
const CONFIG_PATH = join(PROJECT_ROOT, CONFIG_BASENAME);

const FALLBACK = {
  url: '',
  container: '',
  item: '',
  fields: '',
  output: '',
  paginate: false,
  strategy: 'next-link',
  nextSelector: '',
  urlTemplate: '',
  maxPages: 0,
};

function applyAutoOutputName(out) {
  const trimmed = typeof out.output === 'string' ? out.output.trim() : '';
  if (trimmed === '') {
    out.output = listTimestampBasename();
  } else {
    out.output = trimmed;
  }
  return out;
}

function normalizeDefaults(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${CONFIG_BASENAME} must be a JSON object`);
  }

  const out = { ...FALLBACK };

  const stringKeys = [
    'url',
    'container',
    'item',
    'fields',
    'output',
    'nextSelector',
    'urlTemplate',
  ];
  for (const k of stringKeys) {
    if (typeof raw[k] === 'string') {
      out[k] = raw[k];
    }
  }

  if (typeof raw.paginate === 'boolean') {
    out.paginate = raw.paginate;
  }

  if (typeof raw.maxPages === 'number' && Number.isFinite(raw.maxPages)) {
    out.maxPages = raw.maxPages;
  }

  if (raw.strategy === 'next-link' || raw.strategy === 'url-pattern') {
    out.strategy = raw.strategy;
  }

  return applyAutoOutputName(out);
}

/**
 * Load and normalize defaults from project-root scrape.defaults.json.
 * @returns {typeof FALLBACK}
 */
export function loadScrapeDefaults() {
  if (!existsSync(CONFIG_PATH)) {
    console.warn(
      `No ${CONFIG_BASENAME} at ${CONFIG_PATH} — using empty defaults. Copy scrape.defaults.example.json to ${CONFIG_BASENAME} to customize.`,
    );
    return applyAutoOutputName({ ...FALLBACK });
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${CONFIG_PATH}: ${err.message}`);
    }
    throw new Error(`Could not read ${CONFIG_PATH}: ${err.message}`);
  }

  return normalizeDefaults(raw);
}

export { CONFIG_PATH, FALLBACK };
