import test from 'node:test';
import assert from 'node:assert/strict';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listTimestampBasename, resolveOutputPath, toCSV } from '../src/csv.js';

const outputDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'output');

test('listTimestampBasename uses cross-platform safe separators', () => {
  const name = listTimestampBasename(new Date('2026-05-06T14:30:45Z'));
  assert.match(name, /^list-(20260506\d{6}|2026-05-06-\d{2}-30-45)\.csv$/);
  assert.equal(name.includes(':'), false);
});

test('resolveOutputPath keeps files inside the output directory', () => {
  const generated = resolveOutputPath('');
  assert.equal(dirname(generated), outputDir);
  assert.match(basename(generated), /^list-\d{14}\.csv$/);
  assert.equal(resolveOutputPath('output/custom.csv'), resolve(outputDir, 'custom.csv'));
  assert.equal(resolveOutputPath('custom.csv'), resolve(outputDir, 'custom.csv'));
  assert.throws(() => resolveOutputPath('../x.csv'), /output directory/);
  assert.throws(() => resolveOutputPath('output/../../x.csv'), /output directory/);
  assert.throws(() => resolveOutputPath('/tmp/x.csv'), /output directory/);
});

test('toCSV includes union of all keys and sanitizes spreadsheet formulas', () => {
  const csv = toCSV([
    { title: '=2+2', venue: 'A' },
    { title: 'Plain', date: '2026-05-06' },
  ]);
  assert.match(csv, /"title","venue","date"/);
  assert.match(csv, /"'=2\+2","A",/);
  assert.match(csv, /"Plain",,"2026-05-06"/);
});
