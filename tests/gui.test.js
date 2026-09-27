import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createApp } from '../gui/server.js';

async function withServer(run, app = createApp()) {
  const server = await new Promise((resolveServer) => {
    const s = app.listen(0, '127.0.0.1', () => resolveServer(s));
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

test('POST /api/scrape rejects non-http protocols', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'ftp://example.com/list',
        container: '.list',
        item: '.item',
        fields: 'title:.title',
        paginate: false,
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /http\/https/i);
  });
});

test('GET /api/download blocks paths outside output', async () => {
  const outsideFile = resolve('tmp-outside.csv');
  await writeFile(outsideFile, 'x,y\n1,2\n', 'utf8');
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/download?file=${encodeURIComponent(outsideFile)}`);
      assert.equal(response.status, 403);
    });
  } finally {
    await rm(outsideFile, { force: true });
  }
});

test('GET /api/download serves files under output with safe headers', async () => {
  const outputFile = resolve(join('output', 'test-download.csv'));
  await writeFile(outputFile, 'name\nluca\n', 'utf8');
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/download?file=${encodeURIComponent(outputFile)}`);
      assert.equal(response.status, 200);
      const disposition = response.headers.get('content-disposition') || '';
      assert.match(disposition, /attachment;/i);
      assert.match(disposition, /filename\*=UTF-8''/i);
    });
  } finally {
    await rm(outputFile, { force: true });
  }
});

test('GET /api/preset?name= returns merged preset config', async () => {
  const app = createApp({
    loadConfig: () => ({
      defaults: {
        url: 'https://example.com/base',
        container: '.list',
        item: '.item',
        fields: 'title:.t',
      },
      presets: [{ presetName: 'mine', url: 'https://example.com/mine' }],
    }),
  });
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/preset?name=${encodeURIComponent('mine')}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.presetName, 'mine');
    assert.equal(body.config.url, 'https://example.com/mine');
  }, app);
});

test('GET /api/presets/:name returns merged preset config', async () => {
  const app = createApp({
    loadConfig: () => ({
      defaults: {
        url: 'https://example.com/base',
        container: '.list',
        item: '.item',
        fields: 'title:.t',
      },
      presets: [{ presetName: 'mine', url: 'https://example.com/mine' }],
    }),
  });
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/presets/mine`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.presetName, 'mine');
    assert.equal(body.config.url, 'https://example.com/mine');
    assert.equal(body.config.container, '.list');
  }, app);
});

test('GET /api/config returns defaults and presets payload', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/config`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body, 'object');
    assert.equal(typeof body.defaults, 'object');
    assert.equal(Array.isArray(body.presets), true);
  });
});

test('GET /api/config returns explicit 500 payload when config load fails', async () => {
  const app = createApp({
    loadConfig: () => {
      throw new Error('broken config');
    },
  });
  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/config`);
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(typeof body.error, 'string');
      assert.equal(Array.isArray(body.presets), true);
    },
    app,
  );
});

test('GET / serves the built React GUI shell', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="root"/);
    assert.match(html, /scrape-a-list-theme/);
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
    assert.doesNotMatch(html, /src="\/app\.js"/);
  });
});

test('GET /api/outputs lists CSV files in the output directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scrape-outputs-'));
  const file = join(dir, 'listed.csv');
  await writeFile(file, 'name\nluca\n', 'utf8');
  try {
    const app = createApp({ outputDir: dir, outputMaxBytes: 1024 * 1024 });
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/outputs`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.files.length, 1);
      assert.equal(body.files[0].name, 'listed.csv');
      assert.equal(typeof body.totalBytes, 'number');
      assert.equal(body.limitBytes, 1024 * 1024);
    }, app);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('DELETE /api/outputs removes a jailed CSV and rejects traversal', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scrape-outputs-del-'));
  const file = join(dir, 'gone.csv');
  await writeFile(file, 'name\nluca\n', 'utf8');
  try {
    const app = createApp({ outputDir: dir, outputMaxBytes: 1024 * 1024 });
    await withServer(async (baseUrl) => {
      const blocked = await fetch(`${baseUrl}/api/outputs?file=${encodeURIComponent(resolve('tmp-outside.csv'))}`, {
        method: 'DELETE',
      });
      assert.equal(blocked.status, 403);

      const removed = await fetch(`${baseUrl}/api/outputs`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file }),
      });
      assert.equal(removed.status, 200);
      const body = await removed.json();
      assert.equal(body.name, 'gone.csv');
    }, app);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('GET /api/health returns ok', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
  });
});

test('POST /api/scrape rejects paginate without valid strategy', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/list',
        container: '.list',
        item: '.item',
        fields: 'title:.title',
        paginate: true,
        strategy: 'invalid',
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /strategy/i);
  });
});

test('POST /api/scrape returns 429 when concurrent job cap is reached', async () => {
  const jobStore = new Map();
  jobStore.set('busy', {
    events: [],
    listeners: [],
    done: false,
    controller: new AbortController(),
  });
  const app = createApp({ jobs: jobStore, maxConcurrentJobs: 1 });
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/list',
        container: '.list',
        item: '.item',
        fields: 'title:.title',
        paginate: false,
      }),
    });
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.match(body.error, /Too many scrapes/i);
  }, app);
});

test('POST /api/scrape validates advanced next-link fallback field types', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/list',
        container: '.list',
        item: '.item',
        fields: 'title:.title',
        paginate: true,
        strategy: 'next-link',
        nextSelector: '#next_month',
        nextUrlSourceSelector: 123,
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /nextUrlSourceSelector/i);
  });
});

test('POST /api/scrape rejects an output path outside the output directory', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com/list',
        container: '.list',
        item: '.item',
        fields: 'title:.title',
        output: '../secret.csv',
      }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /output directory/);
  });
});
