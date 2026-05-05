import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, normalize } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { scrapePage, parseFields, isAbortError } from '../src/scraper.js';
import { paginateByNextLink, paginateByPattern } from '../src/paginator.js';
import { writeCSV } from '../src/csv.js';
import { loadScrapeDefaults } from '../cli/loadConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const OUTPUT_DIR = resolve(__dirname, '..', 'output');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// ─── In-memory job store ───────────────────────────────────────────
// Each job: { events, listeners, done, controller }
const jobs = new Map();

function emitToJob(jobId, event) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  for (const send of job.listeners) send(event);
  if (event.type === 'done' || event.type === 'error' || event.type === 'cancelled') {
    job.done = true;
    // Clean up after 10 minutes
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
  }
}

async function runScrape(jobId, { url, container, item, fieldsRaw, paginate, strategy, nextSelector, urlTemplate, maxPages, output }) {
  const job = jobs.get(jobId);
  if (!job) return;
  const { signal } = job.controller;

  emitToJob(jobId, { type: 'start' });

  const fields = parseFields(fieldsRaw);
  const scrapeOpts = { container, item, fields };
  const onPage = (page, count) => emitToJob(jobId, { type: 'page', page, count });
  const fetchOpts = { signal };

  let items;
  try {
    if (!paginate) {
      const result = await scrapePage(url, scrapeOpts, fetchOpts);
      items = result.items;
      onPage(1, items.length);
    } else if (strategy === 'next-link') {
      items = await paginateByNextLink(url, nextSelector, scrapeOpts, onPage, { signal });
    } else {
      items = await paginateByPattern(urlTemplate, Number(maxPages) || 0, scrapeOpts, onPage, { signal });
    }
  } catch (err) {
    if (isAbortError(err)) {
      emitToJob(jobId, { type: 'cancelled' });
      return;
    }
    const status = err.response?.status;
    const msg = status
      ? `HTTP ${status} ${err.response.statusText} — ${url}`
      : err.message;
    emitToJob(jobId, { type: 'error', message: msg });
    return;
  }

  if (signal.aborted) {
    emitToJob(jobId, { type: 'cancelled' });
    return;
  }

  if (!items.length) {
    emitToJob(jobId, { type: 'done', count: 0, preview: [], csvPath: null });
    return;
  }

  const csvPath = await writeCSV(items, output || '');
  emitToJob(jobId, { type: 'done', count: items.length, preview: items.slice(0, 20), csvPath });
}

// ─── Routes ───────────────────────────────────────────────────────

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

// Step 1: validate config, create job, kick off scraping in background
app.post('/api/scrape', (req, res) => {
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

  const jobId = randomUUID();
  jobs.set(jobId, {
    events: [],
    listeners: [],
    done: false,
    controller: new AbortController(),
  });

  // Fire-and-forget — errors are routed back through emitToJob
  runScrape(jobId, { url, container, item, fieldsRaw, paginate, strategy, nextSelector, urlTemplate, maxPages, output })
    .catch((err) => {
      if (isAbortError(err)) {
        emitToJob(jobId, { type: 'cancelled' });
      } else {
        emitToJob(jobId, { type: 'error', message: err.message });
      }
    });

  res.json({ jobId });
});

app.post('/api/scrape/cancel/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  if (job.done) return res.status(409).json({ error: 'Job already finished.' });
  job.controller.abort();
  res.json({ ok: true });
});

// Step 2: SSE event stream — browser opens this with EventSource
app.get('/api/scrape/events/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Replay any events that fired before the client connected
  for (const event of job.events) send(event);

  if (job.done) {
    res.end();
    return;
  }

  // Subscribe to future events
  job.listeners.push(send);

  req.on('close', () => {
    job.listeners = job.listeners.filter((fn) => fn !== send);
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
