import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const builtArtifacts = [
  'index.client.js',
  'index.rsc.js',
  'index.server.js',
].map((artifact) => join(packageRoot, 'dist', artifact));

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build:no-swc-plugin']
    : ['run', 'build:no-swc-plugin'];

  execFileSync(command, args, { cwd: packageRoot, stdio: 'pipe' });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

describe('gt-next package exports', () => {
  beforeAll(() => {
    if (builtArtifacts.every((artifact) => existsSync(artifact))) return;
    buildPackage();
  });

  it('resolves gt-next to the RSC implementation under react-server', () => {
    node([
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-next').endsWith('/dist/index.rsc.js'),
            true
          );
        `,
    ]);
  });

  it('resolves gt-next to the client implementation when browser and react-server are active', () => {
    node([
      '--conditions=browser',
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-next').endsWith('/dist/index.client.js'),
            true
          );
        `,
    ]);
  });
});
