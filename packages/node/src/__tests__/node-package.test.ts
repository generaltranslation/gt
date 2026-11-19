import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const rootArtifacts = [
  'index.cjs',
  'index.mjs',
  'index.d.cts',
  'index.d.mts',
].map((artifact) => join(packageRoot, 'dist', artifact));

function buildPackage(): void {
  // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
  // a native binary (mise-installed pnpm on CI, runnable directly).
  const npmExecpath = process.env.npm_execpath;
  const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
  const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
  const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];

  execFileSync(command, args, { cwd: packageRoot, stdio: 'pipe' });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

describe('gt-node package exports', () => {
  beforeAll(() => {
    if (rootArtifacts.every((artifact) => existsSync(artifact))) return;
    buildPackage();
  }, 60_000);

  it('loads gt-node from the built CJS entrypoint', () => {
    node([
      '-e',
      `
        const assert = require('node:assert/strict');
        const gtNode = require('gt-node');

        // No t or m: getGT() and getMessages() load the withGT() locale first.
        assert.equal(gtNode.t, undefined);
        assert.equal(gtNode.m, undefined);
        assert.equal(typeof gtNode.getGT, 'function');
        assert.equal(typeof gtNode.tx, 'function');
        assert.equal(typeof gtNode.dyn, 'function');
        assert.equal(typeof gtNode.plural, 'function');
        assert.equal(typeof gtNode.time, 'function');
        assert.equal(typeof gtNode.getMessages, 'function');
        assert.equal(typeof gtNode.msg, 'function');
      `,
    ]);
  });

  it('loads gt-node from the built ESM entrypoint', () => {
    node([
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { derive, getGT, getMessages, mFallback, msg, tx } from 'gt-node';

        assert.equal(typeof getGT, 'function');
        assert.equal(typeof tx, 'function');
        assert.equal(typeof derive, 'function');
        assert.equal(typeof getMessages, 'function');
        assert.equal(typeof msg, 'function');
        assert.equal(typeof mFallback, 'function');
      `,
    ]);
  });
});
