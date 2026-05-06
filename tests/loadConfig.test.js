import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScrapeConfig, getEffectiveConfig } from '../cli/loadConfig.js';

test('parseScrapeConfig returns defaults and presets', () => {
  const config = parseScrapeConfig({
    url: 'https://example.com/list',
    container: '.list',
    item: '.item',
    fields: 'title:.title',
    output: '',
    paginate: true,
    strategy: 'next-link',
    nextSelector: 'a.next',
    nextUrlSourceSelector: '#months option[selected]',
    nextUrlAttribute: 'value',
    nextSiblingSelector: 'option',
    presets: [
      {
        presetName: 'simple',
        strategy: 'url-pattern',
        urlTemplate: 'https://example.com/list?page={page}',
        maxPages: 3,
      },
    ],
  });

  assert.equal(config.presets.length, 1);
  assert.equal(config.presets[0].presetName, 'simple');
  assert.equal(config.defaults.strategy, 'next-link');
  assert.equal(config.defaults.nextUrlSourceSelector, '#months option[selected]');
  assert.equal(config.defaults.nextUrlAttribute, 'value');
  assert.equal(config.defaults.nextSiblingSelector, 'option');
  assert.match(
    config.defaults.output,
    /^list-(\d{14}|\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.csv$/,
  );
});

test('getEffectiveConfig overlays defaults with preset values', () => {
  const config = parseScrapeConfig({
    url: 'https://example.com/base',
    container: '.base-list',
    item: '.base-item',
    fields: 'title:.base-title',
    strategy: 'next-link',
    nextSelector: 'a.base-next',
    presets: [
      {
        presetName: 'override',
        url: 'https://example.com/alt',
        strategy: 'url-pattern',
        urlTemplate: 'https://example.com/alt?page={page}',
        nextUrlAttribute: 'value',
      },
    ],
  });

  const effective = getEffectiveConfig(config, 'override');
  assert.equal(effective.url, 'https://example.com/alt');
  assert.equal(effective.container, '.base-list');
  assert.equal(effective.strategy, 'url-pattern');
  assert.equal(effective.urlTemplate, 'https://example.com/alt?page={page}');
  assert.equal(effective.nextUrlAttribute, 'value');
});

test('parseScrapeConfig rejects duplicate preset names', () => {
  assert.throws(
    () =>
      parseScrapeConfig({
        presets: [
          { presetName: 'dup', url: 'https://example.com/a' },
          { presetName: 'dup', url: 'https://example.com/b' },
        ],
      }),
    /Duplicate presetName "dup"/,
  );
});
