#!/usr/bin/env node

// Manual bin release with a guaranteed manifest restore: bin:prep mutates
// package.json, so bin:restore must run even when a middle step fails.
// CI inlines the same sequence in release.yml; keep the two in sync.
//
// Run from the CLI package directory (packages/cli or packages/gtx-cli):
//   node ../../scripts/release-bin.mjs

import { spawnSync } from 'child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

const prepStatus = run('pnpm', ['run', 'bin:prep']);
if (prepStatus !== 0) {
  process.exit(prepStatus);
}

let status = 0;
const steps = [
  ['pnpm', ['run', 'build:bin:clean']],
  ['node', ['../../scripts/platform-packages.mjs', 'generate']],
  ['node', ['../../scripts/platform-packages.mjs', 'publish']],
  ['pnpm', ['publish', '--tag', 'bin', '--no-git-checks']],
];
for (const [command, args] of steps) {
  status = run(command, args);
  if (status !== 0) {
    break;
  }
}

// Restore the manifest no matter what happened above
const restoreStatus = run('pnpm', ['run', 'bin:restore']);
if (status === 0 && restoreStatus === 0) {
  status = run('pnpm', ['run', 'build:clean']);
} else if (status === 0) {
  status = restoreStatus;
}
process.exit(status);
