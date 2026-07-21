import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const builtArtifacts = [
  'index.client.mjs',
  'index.server.mjs',
  'server.mjs',
].map((artifact) => join(packageRoot, 'dist', artifact));

function hasBuiltArtifacts(): boolean {
  return builtArtifacts.every((artifact) => existsSync(artifact));
}

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

describe('gt-tanstack-start package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  }, 60_000);

  it('publishes ESM-only entrypoints', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as {
      main: string;
      module: string;
      types: string;
      exports: Record<string, unknown>;
    };

    expect(packageJson.main).toBe('./dist/index.server.mjs');
    expect(packageJson.module).toBe('./dist/index.server.mjs');
    expect(packageJson.types).toBe('./dist/index.server.d.mts');
    expect(JSON.stringify(packageJson.exports)).not.toContain('require');

    expect(
      readdirSync(join(packageRoot, 'dist'))
        .filter((file) => /\.(cjs|mjs)$/.test(file))
        .sort()
    ).toEqual(['index.client.mjs', 'index.server.mjs', 'server.mjs']);
  });

  it('loads the main and server ESM entrypoints', () => {
    node([
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import { GTProvider, parseLocale } from 'gt-tanstack-start';
        import { getGT, getLocale, gtMiddleware } from 'gt-tanstack-start/server';

        assert.equal(typeof GTProvider, 'function');
        assert.equal(typeof parseLocale, 'function');
        assert.equal(typeof getGT, 'function');
        assert.equal(typeof getLocale, 'function');
        assert.equal(typeof gtMiddleware, 'object');
      `,
    ]);
  });
});
