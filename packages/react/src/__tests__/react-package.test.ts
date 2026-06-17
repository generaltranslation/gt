import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeArtifactNames = [
  'browser.cjs',
  'browser.mjs',
  'client.cjs',
  'client.mjs',
  'context.rsc.cjs',
  'context.rsc.mjs',
  'context.client.cjs',
  'context.client.mjs',
  'context.server.cjs',
  'context.server.mjs',
  'context.types.cjs',
  'context.types.mjs',
  'index.rsc.cjs',
  'index.rsc.mjs',
  'index.client.cjs',
  'index.client.mjs',
  'index.server.cjs',
  'index.server.mjs',
  'index.types.cjs',
  'index.types.mjs',
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
    (file.startsWith('index.') || file.startsWith('context')) &&
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
          assert.equal(typeof react.GtInternalVar, 'function');
          assert.equal(typeof react.GtInternalRuntimeTranslateString, 'function');
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
          import { GTProvider, GtInternalRuntimeTranslateString, GtInternalVar, T } from 'gt-react';
          import { ClientProvider } from 'gt-react/client';
          import {
            GTProvider as ContextProvider,
            T as ContextT
          } from 'gt-react/context';
          import { renderDefaultChildren } from 'gt-react/internal';

          assert.equal(typeof GTProvider, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof GtInternalVar, 'function');
          assert.equal(typeof GtInternalRuntimeTranslateString, 'function');
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
          const clientPath = require.resolve('./dist/index.client.cjs');

          assert.equal(globalThis.t, undefined);
          require('gt-react/macros');
          assert.equal(typeof globalThis.t, 'function');
          assert.equal(require.cache[clientPath], undefined);
        `,
    ]);
  });

  it('keeps macros independent from the client entrypoint', () => {
    for (const file of ['dist/macros.cjs', 'dist/macros.mjs']) {
      expect(readFileSync(join(packageRoot, file), 'utf8')).not.toContain(
        'index.client'
      );
    }
  });

  it('resolves gt-react to the RSC implementation under react-server', () => {
    node([
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-react').endsWith('/dist/index.rsc.cjs'),
            true
          );
        `,
    ]);
  });

  it('resolves gt-react/context to the RSC implementation under react-server', () => {
    node([
      '--conditions=react-server',
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-react/context').endsWith('/dist/context.rsc.cjs'),
            true
          );
        `,
    ]);
  });

  it('preserves use client in emitted client entrypoints', () => {
    for (const file of [
      'dist/client.cjs',
      'dist/client.mjs',
      'dist/context.client.cjs',
      'dist/context.client.mjs',
      'dist/context.server.cjs',
      'dist/context.server.mjs',
      'dist/index.client.cjs',
      'dist/index.client.mjs',
      'dist/index.server.cjs',
      'dist/index.server.mjs',
      'dist/index.types.cjs',
      'dist/index.types.mjs',
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
