import { askBaseQuestions, askPagination, askOutput, confirmSummary } from './prompts.js';
import { scrapePage, parseFields } from '../src/scraper.js';
import { paginateByNextLink, paginateByPattern } from '../src/paginator.js';
import { writeCSV } from '../src/csv.js';

export async function run() {
  console.log('\n  scrape-a-list — CLI Web Scraper\n');

  const base = await askBaseQuestions();
  const pagination = await askPagination();
  const { output } = await askOutput();

  const config = { ...base, ...pagination, output };

  const confirmed = await confirmSummary(config);
  if (!confirmed) {
    console.log('Aborted.');
    return;
  }

  const fields = parseFields(config.fields);
  const scrapeOpts = {
    container: config.container,
    item: config.item,
    fields,
  };

  let items;

  try {
    if (!config.paginate) {
      console.log('Scraping single page...');
      const result = await scrapePage(config.url, scrapeOpts);
      items = result.items;
    } else if (config.strategy === 'next-link') {
      console.log('Scraping with "next link" pagination...');
      items = await paginateByNextLink(config.url, config.nextSelector, scrapeOpts, (page, count) => {
        console.log(`  Page ${page}: ${count} items`);
      });
    } else {
      console.log('Scraping with URL pattern pagination...');
      items = await paginateByPattern(config.urlTemplate, config.maxPages, scrapeOpts, (page, count) => {
        console.log(`  Page ${page}: ${count} items`);
      });
    }

    if (!items.length) {
      console.log('\nNo items found. Check your selectors and try again.');
      return;
    }

    console.log(`\nTotal items scraped: ${items.length}`);
    await writeCSV(items, config.output);
    console.log(`CSV written to: ${config.output}\n`);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    if (err.response) {
      console.error(`HTTP ${err.response.status}: ${err.response.statusText}`);
    }
    process.exit(1);
  }
}
