import { askBaseQuestions, askPagination, askOutput, confirmSummary } from './prompts.js';
import { loadScrapeDefaults, loadScrapeConfig, getEffectiveConfig } from './loadConfig.js';
import { runScrapeJob } from '../src/orchestrator.js';
import { resolveOutputPath, writeCSV } from '../src/csv.js';

const REQUIRED_PRESET_KEYS = ['url', 'container', 'item', 'fields'];

function missingRequiredFields(config) {
  return REQUIRED_PRESET_KEYS.filter((key) => !String(config[key] || '').trim());
}

export function resolveConfigForPreset(configData, presetName) {
  const config = getEffectiveConfig(configData, presetName);
  const missing = missingRequiredFields(config);
  if (missing.length) {
    throw new Error(
      `Preset "${presetName}" is missing required values after merge: ${missing.join(', ')}`,
    );
  }
  return { ...config, output: resolveOutputPath(config.output) };
}

export async function run(options = {}) {
  console.log('\n  scrape-a-list — CLI Web Scraper\n');

  let config;
  let presetName = null;
  try {
    presetName = typeof options.preset === 'string' ? options.preset.trim() : null;
    if (presetName) {
      const fullConfig = loadScrapeConfig();
      config = resolveConfigForPreset(fullConfig, presetName);
    } else {
      const defaults = loadScrapeDefaults();
      const base = await askBaseQuestions(defaults);
      const pagination = await askPagination(defaults);
      const { output } = await askOutput(defaults);
      const outputPath = resolveOutputPath(output);
      config = { ...defaults, ...base, ...pagination, output: outputPath };
    }
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }

  const confirmed = await confirmSummary(config, { interactive: !presetName });
  if (!confirmed) {
    console.log('Aborted.');
    return;
  }
  if (presetName) {
    console.log(`Running preset: ${presetName}`);
  }

  let items;

  try {
    if (!config.paginate) console.log('Scraping single page...');
    else if (config.strategy === 'next-link') console.log('Scraping with "next link" pagination...');
    else console.log('Scraping with URL pattern pagination...');

    const result = await runScrapeJob(
      {
        url: config.url,
        container: config.container,
        item: config.item,
        fieldsRaw: config.fields,
        paginate: config.paginate,
        strategy: config.strategy,
        nextSelector: config.nextSelector,
        nextUrlSourceSelector: config.nextUrlSourceSelector,
        nextUrlAttribute: config.nextUrlAttribute,
        nextSiblingSelector: config.nextSiblingSelector,
        urlTemplate: config.urlTemplate,
        maxPages: config.maxPages,
      },
      (page, count) => {
        console.log(`  Page ${page}: ${count} items`);
      },
      { allowPrivateNetwork: true },
    );
    items = result.items;

    if (!items.length) {
      console.log('\nNo items found. Check your selectors and try again.');
      return;
    }

    console.log(`\nTotal items scraped: ${items.length}`);
    const writtenTo = await writeCSV(items, config.output);
    console.log(`CSV written to: ${writtenTo}\n`);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    if (err.response) {
      console.error(`HTTP ${err.response.status}: ${err.response.statusText}`);
    }
    process.exit(1);
  }
}
