#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { run } from './cli/index.js';

function parseCliArgs(argv) {
  const out = { preset: null, help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--preset') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--preset requires a preset name');
      }
      out.preset = next;
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      out.version = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function readVersion() {
  const packageJsonPath = resolve(fileURLToPath(import.meta.url), '..', 'package.json');
  const raw = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return raw.version || '0.0.0';
}

function printHelp() {
  console.log(`\nUsage:
  node index.js [options]
  npm run start -- [options]

Options:
  --preset <name>    Run a configured preset
  --help, -h         Show this help message
  --version, -v      Show version\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let cliOptions;
  try {
    cliOptions = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  }

  if (cliOptions.help) {
    printHelp();
    process.exit(0);
  }
  if (cliOptions.version) {
    console.log(readVersion());
    process.exit(0);
  }

  run(cliOptions);
}

export { parseCliArgs };
