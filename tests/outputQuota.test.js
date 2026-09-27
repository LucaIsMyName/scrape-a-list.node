import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  listOutputCsvFiles,
  parseOutputMaxBytes,
  previewOutputCsv,
  pruneOutputDir,
  resolveJailedOutputPath,
} from '../src/outputQuota.js';

test('parseOutputMaxBytes uses fallback for invalid values', () => {
  assert.equal(parseOutputMaxBytes('', 10), 10);
  assert.equal(parseOutputMaxBytes('nope', 10), 10);
  assert.equal(parseOutputMaxBytes('0', 10), 10);
  assert.equal(parseOutputMaxBytes('2048'), 2048);
});

test('resolveJailedOutputPath rejects paths outside the output directory', () => {
  const root = resolve('output');
  assert.throws(() => resolveJailedOutputPath(resolve('tmp-outside.csv'), root), /Access denied/);
  assert.ok(resolveJailedOutputPath(join(root, 'ok.csv'), root).endsWith('ok.csv'));
});

test('pruneOutputDir deletes oldest CSV files until under the byte limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scrape-quota-'));
  try {
    const older = join(dir, 'old.csv');
    const newer = join(dir, 'new.csv');
    await writeFile(older, 'a'.repeat(80), 'utf8');
    await new Promise((resolveWait) => setTimeout(resolveWait, 20));
    await writeFile(newer, 'b'.repeat(80), 'utf8');

    const result = await pruneOutputDir(dir, 100);
    assert.deepEqual(result.deleted, ['old.csv']);
    assert.ok(result.totalBytes <= 100);

    const remaining = await listOutputCsvFiles(dir);
    assert.deepEqual(remaining.map((file) => file.name), ['new.csv']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('previewOutputCsv returns headers and rows from a jailed CSV', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scrape-preview-'));
  try {
    const file = join(dir, 'sample.csv');
    await writeFile(file, 'title,link\nHello,https://example.com\nWorld,https://example.org\n', 'utf8');
    const preview = await previewOutputCsv(file, dir, 20);
    assert.deepEqual(preview.headers, ['title', 'link']);
    assert.equal(preview.rows.length, 2);
    assert.equal(preview.rows[0].link, 'https://example.com');
    assert.equal(preview.truncated, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
