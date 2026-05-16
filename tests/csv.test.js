import test from 'node:test';
import assert from 'node:assert/strict';
import { listTimestampBasename, resolveOutputPath, toCSV } from '../src/csv.js';

test('listTimestampBasename uses cross-platform safe separators', () => {
  const name = listTimestampBasename(new Date('2026-05-06T14:30:45Z'));
  assert.match(name, /^list-(20260506\d{6}|2026-05-06-\d{2}-30-45)\.csv$/);
  assert.equal(name.includes(':'), false);
});

test('resolveOutputPath keeps output-prefixed paths and prefixes other relative ones', () => {
  assert.match(
    resolveOutputPath(''),
    /^output\/list-(\d{14}|\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.csv$/,
  );
  assert.equal(resolveOutputPath('output/custom.csv'), 'output/custom.csv');
  assert.equal(resolveOutputPath('custom.csv'), 'output/custom.csv');
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
