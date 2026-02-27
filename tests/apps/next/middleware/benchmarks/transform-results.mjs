#!/usr/bin/env node
/**
 * Transforms vitest bench JSON and Playwright E2E performance JSON
 * into github-action-benchmark's customSmallerIsBetter format.
 *
 * Usage:
 *   node transform-results.mjs \
 *     --unit results/unit-latest.json \
 *     --e2e results/e2e-latest.json \
 *     --output results/benchmark-results.json \
 *     --package gt-next \
 *     --version 1.2.3
 */
import { readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[++i];
    }
  }
  const required = ['package', 'version', 'output'];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Missing required flag: --${key}`);
      process.exit(1);
    }
  }
  if (!args.unit && !args.e2e) {
    console.error('At least one of --unit or --e2e must be provided');
    process.exit(1);
  }
  return args;
}

/**
 * Normalize vitest bench --outputJson format.
 * Structure: { files: [{ groups: [{ fullName, benchmarks: [{ name, mean, sd, ... }] }] }] }
 */
function normalizeVitestBench(json) {
  const results = [];
  for (const file of json.files) {
    for (const group of file.groups) {
      // Strip file path prefix from fullName (e.g. "benchmarks/foo.bench.ts > group name" -> "group name")
      const groupName = group.fullName.includes(' > ')
        ? group.fullName.split(' > ').slice(1).join(' > ')
        : group.fullName;

      for (const bench of group.benchmarks) {
        results.push({
          name: `unit > ${groupName} > ${bench.name} (mean)`,
          unit: 'ms',
          value: bench.mean,
          range: `\u00b1${bench.sd.toFixed(4)}`,
        });
      }
    }
  }
  return results;
}

/**
 * Normalize Playwright E2E performance JSON.
 * Structure: { "test-name": { metric: number, ... }, ... }
 */
function normalizeE2EResults(json) {
  const results = [];
  for (const [testName, metrics] of Object.entries(json)) {
    for (const [metric, value] of Object.entries(metrics)) {
      if (typeof value !== 'number') continue;
      results.push({
        name: `e2e > ${testName} > ${metric}`,
        unit: 'ms',
        value,
      });
    }
  }
  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const extra = `${args.package}@${args.version}`;
  const results = [];

  if (args.unit) {
    if (!existsSync(args.unit)) {
      console.error(`Unit results file not found: ${args.unit}`);
      process.exit(1);
    }
    const unitJson = JSON.parse(readFileSync(args.unit, 'utf-8'));
    for (const entry of normalizeVitestBench(unitJson)) {
      results.push({ ...entry, extra });
    }
  }

  if (args.e2e) {
    if (!existsSync(args.e2e)) {
      console.error(`E2E results file not found: ${args.e2e}`);
      process.exit(1);
    }
    const e2eJson = JSON.parse(readFileSync(args.e2e, 'utf-8'));
    for (const entry of normalizeE2EResults(e2eJson)) {
      results.push({ ...entry, extra });
    }
  }

  writeFileSync(args.output, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} benchmark entries to ${args.output}`);
}

main();
