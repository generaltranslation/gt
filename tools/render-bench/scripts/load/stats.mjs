import { execFileSync } from 'node:child_process';
import { cpus, platform, release, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/** The median of the samples with their count and spread. */
export function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const round = (value) => Math.round(value * 100) / 100;
  return {
    n: sorted.length,
    median: round(quantile(sorted, 0.5)),
    p25: round(quantile(sorted, 0.25)),
    p75: round(quantile(sorted, 0.75)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
  };
}

/** Where a run was measured. */
export function environment() {
  const git = (...args) =>
    execFileSync('git', args, { cwd: here, encoding: 'utf8' }).trim();
  return {
    sha:
      git('rev-parse', '--short', 'HEAD') +
      (git('status', '--porcelain', '--', '../../../../packages')
        ? '-dirty'
        : ''),
    date: new Date().toISOString(),
    machine: `${cpus()[0].model}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB`,
    os: `${platform()} ${release()}`,
    node: process.version,
    // What the GT packages were built from, when it is not `sha`.
    ...(process.env.BENCH_PACKAGES
      ? { packages: process.env.BENCH_PACKAGES }
      : {}),
  };
}
