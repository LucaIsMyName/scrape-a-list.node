import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { paginateByNextLink, paginateByPattern } from '../src/paginator.js';

function createHtml(items, nextHref = null) {
  const rows = items.map((item) => `<li class="card"><span class="title">${item}</span></li>`).join('');
  const next = nextHref ? `<a class="next" href="${nextHref}">next</a>` : '';
  return `<div class="list">${rows}</div>${next}`;
}

test('paginateByNextLink follows links and stops on visited URLs', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/list?page=1') {
      res.end(createHtml(['A', 'B'], '/list?page=2'));
      return;
    }
    if (req.url === '/list?page=2') {
      res.end(createHtml(['C'], '/list?page=1'));
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const items = await paginateByNextLink(
    `http://127.0.0.1:${port}/list?page=1`,
    '.next',
    { container: '.list', item: '.card', fields: [{ name: 'title', selector: '.title' }] },
  );
  assert.deepEqual(items.map((row) => row.title), ['A', 'B', 'C']);
  server.close();
});

test('paginateByPattern stops when page returns no items', async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const page = Number(url.searchParams.get('page'));
    if (page <= 3) {
      res.end(createHtml([`P${page}`]));
      return;
    }
    res.end(createHtml([]));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const items = await paginateByPattern(
    `http://127.0.0.1:${port}/list?page={page}`,
    0,
    { container: '.list', item: '.card', fields: [{ name: 'title', selector: '.title' }] },
  );
  assert.deepEqual(items.map((row) => row.title), ['P1', 'P2', 'P3']);
  server.close();
});

test('paginateByNextLink supports non-href next controls via fallback source', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/calendar/2026/05') {
      res.end(`
        <div class="list"><li class="card"><span class="title">May</span></li></div>
        <select id="dropdown_months">
          <option value="/calendar/2026/04">April</option>
          <option value="/calendar/2026/05" selected>May</option>
          <option value="/calendar/2026/06">June</option>
        </select>
        <div id="calendar_navigation_bottom"><a id="next_month">Next</a></div>
      `);
      return;
    }
    if (req.url === '/calendar/2026/06') {
      res.end(`
        <div class="list"><li class="card"><span class="title">June</span></li></div>
        <select id="dropdown_months">
          <option value="/calendar/2026/05">May</option>
          <option value="/calendar/2026/06" selected>June</option>
        </select>
        <div id="calendar_navigation_bottom"><a id="next_month">Next</a></div>
      `);
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const items = await paginateByNextLink(
    `http://127.0.0.1:${port}/calendar/2026/05`,
    '#calendar_navigation_bottom #next_month',
    { container: '.list', item: '.card', fields: [{ name: 'title', selector: '.title' }] },
    undefined,
    {
      nextUrlSourceSelector: '#dropdown_months option[selected]',
      nextUrlAttribute: 'value',
      nextSiblingSelector: 'option',
    },
  );
  assert.deepEqual(items.map((row) => row.title), ['May', 'June']);
  server.close();
});

test('paginateByNextLink stops gracefully when fallback source has no next target', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/calendar/2026/06') {
      res.end(`
        <div class="list"><li class="card"><span class="title">June</span></li></div>
        <select id="dropdown_months">
          <option value="/calendar/2026/06" selected>June</option>
        </select>
        <div id="calendar_navigation_bottom"><a id="next_month">Next</a></div>
      `);
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const items = await paginateByNextLink(
    `http://127.0.0.1:${port}/calendar/2026/06`,
    '#calendar_navigation_bottom #next_month',
    { container: '.list', item: '.card', fields: [{ name: 'title', selector: '.title' }] },
    undefined,
    {
      nextUrlSourceSelector: '#dropdown_months option[selected]',
      nextUrlAttribute: 'value',
      nextSiblingSelector: 'option',
    },
  );
  assert.deepEqual(items.map((row) => row.title), ['June']);
  server.close();
});
