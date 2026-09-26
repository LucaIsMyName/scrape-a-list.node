import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTimestampBasename } from '../csv.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
export const CONFIG_BASENAME = 'scrape.defaults.json';

export const FALLBACK = {
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
  retryAttempts: 0,
  retryDelayMs: 0,
  pageDelayMs: 0,
  failOnPageError: false,
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

let activeConfigPath = null;

/**
 * Resolve config file path: explicit arg, SCRAPE_CONFIG_PATH env, or project root default.
 * @param {string} [overridePath]
 * @returns {string}
 */
export function resolveConfigPath(overridePath) {
  if (overridePath && String(overridePath).trim()) {
    const p = String(overridePath).trim();
    return isAbsolute(p) ? p : resolve(PROJECT_ROOT, p);
  }
  const fromEnv = process.env.SCRAPE_CONFIG_PATH;
  if (fromEnv && String(fromEnv).trim()) {
    const p = String(fromEnv).trim();
    return isAbsolute(p) ? p : resolve(PROJECT_ROOT, p);
  }
  return join(PROJECT_ROOT, CONFIG_BASENAME);
}

export function getConfigPath() {
  return activeConfigPath ?? resolveConfigPath();
}

function configLabel(configPath) {
  return configPath.endsWith(CONFIG_BASENAME) ? CONFIG_BASENAME : configPath;
}

function applyAutoOutputName(out) {
  const trimmed = typeof out.output === 'string' ? out.output.trim() : '';
  if (trimmed === '') {
    out.output = listTimestampBasename();
  } else {
    out.output = trimmed;
  }
  return out;
}

function hasOwnKey(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function assertConfigObject(raw, source) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source} must be a JSON object`);
  }
}

function assertStringKey(raw, key, source) {
  if (!hasOwnKey(raw, key)) return;
  if (typeof raw[key] !== 'string') {
    throw new Error(`${source}.${key} must be a string`);
  }
}

function assertBooleanKey(raw, key, source) {
  if (!hasOwnKey(raw, key)) return;
  if (typeof raw[key] !== 'boolean') {
    throw new Error(`${source}.${key} must be a boolean`);
  }
}

function assertNonNegativeIntegerKey(raw, key, source) {
  if (!hasOwnKey(raw, key)) return;
  const value = raw[key];
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${source}.${key} must be a non-negative integer`);
  }
}

function assertValidStrategy(raw, source) {
  if (!hasOwnKey(raw, 'strategy')) return;
  if (raw.strategy !== 'next-link' && raw.strategy !== 'url-pattern') {
    throw new Error(`${source}.strategy must be "next-link" or "url-pattern"`);
  }
}

function validateKnownKeys(raw, source) {
  for (const k of SCRAPE_STRING_KEYS) assertStringKey(raw, k, source);
  assertBooleanKey(raw, 'paginate', source);
  assertBooleanKey(raw, 'failOnPageError', source);
  assertNonNegativeIntegerKey(raw, 'maxPages', source);
  assertNonNegativeIntegerKey(raw, 'retryAttempts', source);
  assertNonNegativeIntegerKey(raw, 'retryDelayMs', source);
  assertNonNegativeIntegerKey(raw, 'pageDelayMs', source);
  assertValidStrategy(raw, source);
}

function normalizeBaseDefaults(raw, label) {
  assertConfigObject(raw, label);
  validateKnownKeys(raw, label);
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

  if (typeof raw.retryAttempts === 'number' && Number.isFinite(raw.retryAttempts)) {
    out.retryAttempts = raw.retryAttempts;
  }

  if (typeof raw.retryDelayMs === 'number' && Number.isFinite(raw.retryDelayMs)) {
    out.retryDelayMs = raw.retryDelayMs;
  }

  if (typeof raw.pageDelayMs === 'number' && Number.isFinite(raw.pageDelayMs)) {
    out.pageDelayMs = raw.pageDelayMs;
  }

  if (typeof raw.failOnPageError === 'boolean') {
    out.failOnPageError = raw.failOnPageError;
  }

  if (raw.strategy === 'next-link' || raw.strategy === 'url-pattern') {
    out.strategy = raw.strategy;
  }

  return applyAutoOutputName(out);
}

function normalizePreset(raw, index, label) {
  const source = `${label} presets[${index}]`;
  assertConfigObject(raw, source);
  validateKnownKeys(raw, source);

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

  if (typeof raw.retryAttempts === 'number' && Number.isFinite(raw.retryAttempts)) {
    out.retryAttempts = raw.retryAttempts;
  }

  if (typeof raw.retryDelayMs === 'number' && Number.isFinite(raw.retryDelayMs)) {
    out.retryDelayMs = raw.retryDelayMs;
  }

  if (typeof raw.pageDelayMs === 'number' && Number.isFinite(raw.pageDelayMs)) {
    out.pageDelayMs = raw.pageDelayMs;
  }

  if (typeof raw.failOnPageError === 'boolean') {
    out.failOnPageError = raw.failOnPageError;
  }

  if (raw.strategy === 'next-link' || raw.strategy === 'url-pattern') {
    out.strategy = raw.strategy;
  }

  return out;
}

/**
 * Validate pagination fields on a merged config (presets / CLI).
 * @param {object} config
 * @param {{ warnUnusedUrl?: boolean }} [options]
 */
export function validatePaginationConfig(config, options = {}) {
  if (!config.paginate) return;
  if (config.strategy === 'next-link') {
    if (!String(config.nextSelector || '').trim()) {
      throw new Error('next-link pagination requires nextSelector.');
    }
    return;
  }
  if (config.strategy === 'url-pattern') {
    const tmpl = String(config.urlTemplate || '').trim();
    if (!tmpl.includes('{page}')) {
      throw new Error('url-pattern pagination requires urlTemplate containing {page}.');
    }
    if (options.warnUnusedUrl && String(config.url || '').trim()) {
      console.warn(
        'Note: url-pattern pagination uses urlTemplate only; the url field is ignored for fetching pages.',
      );
    }
  }
}

/**
 * @param {object} raw
 * @param {string} [configPath]
 */
export function parseScrapeConfig(raw, configPath = getConfigPath()) {
  const label = configLabel(configPath);
  assertConfigObject(raw, label);
  const defaults = normalizeBaseDefaults(raw, label);

  let presets = [];
  if (raw.presets != null) {
    if (!Array.isArray(raw.presets)) {
      throw new Error(`${label} "presets" must be an array`);
    }
    presets = raw.presets.map((preset, index) => normalizePreset(preset, index, label));
    const names = new Set();
    for (const preset of presets) {
      if (names.has(preset.presetName)) {
        throw new Error(`Duplicate presetName "${preset.presetName}" in ${label}`);
      }
      names.add(preset.presetName);
    }
  }

  return { defaults, presets };
}

/**
 * @param {string} [configPath]
 */
export function loadScrapeConfig(configPath) {
  const path = resolveConfigPath(configPath);
  activeConfigPath = path;

  if (!existsSync(path)) {
    console.warn(
      `No config at ${path} — using empty defaults. Copy scrape.defaults.example.json to ${CONFIG_BASENAME} or set SCRAPE_CONFIG_PATH.`,
    );
    return {
      defaults: applyAutoOutputName({ ...FALLBACK }),
      presets: [],
    };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${path}: ${err.message}`);
    }
    throw new Error(`Could not read ${path}: ${err.message}`);
  }

  return parseScrapeConfig(raw, path);
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

export function loadScrapeDefaults(configPath) {
  return loadScrapeConfig(configPath).defaults;
}

/** @deprecated Use getConfigPath() */
export const CONFIG_PATH = join(PROJECT_ROOT, CONFIG_BASENAME);
