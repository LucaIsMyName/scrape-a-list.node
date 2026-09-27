import { Parser } from 'json2csv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOutputMaxBytes, pruneOutputDir } from './outputQuota.js';

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Basename for a list CSV: list-YYYY-MM-DD-HH-MM-SS.csv (local time).
 *
 * @param {Date} [d]
 * @returns {string}
 */
export function listTimestampBasename(d = new Date()) {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  return `list-${y}${mo}${day}${h}${min}${s}.csv`;
}

const DEFAULT_OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'output');

/**
 * Resolves a CSV path inside the project output directory.
 * Absolute paths and any relative path that would leave that directory are rejected.
 *
 * @param {string} filePath
 * @param {string} [baseDir]
 * @returns {string}
 */
export function resolveOutputPath(filePath, baseDir = DEFAULT_OUTPUT_DIR) {
  const root = resolve(baseDir);
  const raw = String(filePath ?? '').trim();
  let relativePart = listTimestampBasename();

  if (raw) {
    if (isAbsolute(raw)) {
      throw new Error('Output path must stay inside the output directory.');
    }
    const parts = raw.replace(/^[.][/\\]+/, '').split(/[/\\]/).filter((part) => part !== '' && part !== '.');
    if (parts[0]?.toLowerCase() === 'output') parts.shift();
    if (!parts.length) {
      throw new Error('Output path must stay inside the output directory.');
    }
    relativePart = parts.join('/');
  }

  const target = resolve(root, relativePart);
  const rel = relative(root, target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('Output path must stay inside the output directory.');
  }
  return target;
}

/** ASCII and common smart/curly quote characters → straight single quote */
const QUOTE_CHARS = /["\u201C\u201D\u2018\u2019]/g;

/**
 * Normalizes quotes in a cell and guards spreadsheet formula injection.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function sanitizeCellValue(value) {
  if (typeof value !== 'string') return value;
  let s = value.replace(QUOTE_CHARS, "'");
  if (/^[=+\-@]/.test(s)) {
    s = `'${s}`;
  }
  return s;
}

/**
 * Converts an array of objects to a CSV string.
 *
 * @param {object[]} items
 * @returns {string} CSV string
 */
export function toCSV(items) {
  if (!items.length) return '';
  const fields = [...new Set(items.flatMap((item) => Object.keys(item)))];
  const sanitizedItems = items.map((item) => {
    const row = {};
    for (const key of fields) {
      row[key] = sanitizeCellValue(item[key]);
    }
    return row;
  });
  const parser = new Parser({ fields });
  return parser.parse(sanitizedItems);
}

/**
 * Writes an array of objects to a CSV file.
 *
 * @param {object[]} items
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function writeCSV(items, filePath) {
  const target = resolveOutputPath(filePath);
  await mkdir(dirname(target), { recursive: true });
  const csv = toCSV(items);
  await writeFile(target, csv, 'utf-8');
  await pruneOutputDir(DEFAULT_OUTPUT_DIR, parseOutputMaxBytes(process.env.OUTPUT_MAX_BYTES));
  return target;
}
