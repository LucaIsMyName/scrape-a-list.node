import { Parser } from 'json2csv';
import { writeFile } from 'node:fs/promises';

/**
 * Converts an array of objects to a CSV string.
 *
 * @param {object[]} items
 * @returns {string} CSV string
 */
export function toCSV(items) {
  if (!items.length) return '';
  const parser = new Parser({ fields: Object.keys(items[0]) });
  return parser.parse(items);
}

/**
 * Writes an array of objects to a CSV file.
 *
 * @param {object[]} items
 * @param {string} filePath
 * @returns {Promise<void>}
 */
export async function writeCSV(items, filePath) {
  const csv = toCSV(items);
  await writeFile(filePath, csv, 'utf-8');
}
