import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { runScrapeJob } from '../src/orchestrator.js';

function listenServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

test('runScrapeJob returns fields and items for single page', async () => {
  const server = await listenServer((_req, res) => {
    res.end('<div class="list"><div class="card"><span class="title">A</span></div></div>');
  });
  const { port } = server.address();

  const result = await runScrapeJob(
    {
      url: `http://127.0.0.1:${port}/list`,
      container: '.list',
      item: '.card',
      fieldsRaw: 'title:.title',
      paginate: false,
    },
    undefined,
    { allowPrivateNetwork: true },
  );

  assert.deepEqual(result.fields, [{ name: 'title', selector: '.title' }]);
  assert.deepEqual(result.items, [{ title: 'A' }]);
  await closeServer(server);
});

test('runScrapeJob emits warnings for paginated HTTP errors when failOnPageError=false', async () => {
  const server = await listenServer((req, res) => {
    if (req.url === '/list?page=1') {
      res.end('<div class="list"><div class="card"><span class="title">A</span></div></div><a class="next" href="/list?page=2">next</a>');
      return;
    }
    if (req.url === '/list?page=2') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.statusCode = 500;
    res.end('unexpected');
  });
  const { port } = server.address();
  const warnings = [];

  const result = await runScrapeJob(
    {
      url: `http://127.0.0.1:${port}/list?page=1`,
      container: '.list',
      item: '.card',
      fieldsRaw: 'title:.title',
      paginate: true,
      strategy: 'next-link',
      nextSelector: '.next',
      failOnPageError: false,
    },
    undefined,
    {
      allowPrivateNetwork: true,
      onWarning: (warning) => warnings.push(warning),
    },
  );

  assert.deepEqual(result.items, [{ title: 'A' }]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].status, 404);
  await closeServer(server);
});
