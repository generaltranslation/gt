import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeArtifactNames = [
  'index.rsc.cjs',
  'index.rsc.mjs',
  'index.client.cjs',
  'index.client.mjs',
  'index.server.cjs',
  'index.server.mjs',
  'macros.cjs',
  'macros.mjs',
  'unstable.cjs',
  'unstable.mjs',
  'unstable.rsc.cjs',
  'unstable.rsc.mjs',
].sort();
const builtArtifacts = runtimeArtifactNames.map((artifact) =>
  join(packageRoot, 'dist', artifact)
);

function hasBuiltArtifacts(): boolean {
  return builtArtifacts.every((artifact) => existsSync(artifact));
}

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

function isAllowedExternalizedSubpath(
  file: string,
  specifier: string
): boolean {
  return (
    (file.startsWith('index.') || file.startsWith('unstable')) &&
    (specifier.startsWith('@generaltranslation/react-core/') ||
      specifier.startsWith('gt-i18n/'))
  );
}

describe('gt-react package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  // One Node process per condition set: CJS is loaded with require() and ESM
  // with import() from the same script.
  it('loads named exports and server-only guards from built CJS and ESM entrypoints', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');

          (async () => {
            for (const [format, react] of [
              ['cjs', require('gt-react')],
              ['esm', await import('gt-react')],
            ]) {
              for (const name of [
                'GTProvider',
                'T',
                'parseLocale',
                'GtInternalVar',
                'GtInternalRuntimeTranslateString',
                'initializeGTSPA',
                'createOrUpdateBrowserConditionStore',
              ]) {
                assert.equal(typeof react[name], 'function', format + ' ' + name);
              }
              await assert.rejects(
                () => react.initializeGTSPA({}),
                /server runtime entry point/,
                format
              );
              assert.throws(
                () => react.createOrUpdateBrowserConditionStore({}),
                /server runtime entry point/,
                format
              );
            }
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
        `,
    ]);
  });

  it('exports the condition-store factory from the browser entrypoint', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { createOrUpdateBrowserConditionStore } from 'gt-react';

          assert.equal(typeof createOrUpdateBrowserConditionStore, 'function');
        `,
    ]);
  });

  it.each(['workerd', 'worker'])(
    'resolves server entrypoints when %s and browser conditions are active',
    (workerCondition) => {
      node([
        `--conditions=${workerCondition}`,
        '--conditions=browser',
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { createRequire } from 'node:module';

          assert.match(
            createRequire(import.meta.url).resolve('gt-react'),
            /\\/dist\\/index\\.server\\.cjs$/
          );
          assert.match(
            import.meta.resolve('gt-react'),
            /\\/dist\\/index\\.server\\.mjs$/
          );
        `,
      ]);
    }
  );

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

  it('prefers the RSC implementation over worker and browser conditions', () => {
    node([
      '--conditions=react-server',
      '--conditions=workerd',
      '--conditions=worker',
      '--conditions=browser',
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

  it('resolves gt-react/unstable with the same conditions as the root entry', () => {
    const resolve = (conditions: string[]) =>
      execFileSync(
        process.execPath,
        [
          ...conditions.map((condition) => `--conditions=${condition}`),
          '--input-type=module',
          '-e',
          "process.stdout.write(import.meta.resolve('gt-react/unstable'))",
        ],
        { cwd: packageRoot }
      )
        .toString()
        .replace(/^.*\/dist\//, '');

    expect(resolve([])).toBe('unstable.mjs');
    expect(resolve(['browser'])).toBe('unstable.mjs');
    expect(resolve(['workerd', 'browser'])).toBe('unstable.mjs');
    expect(resolve(['react-server', 'worker', 'browser'])).toBe(
      'unstable.rsc.mjs'
    );
  });

  it('loads the gt-react/unstable client and RSC surfaces', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const client = require('gt-react/unstable');
          const rsc = require('./dist/unstable.rsc.cjs');
          const core = require('@generaltranslation/react-core/unstable');

          // gt-react-native/unstable is checked against the same surface.
          assert.deepEqual(Object.keys(client).sort(), Object.keys(core).sort());
          // t is client-rendered (SPA) only, so server components lack it.
          assert.deepEqual(
            Object.keys(client).filter((name) => name !== 't').sort(),
            Object.keys(rsc).sort()
          );
          assert.equal(typeof client.useGT, 'function');
          assert.equal(typeof client.t, 'function');
          assert.equal(rsc.t, undefined);
          assert.notEqual(client.useGT, rsc.useGT);
          assert.equal(typeof client.useMessages, 'function');
          assert.notEqual(client.useMessages, rsc.useMessages);
          assert.equal(client.msg, rsc.msg);
        `,
    ]);
  });

  it('preserves use client in emitted client entrypoints', () => {
    for (const file of [
      'dist/index.client.cjs',
      'dist/index.client.mjs',
      'dist/index.server.cjs',
      'dist/index.server.mjs',
      'dist/unstable.cjs',
      'dist/unstable.mjs',
    ]) {
      expect(readFileSync(join(packageRoot, file), 'utf8')).toMatch(
        /^['"]use client['"];?/
      );
    }
  });

  it('keeps the dev-only localStorage cache out of the initial client entrypoint', () => {
    const runtimeArtifacts = readdirSync(join(packageRoot, 'dist')).filter(
      (file) => /\.(cjs|mjs)$/.test(file)
    );
    expect(runtimeArtifacts).toEqual(
      expect.arrayContaining(runtimeArtifactNames)
    );

    const clientEntries = ['dist/index.client.cjs', 'dist/index.client.mjs'];
    for (const file of clientEntries) {
      expect(readFileSync(join(packageRoot, file), 'utf8')).not.toContain(
        'gt:tx:'
      );
    }

    const cacheChunks = runtimeArtifacts.filter((file) =>
      file.startsWith('LocalStorageTranslationCache-')
    );
    expect(cacheChunks).toHaveLength(2);
    for (const file of cacheChunks) {
      expect(readFileSync(join(packageRoot, 'dist', file), 'utf8')).toContain(
        'gt:tx:'
      );
    }
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
