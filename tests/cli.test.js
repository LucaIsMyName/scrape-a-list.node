import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs } from '../index.js';
import { resolveConfigForPreset } from '../cli/index.js';
import { parseScrapeConfig } from '../cli/loadConfig.js';

test('parseCliArgs reads --preset name', () => {
  const args = parseCliArgs(['--preset', 'diakonie-list']);
  assert.equal(args.preset, 'diakonie-list');
  assert.equal(args.help, false);
  assert.equal(args.version, false);
});

test('parseCliArgs fails when --preset value is missing', () => {
  assert.throws(() => parseCliArgs(['--preset']), /--preset requires a preset name/);
});

test('parseCliArgs supports --help and --version', () => {
  const args = parseCliArgs(['--help', '--version']);
  assert.equal(args.help, true);
  assert.equal(args.version, true);
});

test('parseCliArgs fails for unknown flags', () => {
  assert.throws(() => parseCliArgs(['--wat']), /Unknown argument: --wat/);
});

test('resolveConfigForPreset throws when merged config is incomplete', () => {
  const parsed = parseScrapeConfig({
    url: '',
    container: '.list',
    item: '.item',
    fields: '',
    presets: [{ presetName: 'bad' }],
  });
  assert.throws(
    () => resolveConfigForPreset(parsed, 'bad'),
    /missing required values after merge: url, fields/,
  );
});

test('resolveConfigForPreset throws unknown preset with available names', () => {
  const parsed = parseScrapeConfig({
    url: 'https://example.com/list',
    container: '.list',
    item: '.item',
    fields: 'title:.title',
    presets: [{ presetName: 'known' }],
  });
  assert.throws(
    () => resolveConfigForPreset(parsed, 'unknown'),
    /Unknown preset "unknown"\. Available presets: known/,
  );
});
