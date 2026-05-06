import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, normalize, relative, isAbsolute, basename } from 'node:path';
import { createReadStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

import { runScrapeJob } from '../src/orchestrator.js';
import { parseFields, isAbortError } from '../src/scraper.js';
import { validateTargetUrl } from '../src/urlSafety.js';
import { writeCSV } from '../src/csv.js';
import { loadScrapeDefaults } from '../cli/loadConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, 'public');
const OUTPUT_DIR = resolve(__dirname, '..', 'output');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.GUI_HOST || '127.0.0.1';
const ALLOW_PRIVATE_NETWORK_TARGETS = process.env.ALLOW_PRIVATE_NETWORK_TARGETS === 'true';
const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 15_000;
const SCRAPE_MAX_RESPONSE_BYTES = Number(process.env.SCRAPE_MAX_RESPONSE_BYTES) || 5 * 1024 * 1024;
const MAX_JOB_EVENTS = Number(process.env.MAX_JOB_EVENTS) || 1_000;
const JOB_TTL_MS = Number(process.env.JOB_TTL_MS) || 10 * 60 * 1000;

// ─── In-memory job store ───────────────────────────────────────────
// Each job: { events, listeners, done, controller }
const jobs = new Map();

function emitToJob(jobId, event) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.events.push(event);
  if (job.events.length > MAX_JOB_EVENTS) {
    job.events.shift();
  }
  for (const send of job.listeners) send(event);
  if (event.type === 'done' || event.type === 'error' || event.type === 'cancelled') {
    job.done = true;
    setTimeout(() => jobs.delete(jobId), JOB_TTL_MS);
  }
}

function sanitizeAttachmentFilename(name) {
  return name.replace(/[\r\n"]/g, '_');
}

function assertValidApiConfig({ url, container, item, fieldsRaw, paginate, strategy, nextSelector, urlTemplate }) {
  if (!url || !container || !item || !fieldsRaw) {
    throw new Error('url, container, item, and fields are required.');
  }
  validateTargetUrl(url, { allowPrivateNetwork: ALLOW_PRIVATE_NETWORK_TARGETS });
  parseFields(fieldsRaw);
  if (paginate && strategy === 'next-link' && !String(nextSelector || '').trim()) {
    throw new Error('"nextSelector" is required for next-link pagination.');
  }
  if (paginate && strategy === 'url-pattern') {
    if (!String(urlTemplate || '').includes('{page}')) {
      throw new Error('"urlTemplate" must contain {page}.');
    }
    const sampleUrl = String(urlTemplate).replace('{page}', '1');
    validateTargetUrl(sampleUrl, { allowPrivateNetwork: ALLOW_PRIVATE_NETWORK_TARGETS });
  }
}

async function runScrape(jobId, config) {
  const job = jobs.get(jobId);
  if (!job) return;
  const { signal } = job.controller;

  emitToJob(jobId, { type: 'start' });

  const onPage = (page, count) => emitToJob(jobId, { type: 'page', page, count });

  let items;
  try {
    const result = await runScrapeJob(config, onPage, {
      signal,
      allowPrivateNetwork: ALLOW_PRIVATE_NETWORK_TARGETS,
      timeoutMs: SCRAPE_TIMEOUT_MS,
      maxResponseBytes: SCRAPE_MAX_RESPONSE_BYTES,
    });
    items = result.items;
  } catch (err) {
    if (isAbortError(err)) {
      emitToJob(jobId, { type: 'cancelled' });
      return;
    }
    const status = err.response?.status;
    const msg = status
      ? `HTTP ${status} ${err.response.statusText} — ${config.url}`
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

  const csvPath = await writeCSV(items, config.output || '');
  emitToJob(jobId, { type: 'done', count: items.length, preview: items.slice(0, 20), csvPath });
}

// ─── Routes ───────────────────────────────────────────────────────
export function createApp() {
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

    try {
      assertValidApiConfig({
        url,
        container,
        item,
        fieldsRaw,
        paginate: Boolean(paginate),
        strategy,
        nextSelector,
        urlTemplate,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }

    const jobId = randomUUID();
    jobs.set(jobId, {
      events: [],
      listeners: [],
      done: false,
      controller: new AbortController(),
    });

    // Fire-and-forget — errors are routed back through emitToJob
    runScrape(jobId, {
      url,
      container,
      item,
      fieldsRaw,
      paginate: Boolean(paginate),
      strategy,
      nextSelector,
      urlTemplate,
      maxPages,
      output,
    }).catch((err) => {
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
    const file = typeof req.query.file === 'string' ? req.query.file : '';
    if (!file) return res.status(400).json({ error: 'file query param required.' });

    const abs = normalize(resolve(file));
    const rel = relative(OUTPUT_DIR, abs);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!existsSync(abs)) return res.status(404).json({ error: 'File not found.' });

    const rawName = basename(abs);
    const safeName = sanitizeAttachmentFilename(rawName);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    createReadStream(abs).pipe(res);
  });

  return app;
}

export function startServer() {
  const app = createApp();
  app.listen(PORT, HOST, () => {
    const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`\n  scrape-a-list — GUI\n  http://${displayHost}:${PORT}\n`);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
