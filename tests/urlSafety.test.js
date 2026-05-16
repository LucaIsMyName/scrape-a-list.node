import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTargetUrl } from '../src/urlSafety.js';

test('validateTargetUrl allows http and https', () => {
  const httpUrl = validateTargetUrl('http://example.com/path');
  const httpsUrl = validateTargetUrl('https://example.com/path');
  assert.equal(httpUrl.protocol, 'http:');
  assert.equal(httpsUrl.protocol, 'https:');
});

test('validateTargetUrl rejects unsupported schemes', () => {
  assert.throws(() => validateTargetUrl('ftp://example.com'), /Only http\/https URLs are supported/);
});

test('validateTargetUrl blocks localhost/private hosts when disabled', () => {
  assert.throws(
    () => validateTargetUrl('http://localhost:8080', { allowPrivateNetwork: false }),
    /private or local network/,
  );
  assert.throws(
    () => validateTargetUrl('http://192.168.0.10/test', { allowPrivateNetwork: false }),
    /private or local network/,
  );
});

test('validateTargetUrl allows private hosts when explicitly enabled', () => {
  const url = validateTargetUrl('http://127.0.0.1:3000/list', { allowPrivateNetwork: true });
  assert.equal(url.hostname, '127.0.0.1');
});
