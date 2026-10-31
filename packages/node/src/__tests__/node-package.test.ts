import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const unstableArtifacts = [
  'unstable.cjs',
  'unstable.mjs',
  'unstable.d.cts',
  'unstable.d.mts',
].map((artifact) => join(packageRoot, 'dist', artifact));

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, { cwd: packageRoot, stdio: 'pipe' });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

describe('gt-node package exports', () => {
  beforeAll(() => {
    if (unstableArtifacts.every((artifact) => existsSync(artifact))) return;
    buildPackage();
  }, 60_000);

  it('loads gt-node/unstable from the built CJS entrypoint', () => {
    node([
      '-e',
      `
        const assert = require('node:assert/strict');
        const unstable = require('gt-node/unstable');

        assert.equal(typeof unstable.t, 'function');
        assert.equal(typeof unstable.getGT, 'function');
        assert.equal(typeof unstable.plural, 'function');
      `,
    ]);
  });

  it('loads gt-node/unstable from the built ESM entrypoint', () => {
    node([
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { derive, getGT, t } from 'gt-node/unstable';

        assert.equal(typeof t, 'function');
        assert.equal(typeof getGT, 'function');
        assert.equal(typeof derive, 'function');
      `,
    ]);
  });
});
