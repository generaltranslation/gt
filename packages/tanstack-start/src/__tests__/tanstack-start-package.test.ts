import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const builtArtifacts = [
  'index.client.cjs',
  'index.server.cjs',
  'index.types.d.cts',
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

describe('gt-tanstack-start package exports', () => {
  beforeAll(() => {
    if (builtArtifacts.every((artifact) => existsSync(artifact))) return;
    buildPackage();
  });

  it('resolves gt-tanstack-start to the server implementation under react-server', () => {
    node([
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-tanstack-start').endsWith('/dist/index.server.cjs'),
            true
          );
        `,
    ]);
  });

  it('resolves gt-tanstack-start to the client implementation when browser and react-server are active', () => {
    node([
      '--conditions=browser',
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-tanstack-start').endsWith('/dist/index.client.cjs'),
            true
          );
        `,
    ]);
  });
});
