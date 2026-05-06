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
  nextUrlSourceSelector: '',
  nextUrlAttribute: '',
  nextSiblingSelector: '',
  urlTemplate: '',
  maxPages: 0,
};

const SCRAPE_STRING_KEYS = [
  'url',
  'container',
  'item',
  'fields',
  'output',
  'nextSelector',
  'nextUrlSourceSelector',
  'nextUrlAttribute',
  'nextSiblingSelector',
  'urlTemplate',
];

function applyAutoOutputName(out) {
  const trimmed = typeof out.output === 'string' ? out.output.trim() : '';
  if (trimmed === '') {
    out.output = listTimestampBasename();
  } else {
    out.output = trimmed;
  }
  return out;
}

function assertConfigObject(raw, source) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source} must be a JSON object`);
  }
}

function normalizeBaseDefaults(raw) {
  assertConfigObject(raw, CONFIG_BASENAME);
  const out = { ...FALLBACK };

  for (const k of SCRAPE_STRING_KEYS) {
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

function normalizePreset(raw, index) {
  const source = `${CONFIG_BASENAME} presets[${index}]`;
  assertConfigObject(raw, source);

  const presetName = typeof raw.presetName === 'string' ? raw.presetName.trim() : '';
  if (!presetName) {
    throw new Error(`${source}.presetName must be a non-empty string`);
  }

  const out = { presetName };

  for (const k of SCRAPE_STRING_KEYS) {
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

  return out;
}

/**
 * Load and normalize defaults from project-root scrape.defaults.json.
 * Supports top-level defaults plus optional presets array.
 * @returns {{
 *   defaults: typeof FALLBACK,
 *   presets: Array<{ presetName: string } & Partial<typeof FALLBACK>>
 * }}
 */
export function parseScrapeConfig(raw) {
  assertConfigObject(raw, CONFIG_BASENAME);
  const defaults = normalizeBaseDefaults(raw);

  let presets = [];
  if (raw.presets != null) {
    if (!Array.isArray(raw.presets)) {
      throw new Error(`${CONFIG_BASENAME} "presets" must be an array`);
    }
    presets = raw.presets.map((preset, index) => normalizePreset(preset, index));
    const names = new Set();
    for (const preset of presets) {
      if (names.has(preset.presetName)) {
        throw new Error(`Duplicate presetName "${preset.presetName}" in ${CONFIG_BASENAME}`);
      }
      names.add(preset.presetName);
    }
  }

  return { defaults, presets };
}

export function loadScrapeConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.warn(
      `No ${CONFIG_BASENAME} at ${CONFIG_PATH} — using empty defaults. Copy scrape.defaults.example.json to ${CONFIG_BASENAME} to customize.`,
    );
    return {
      defaults: applyAutoOutputName({ ...FALLBACK }),
      presets: [],
    };
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

  return parseScrapeConfig(raw);
}

export function getEffectiveConfig(config, presetName) {
  if (!presetName) return { ...config.defaults };
  const preset = config.presets.find((entry) => entry.presetName === presetName);
  if (!preset) {
    const available = config.presets.map((entry) => entry.presetName);
    const message = available.length
      ? `Unknown preset "${presetName}". Available presets: ${available.join(', ')}`
      : `Unknown preset "${presetName}". No presets are configured.`;
    throw new Error(message);
  }
  const { presetName: _ignoredPresetName, ...presetValues } = preset;
  return applyAutoOutputName({ ...config.defaults, ...presetValues });
}

/**
 * Backward-compatible helper for existing callers.
 * @returns {typeof FALLBACK}
 */
export function loadScrapeDefaults() {
  return loadScrapeConfig().defaults;
}

export { CONFIG_PATH, FALLBACK };
