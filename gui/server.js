import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, normalize } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';

import { scrapePage, parseFields } from '../src/scraper.js';
import { paginateByNextLink, paginateByPattern } from '../src/paginator.js';
import { resolveOutputPath, writeCSV } from '../src/csv.js';
import { loadScrapeDefaults } from '../cli/loadConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const OUTPUT_DIR = resolve(__dirname, '..', 'output');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/', (_req, res) => {
  res.sendFile(join(PUBLIC_DIR, 'index.html'));
});

app.get('/api/defaults', (_req, res) => {
  try {
    const defaults = loadScrapeDefaults();
    res.json(defaults);
  } catch {
    res.json({});
  }
});

app.post('/api/scrape', async (req, res) => {
  const {
    url,
    container,
    item,
    fields: fieldsRaw,
    paginate,
    strategy,
    nextSelector,
    urlTemplate,
    maxPages = 0,
    output,
  } = req.body;

  if (!url || !container || !item || !fieldsRaw) {
    return res.status(400).json({ error: 'url, container, item, and fields are required.' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }

  const fields = parseFields(fieldsRaw);
  const scrapeOpts = { container, item, fields };

  let items;
  try {
    if (!paginate) {
      const result = await scrapePage(url, scrapeOpts);
      items = result.items;
    } else if (strategy === 'next-link') {
      items = await paginateByNextLink(url, nextSelector, scrapeOpts);
    } else {
      items = await paginateByPattern(urlTemplate, Number(maxPages) || 0, scrapeOpts);
    }
  } catch (err) {
    const status = err.response?.status;
    const msg = status
      ? `HTTP ${status} ${err.response.statusText} — ${url}`
      : err.message;
    return res.status(502).json({ error: msg });
  }

  if (!items.length) {
    return res.json({ count: 0, items: [], csvPath: null });
  }

  const csvPath = await writeCSV(items, output || '');

  res.json({
    count: items.length,
    preview: items.slice(0, 20),
    csvPath,
  });
});

app.get('/api/download', (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file query param required.' });

  // Restrict downloads to the output/ directory to prevent path traversal.
  const abs = normalize(resolve(file));
  const outAbs = normalize(OUTPUT_DIR);
  if (!abs.startsWith(outAbs + '/') && abs !== outAbs) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  if (!existsSync(abs)) return res.status(404).json({ error: 'File not found.' });

  const filename = abs.split('/').pop();
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'text/csv');
  createReadStream(abs).pipe(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  scrape-a-list — GUI\n  http://localhost:${PORT}\n`);
});
