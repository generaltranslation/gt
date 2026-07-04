#!/usr/bin/env node
// Import the built `gt-next/config` entry the way a real next.config does:
// plain Node, no bundler. Catches module-evaluation-time regressions the
// bundled test apps can't (e.g. bare `require`/`__dirname` in the ESM build,
// exports-map paths pointing at files that don't exist).
import { createRequire } from 'node:module';

const failures = [];

try {
  const esm = await import('gt-next/config');
  if (typeof esm.withGTConfig !== 'function') {
    failures.push('ESM: withGTConfig is not a function');
  }
} catch (error) {
  failures.push(`ESM: import('gt-next/config') threw: ${error}`);
}

try {
  const require = createRequire(import.meta.url);
  const cjs = require('gt-next/config');
  if (typeof cjs.withGTConfig !== 'function') {
    failures.push('CJS: withGTConfig is not a function');
  }
} catch (error) {
  failures.push(`CJS: require('gt-next/config') threw: ${error}`);
}

if (failures.length > 0) {
  console.error('gt-next smoke test failed:');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.warn('gt-next smoke test passed (ESM + CJS config entry)');
