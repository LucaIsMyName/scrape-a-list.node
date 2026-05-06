import { askBaseQuestions, askPagination, askOutput, confirmSummary } from './prompts.js';
import { loadScrapeDefaults } from './loadConfig.js';
import { runScrapeJob } from '../src/orchestrator.js';
import { resolveOutputPath, writeCSV } from '../src/csv.js';

export async function run() {
  console.log('\n  scrape-a-list — CLI Web Scraper\n');

  let defaults;
  try {
    defaults = loadScrapeDefaults();
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }

  const base = await askBaseQuestions(defaults);
  const pagination = await askPagination(defaults);
  const { output } = await askOutput(defaults);
  const outputPath = resolveOutputPath(output);

  const config = { ...base, ...pagination, output: outputPath };

  const confirmed = await confirmSummary(config);
  if (!confirmed) {
    console.log('Aborted.');
    return;
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
