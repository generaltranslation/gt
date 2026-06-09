import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url))))
);
const runtimeArtifactNames = [
  'browser.cjs',
  'browser.mjs',
  'client.cjs',
  'client.mjs',
  'context-rsc.cjs',
  'context-rsc.mjs',
  'context.client.cjs',
  'context.client.mjs',
  'context.rsc.cjs',
  'context.rsc.mjs',
  'context.server.cjs',
  'context.server.mjs',
  'context.types.cjs',
  'context.types.mjs',
  'index.cjs',
  'index.mjs',
  'internal.cjs',
  'internal.mjs',
  'macros.cjs',
  'macros.mjs',
].sort();
const builtArtifacts = runtimeArtifactNames.map((artifact) =>
  join(packageRoot, 'dist', artifact)
);

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

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

function isAllowedExternalizedSubpath(
  file: string,
  specifier: string
): boolean {
  return (
    file.startsWith('context') &&
    (specifier.startsWith('@generaltranslation/react-core/') ||
      specifier.startsWith('gt-i18n/'))
  );
}

describe('gt-react package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  it('loads named exports from built CJS entrypoints', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const react = require('gt-react');
          const client = require('gt-react/client');
          const context = require('gt-react/context');
          const internal = require('gt-react/internal');

          assert.equal(typeof react.GTProvider, 'function');
          assert.equal(typeof react.T, 'function');
          assert.equal(typeof client.ClientProvider, 'function');
          assert.equal(typeof context.GTProvider, 'function');
          assert.equal(typeof context.T, 'function');
          assert.equal(typeof internal.renderDefaultChildren, 'function');
        `,
    ]);
  });

  it('loads named exports from built ESM entrypoints', () => {
    node([
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { GTProvider, T } from 'gt-react';
          import { ClientProvider } from 'gt-react/client';
          import { GTProvider as ContextProvider, T as ContextT } from 'gt-react/context';
          import { renderDefaultChildren } from 'gt-react/internal';

          assert.equal(typeof GTProvider, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof ClientProvider, 'function');
          assert.equal(typeof ContextProvider, 'function');
          assert.equal(typeof ContextT, 'function');
          assert.equal(typeof renderDefaultChildren, 'function');
        `,
    ]);
  });

  it('loads side-effect entrypoints without default-export interop', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');

          assert.equal(globalThis.t, undefined);
          require('gt-react/macros');
          assert.equal(typeof globalThis.t, 'function');
        `,
    ]);
  });

  it('resolves the RSC-safe context implementation under react-server', () => {
    node([
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          const context = require('gt-react/context');

          assert.equal(typeof context.msg('Hello, world'), 'string');
          assert.equal(typeof context.T, 'function');
          assert.equal(typeof context.LocaleSelector, 'function');
          assert.throws(
            () => context.useGT(),
            /cannot be used in a React Server Component/
          );
        `,
    ]);
  });

  it('preserves use client in emitted client-capable entrypoints', () => {
    for (const file of [
      'dist/client.cjs',
      'dist/client.mjs',
      'dist/context.client.cjs',
      'dist/context.client.mjs',
      'dist/context.server.cjs',
      'dist/context.server.mjs',
    ]) {
      expect(readFileSync(join(packageRoot, file), 'utf8')).toMatch(
        /^['"]use client['"];?/
      );
    }
  });

  it('emits independent runtime entrypoints without shared chunks', () => {
    expect(
      readdirSync(join(packageRoot, 'dist'))
        .filter((file) => /\.(cjs|mjs)$/.test(file))
        .sort()
    ).toEqual(runtimeArtifactNames);
  });

  it('bundles workspace subpath imports in runtime artifacts', () => {
    const workspaceSubpathImportPattern =
      /(?:(?:import|export)\s+(?:[^"']+\s+from\s+)?|require\(\s*)["']((?:@generaltranslation\/format|@generaltranslation\/react-core|generaltranslation|gt-i18n)\/[^"']+)["']/g;
    const externalizedSubpaths = readdirSync(join(packageRoot, 'dist'))
      .filter((file) => /\.(cjs|mjs)$/.test(file))
      .flatMap((file) => {
        const code = readFileSync(join(packageRoot, 'dist', file), 'utf8');
        return [...code.matchAll(workspaceSubpathImportPattern)].map(
          (match) => `${file}: ${match[1]}`
        );
      })
      .filter((externalizedSubpath) => {
        const [file, specifier] = externalizedSubpath.split(': ');
        return !isAllowedExternalizedSubpath(file, specifier);
      });

    expect(externalizedSubpaths).toEqual([]);
  });
});
