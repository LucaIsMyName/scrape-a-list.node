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

test('parseFields parses selector@attribute pairs', () => {
  const fields = parseFields('title:.title, link:a@href');
  assert.deepEqual(fields, [
    { name: 'title', selector: '.title' },
    { name: 'link', selector: 'a', attribute: 'href' },
  ]);
});

test('parseFields rejects missing colon, missing name, and missing selector', () => {
  assert.throws(() => parseFields('title .title'), /Invalid field format/);
  assert.throws(() => parseFields(':.title'), /Both name and selector are required/);
  assert.throws(() => parseFields('title:'), /Both name and selector are required/);
  assert.throws(() => parseFields('url:@href'), /Selector is required before @attribute|Attribute name after @/);
});

test('scrapePage extracts text and @href from child and from item element', async () => {
  const html = `
    <div class="list">
      <div class="card"><a class="inner" href="/child">Child</a></div>
      <a class="grid-item" href="/self"><span class="title">Self</span></a>
    </div>`;
  const server = http.createServer((_req, res) => {
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/page`;

  const childResult = await scrapePage(
    base,
    {
      container: '.list',
      item: '.card',
      fields: [
        { name: 'title', selector: 'a' },
        { name: 'url', selector: 'a', attribute: 'href' },
      ],
    },
    { allowPrivateNetwork: true },
  );
  assert.deepEqual(childResult.items, [
    { title: 'Child', url: `http://127.0.0.1:${port}/child` },
  ]);

  const selfResult = await scrapePage(
    base,
    {
      container: '.list',
      item: '.grid-item',
      fields: [
        { name: 'title', selector: '.title' },
        { name: 'url', selector: '.grid-item', attribute: 'href' },
      ],
    },
    { allowPrivateNetwork: true },
  );
  assert.deepEqual(selfResult.items, [
    { title: 'Self', url: `http://127.0.0.1:${port}/self` },
  ]);

  server.close();
});

test('scrapePage @href when list item is the anchor (compound selector fallback)', async () => {
  const html = `
    <ul class="job-offer-list">
      <a class="job-offer-item job-offer-box" href="/jobs/1">
        <span class="title">Role</span>
      </a>
    </ul>`;
  const server = http.createServer((_req, res) => {
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const result = await scrapePage(
    `http://127.0.0.1:${port}/jobs`,
    {
      container: '.job-offer-list',
      item: '.job-offer-item:not(.job-offer-item-breaker)',
      fields: parseFields('name:.title, url:.job-offer-item a@href'),
    },
    { allowPrivateNetwork: true },
  );
  assert.deepEqual(result.items, [
    {
      name: 'Role',
      url: `http://127.0.0.1:${port}/jobs/1`,
    },
  ]);

  server.close();
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
