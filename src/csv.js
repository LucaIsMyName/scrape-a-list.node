import { Parser } from 'json2csv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, isAbsolute } from 'node:path';

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

/**
 * Resolves where the CSV should be written. Relative paths that do not already
 * live under `output/` are placed in `output/` so scrapes do not clutter the repo root.
 *
 * @param {string} filePath
 * @returns {string}
 */
export function resolveOutputPath(filePath) {
  const p = String(filePath ?? '').trim();
  if (!p) return join('output', listTimestampBasename());
  if (isAbsolute(p)) return normalize(p);
  const stripped = p.replace(/^[.][/\\]+/, '');
  const firstSegment = stripped.split(/[/\\]/)[0];
  if (firstSegment.toLowerCase() === 'output') {
    return normalize(stripped);
  }
  return normalize(join('output', stripped));
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
