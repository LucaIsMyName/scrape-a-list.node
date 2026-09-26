import { Parser } from 'json2csv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

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
      const value = item[key];
      if (typeof value === 'string' && /^[=+\-@]/.test(value)) {
        row[key] = `'${value}`;
      } else {
        row[key] = value;
      }
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
  return target;
}
