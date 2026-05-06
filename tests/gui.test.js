import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createApp } from '../gui/server.js';

async function withServer(run) {
  const app = createApp();
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
