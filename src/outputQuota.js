import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';

export const DEFAULT_OUTPUT_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export function parseOutputMaxBytes(raw, fallback = DEFAULT_OUTPUT_MAX_BYTES) {
  if (raw == null || String(raw).trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function resolveJailedOutputPath(file, outputDir) {
  const raw = String(file ?? '').trim();
  if (!raw) {
    const error = new Error('file is required.');
    error.code = 'ERR_OUTPUT_MISSING';
    throw error;
  }
  const root = resolve(outputDir);
  const abs = normalize(resolve(raw));
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    const error = new Error('Access denied.');
    error.code = 'ERR_OUTPUT_JAIL';
    throw error;
  }
  return abs;
}

export async function listOutputCsvFiles(outputDir) {
  let names;
  try {
    names = await readdir(outputDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const name of names) {
    if (extname(name).toLowerCase() !== '.csv') continue;
    const path = join(outputDir, name);
    const info = await stat(path);
    if (!info.isFile()) continue;
    files.push({
      name,
      path,
      size: info.size,
      mtimeMs: info.mtimeMs,
    });
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
  return files;
}

export async function pruneOutputDir(outputDir, maxBytes = DEFAULT_OUTPUT_MAX_BYTES) {
  const files = await listOutputCsvFiles(outputDir);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes <= maxBytes) {
    return { deleted: [], totalBytes, limitBytes: maxBytes };
  }

  const oldestFirst = [...files].sort(
    (a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name),
  );
  const deleted = [];
  let remaining = totalBytes;
  for (const file of oldestFirst) {
    if (remaining <= maxBytes) break;
    await unlink(file.path);
    remaining -= file.size;
    deleted.push(file.name);
  }
  return { deleted, totalBytes: remaining, limitBytes: maxBytes };
}

export async function deleteOutputCsv(file, outputDir) {
  const abs = resolveJailedOutputPath(file, outputDir);
  if (extname(abs).toLowerCase() !== '.csv') {
    const error = new Error('Only CSV files can be deleted.');
    error.code = 'ERR_OUTPUT_TYPE';
    throw error;
  }
  await unlink(abs);
  return basename(abs);
}

function parseCsvRecords(text, maxRows) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  const pushRecord = () => {
    record.push(field);
    field = '';
    if (record.some((cell) => cell !== '')) rows.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      record.push(field);
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      pushRecord();
      if (rows.length > maxRows) break;
      continue;
    }
    field += char;
  }

  if (field !== '' || record.length) pushRecord();
  return rows;
}

export async function previewOutputCsv(file, outputDir, limit = 20) {
  const abs = resolveJailedOutputPath(file, outputDir);
  if (extname(abs).toLowerCase() !== '.csv') {
    const error = new Error('Only CSV files can be previewed.');
    error.code = 'ERR_OUTPUT_TYPE';
    throw error;
  }
  const text = await readFile(abs, 'utf8');
  const records = parseCsvRecords(text, limit + 1);
  if (!records.length) {
    return { name: basename(abs), headers: [], rows: [], truncated: false };
  }
  const headers = records[0].map((header, index) => header || `column_${index + 1}`);
  const body = records.slice(1, limit + 1);
  const rows = body.map((record) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = record[index] ?? '';
    });
    return row;
  });
  return {
    name: basename(abs),
    headers,
    rows,
    truncated: records.length > limit + 1,
  };
}
