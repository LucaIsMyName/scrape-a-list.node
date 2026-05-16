import inquirer from 'inquirer';

export async function askBaseQuestions(defaults) {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Starting page URL:',
      default: defaults.url || undefined,
      validate: (v) => {
        try {
          new URL(v);
          return true;
        } catch {
          return 'Please enter a valid URL (e.g. https://example.com/concerts)';
        }
      },
    },
    {
      type: 'input',
      name: 'container',
      message: 'CSS selector for the list container:',
      default: defaults.container || undefined,
      validate: (v) => (v.trim() ? true : 'Container selector is required'),
    },
    {
      type: 'input',
      name: 'item',
      message: 'CSS selector for each item inside the container:',
      default: defaults.item || undefined,
      validate: (v) => (v.trim() ? true : 'Item selector is required'),
    },
    {
      type: 'input',
      name: 'fields',
      message: 'Fields to extract (comma-separated name:selector pairs):\n  e.g. title:.title, date:.date, venue:.venue\n ',
      default: defaults.fields || undefined,
      validate: (v) => {
        const pairs = v.split(',').map((s) => s.trim()).filter(Boolean);
        if (!pairs.length) return 'At least one field is required';
        for (const pair of pairs) {
          if (!pair.includes(':')) return `Invalid field "${pair}" — expected "name:selector"`;
        }
        return true;
      },
    },
  ]);
}

export async function askPagination(defaults) {
  const { paginate } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'paginate',
      message: 'Does this page have pagination?',
      default: defaults.paginate,
    },
  ]);

  if (!paginate) return { paginate: false };

  const { strategy } = await inquirer.prompt([
    {
      type: 'list',
      name: 'strategy',
      message: 'Pagination strategy:',
      default: defaults.strategy,
      choices: [
        { name: 'Follow a "next page" link', value: 'next-link' },
        { name: 'URL pattern with {page} placeholder', value: 'url-pattern' },
      ],
    },
  ]);

  if (strategy === 'next-link') {
    const {
      nextSelector,
      nextUrlSourceSelector,
      nextUrlAttribute,
      nextSiblingSelector,
    } = await inquirer.prompt([
      {
        type: 'input',
        name: 'nextSelector',
        message: 'CSS selector for the "next page" link:',
        default: defaults.nextSelector || undefined,
        validate: (v) => (v.trim() ? true : 'Selector is required'),
      },
      {
        type: 'input',
        name: 'nextUrlSourceSelector',
        message: 'Next URL source selector (optional):',
        default: defaults.nextUrlSourceSelector || undefined,
      },
      {
        type: 'input',
        name: 'nextUrlAttribute',
        message: 'Next URL attribute (optional):',
        default: defaults.nextUrlAttribute || undefined,
      },
      {
        type: 'input',
        name: 'nextSiblingSelector',
        message: 'Next sibling selector (optional):',
        default: defaults.nextSiblingSelector || undefined,
      },
    ]);
    return {
      paginate: true,
      strategy,
      nextSelector,
      nextUrlSourceSelector,
      nextUrlAttribute,
      nextSiblingSelector,
    };
  }

  // url-pattern
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'urlTemplate',
      message: 'URL template with {page} placeholder:\n  e.g. https://example.com/concerts?page={page}\n ',
      default: defaults.urlTemplate || undefined,
      validate: (v) => {
        if (!v.includes('{page}')) return 'URL must contain {page} placeholder';
        return true;
      },
    },
    {
      type: 'number',
      name: 'maxPages',
      message: 'Max pages to scrape (0 = auto until pages stop):',
      default: defaults.maxPages,
    },
  ]);
  return { paginate: true, strategy, ...answers };
}

export async function askOutput(defaults) {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'output',
      message: 'Output CSV filename:',
      default: defaults.output,
    },
  ]);
}

export async function confirmSummary(config, options = {}) {
  const interactive = options.interactive !== false;

  console.log('\n--- Scrape Configuration ---');
  console.log(`  URL:        ${config.url}`);
  console.log(`  Container:  ${config.container}`);
  console.log(`  Item:       ${config.item}`);
  console.log(`  Fields:     ${config.fields}`);
  if (config.paginate) {
    console.log(`  Pagination: ${config.strategy}`);
    if (config.strategy === 'next-link') {
      console.log(`  Next link:  ${config.nextSelector}`);
      if (String(config.nextUrlSourceSelector || '').trim()) {
        console.log(`  Next URL source: ${config.nextUrlSourceSelector}`);
      }
      if (String(config.nextUrlAttribute || '').trim()) {
        console.log(`  Next URL attribute: ${config.nextUrlAttribute}`);
      }
      if (String(config.nextSiblingSelector || '').trim()) {
        console.log(`  Next sibling selector: ${config.nextSiblingSelector}`);
      }
    } else {
      console.log(`  URL pattern: ${config.urlTemplate}`);
      console.log(`  Max pages:   ${config.maxPages || 'auto'}`);
    }
  } else {
    console.log('  Pagination: no');
  }
  if (Number(config.retryAttempts) > 0) {
    console.log(`  Retries:    ${config.retryAttempts} (delay ${Number(config.retryDelayMs) || 0}ms)`);
  }
  if (Number(config.pageDelayMs) > 0) {
    console.log(`  Page delay: ${config.pageDelayMs}ms`);
  }
  if (config.failOnPageError) {
    console.log('  Fail on page HTTP error: yes');
  }
  console.log(`  Output:     ${config.output}`);
  console.log('----------------------------\n');

  if (!interactive) return true;

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Start scraping?',
      default: true,
    },
  ]);

  return confirmed;
}
