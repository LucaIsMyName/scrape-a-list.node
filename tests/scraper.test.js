import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFields } from '../src/scraper.js';

test('parseFields parses valid field pairs', () => {
  const fields = parseFields('title:.title, date:.date');
  assert.deepEqual(fields, [
    { name: 'title', selector: '.title' },
    { name: 'date', selector: '.date' },
  ]);
});

test('parseFields rejects missing colon, missing name, and missing selector', () => {
  assert.throws(() => parseFields('title .title'), /Invalid field format/);
  assert.throws(() => parseFields(':.title'), /Both name and selector are required/);
  assert.throws(() => parseFields('title:'), /Both name and selector are required/);
});
