import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseFields, scrapePage } from '../src/scraper.js';

test('parseFields parses valid field pairs', () => {
  const fields = parseFields('title:.title, date:.date');
  assert.deepEqual(fields, [
    { name: 'title', selector: '.title' },
    { name: 'date', selector: '.date' },
  ]);
});

test('parseFields rejects missing colon, missing name, and missing selector', () => {
  assert.throws(() => parseFields('title .title'), /Invalid field format/);
  assert.throws(() => parseFields(':.title'), /Both name and selector are required/);
  assert.throws(() => parseFields('title:'), /Both name and selector are required/);
});

test('scrapePage retries transient HTTP failures when configured', async () => {
  let calls = 0;
  const server = http.createServer((_req, res) => {
    calls += 1;
    if (calls < 2) {
      res.statusCode = 503;
      res.end('retry');
      return;
    }
    res.end('<div class="list"><div class="card"><span class="title">Retried</span></div></div>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const result = await scrapePage(
    `http://127.0.0.1:${port}/list`,
    {
      container: '.list',
      item: '.card',
      fields: [{ name: 'title', selector: '.title' }],
    },
    {
      allowPrivateNetwork: true,
      retryAttempts: 1,
      retryDelayMs: 1,
    },
  );

  assert.equal(calls, 2);
  assert.deepEqual(result.items, [{ title: 'Retried' }]);
  server.close();
});

test('scrapePage follows a same-host redirect and rejects a non-http redirect', async () => {
  const pages = {
    '/start': { status: 302, location: '/list' },
    '/list': { status: 200, body: '<div class="list"><div class="card"><span class="title">Ok</span></div></div>' },
    '/ftp': { status: 302, location: 'ftp://example.com/file' },
  };
  const server = http.createServer((req, res) => {
    const page = pages[req.url];
    if (!page) {
      res.statusCode = 404;
      res.end('missing');
      return;
    }
    if (page.location) res.setHeader('Location', page.location);
    res.statusCode = page.status;
    res.end(page.body || '');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const scrapeOpts = {
    container: '.list',
    item: '.card',
    fields: [{ name: 'title', selector: '.title' }],
  };
  const reqOpts = { allowPrivateNetwork: true };

  const result = await scrapePage(`http://127.0.0.1:${port}/start`, scrapeOpts, reqOpts);
  assert.deepEqual(result.items, [{ title: 'Ok' }]);

  await assert.rejects(
    () => scrapePage(`http://127.0.0.1:${port}/ftp`, scrapeOpts, reqOpts),
    /http\/https/,
  );

  server.close();
});
