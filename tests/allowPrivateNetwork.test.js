import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCliAllowPrivateNetwork } from '../cli/allowPrivateNetwork.js';

test('resolveCliAllowPrivateNetwork defaults to allowing private targets', () => {
  const prev = process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
  delete process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
  try {
    assert.equal(resolveCliAllowPrivateNetwork({}), true);
  } finally {
    if (prev === undefined) delete process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
    else process.env.ALLOW_PRIVATE_NETWORK_TARGETS = prev;
  }
});

test('resolveCliAllowPrivateNetwork respects env false unless --allow-private', () => {
  const prev = process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
  process.env.ALLOW_PRIVATE_NETWORK_TARGETS = 'false';
  try {
    assert.equal(resolveCliAllowPrivateNetwork({}), false);
    assert.equal(resolveCliAllowPrivateNetwork({ allowPrivate: true }), true);
  } finally {
    if (prev === undefined) delete process.env.ALLOW_PRIVATE_NETWORK_TARGETS;
    else process.env.ALLOW_PRIVATE_NETWORK_TARGETS = prev;
  }
});
