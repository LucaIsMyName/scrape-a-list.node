#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { run } from './cli/index.js';

function parseCliArgs(argv) {
  const out = { preset: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preset') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--preset requires a preset name');
      }
      out.preset = next;
      i += 1;
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let cliOptions;
  try {
    cliOptions = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }

  run(cliOptions);
}

export { parseCliArgs };
