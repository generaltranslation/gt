import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const builtArtifacts = [
  'dist/index.cjs',
  'dist/index.mjs',
  'dist/client.cjs',
  'dist/client.mjs',
  'dist/internal.cjs',
  'dist/internal.mjs',
  'dist/macros.cjs',
  'dist/macros.mjs',
].map((artifact) => join(packageRoot, artifact));

function hasBuiltArtifacts(): boolean {
  return builtArtifacts.every((artifact) => existsSync(artifact));
}

function buildPackage(): void {
  if (process.env.npm_execpath) {
    execFileSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
      cwd: packageRoot,
      stdio: 'pipe',
    });
    return;
  }
  execFileSync('pnpm', ['run', 'build'], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

describe('gt-react package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  it('loads named exports from built CJS entrypoints', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
          const assert = require('node:assert/strict');

          const react = require('gt-react');
          const client = require('gt-react/client');
          const internal = require('gt-react/internal');

          assert.equal(typeof react.GTProvider, 'function');
          assert.equal(typeof react.T, 'function');
          assert.equal(typeof client.ClientProvider, 'function');
          assert.equal(typeof internal.renderDefaultChildren, 'function');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('loads named exports from built ESM entrypoints', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { GTProvider, T } from 'gt-react';
          import { ClientProvider } from 'gt-react/client';
          import { renderDefaultChildren } from 'gt-react/internal';

          assert.equal(typeof GTProvider, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof ClientProvider, 'function');
          assert.equal(typeof renderDefaultChildren, 'function');
        `,
      ],
      { stdio: 'pipe' }
    );
  });

  it('loads side-effect entrypoints without default-export interop', () => {
    execFileSync(
      process.execPath,
      [
        '-e',
        `
          const assert = require('node:assert/strict');

          assert.equal(globalThis.t, undefined);
          require('gt-react/macros');
          assert.equal(typeof globalThis.t, 'function');
        `,
      ],
      { stdio: 'pipe' }
    );
  });
});
