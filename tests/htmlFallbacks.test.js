import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  extractImdbChartFromNextData,
  extractJsonLdItemList,
  formatIsoDuration,
  formatRuntimeSeconds,
  isBotChallengeHtml,
} from '../src/htmlFallbacks.js';

test('formatRuntimeSeconds and formatIsoDuration', () => {
  assert.equal(formatRuntimeSeconds(8520), '2h 22m');
  assert.equal(formatIsoDuration('PT2H22M'), '2h 22m');
});

test('isBotChallengeHtml detects AWS WAF interstitial', () => {
  const sample = readFileSync(new URL('./fixtures/imdb-waf-challenge.html', import.meta.url), 'utf8');
  assert.equal(isBotChallengeHtml(sample), true);
  assert.equal(isBotChallengeHtml('<html><body><ul><li>ok</li></ul></body></html>'), false);
});

test('extractJsonLdItemList and __NEXT_DATA__ parse IMDb chart fixtures', () => {
  const html = readFileSync(new URL('./fixtures/imdb-chart-snippet.html', import.meta.url), 'utf8');
  const jsonLd = extractJsonLdItemList(html);
  assert.ok(jsonLd);
  assert.equal(jsonLd.length, 2);
  assert.equal(jsonLd[0].rankingNumber, '1');
  assert.equal(jsonLd[0].name, 'The Shawshank Redemption');
  assert.equal(jsonLd[0].stars, '9.3');

  const next = extractImdbChartFromNextData(html);
  assert.ok(next);
  assert.equal(next.length, 2);
  assert.equal(next[1].rankingNumber, '2');
  assert.match(next[1].length, /h|m/);
});
