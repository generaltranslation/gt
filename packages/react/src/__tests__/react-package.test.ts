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
  'compat.rsc.cjs',
  'compat.rsc.mjs',
  'compat.client.cjs',
  'compat.client.mjs',
  'compat.server.cjs',
  'compat.server.mjs',
  'chunk-translations.cjs',
  'chunk-translations.mjs',
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
  // Entries keep shared React context and singletons external.
  return (
    (/^(?:index|compat|client-entry)\./.test(file) &&
      (specifier.startsWith('@generaltranslation/react-core/') ||
        specifier.startsWith('gt-i18n/'))) ||
    // chunk-translations shares gt-react's stores, and bundles nothing the
    // app's bundle already holds for gt-i18n
    (file.startsWith('chunk-translations.') &&
      (specifier.startsWith('@generaltranslation/react-core/') ||
        specifier === 'generaltranslation/diagnostics'))
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
                'GtInternalRuntimeTranslateJsx',
                'initializeGTSPA',
                'createOrUpdateBrowserConditionStore',
              ]) {
                assert.equal(typeof react[name], 'function', format + ' ' + name);
              }
              // t and m are client-rendered (SPA) only, so the server entry lacks them.
              assert.equal('t' in react, false, format);
              assert.equal('m' in react, false, format);
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

  it('exports the condition-store factory, t and m from the browser entrypoint', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { createOrUpdateBrowserConditionStore, t, m } from 'gt-react';

          assert.equal(typeof createOrUpdateBrowserConditionStore, 'function');
          assert.equal(typeof t, 'function');
          assert.equal(typeof m, 'function');
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

  it('prefers the RSC implementation, which lacks t and m, over worker and browser conditions', () => {
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
          assert.equal('t' in require('gt-react'), false);
          assert.equal('m' in require('gt-react'), false);
        `,
    ]);
  });

  it('exposes the message API on the client, server and RSC entries', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const client = require('./dist/index.client.cjs');
          const server = require('./dist/index.server.cjs');
          const rsc = require('./dist/index.rsc.cjs');
          const pure = require('@generaltranslation/react-core/pure');
          const hooks = require('@generaltranslation/react-core/hooks');
          const i18n = require('gt-i18n');

          for (const [entryName, entry] of Object.entries({ client, server, rsc })) {
            for (const name of [
              'msg', 'mFallback', 'derive', 'plural', 'ordinal', 'select',
              'num', 'date', 'time', 'part', 'n',
            ]) {
              assert.equal(entry[name], i18n[name], entryName + ' ' + name);
            }
            for (const name of [
              'decodeMsg', 'decodeOptions', 'gtFallback', 'declareVar',
              'decodeVars', 'GtInternalRuntimeTranslateString',
            ]) {
              assert.equal(name in entry, false, entryName + ' ' + name);
            }
          }

          // t and m are client-rendered (SPA) only, and they are react-core's
          // guarded ones, not gt-i18n's.
          assert.equal(client.t, pure.t);
          assert.equal(client.m, pure.m);
          assert.deepEqual(
            Object.keys(client).filter((name) => name !== 't' && name !== 'm').sort(),
            Object.keys(server).sort()
          );
          assert.equal('t' in rsc, false);
          assert.equal('m' in rsc, false);

          for (const name of ['useGT', 'useMessages']) {
            assert.equal(client[name], hooks[name], name);
            assert.equal(server[name], hooks[name], name);
            // Server components load the request locale instead of reading context.
            assert.equal(typeof rsc[name], 'function', name);
            assert.notEqual(rsc[name], hooks[name], name);
          }
        `,
    ]);
  });

  it.each([
    [[], 'compat.server'],
    [['--conditions=browser'], 'compat.client'],
    [['--conditions=workerd', '--conditions=browser'], 'compat.server'],
    [['--conditions=react-server', '--conditions=browser'], 'compat.rsc'],
  ])('resolves gt-react/compat with %j to %s', (conditions, file) => {
    node([
      ...conditions,
      '-e',
      `
          const assert = require('node:assert/strict');
          assert.equal(
            require.resolve('gt-react/compat').endsWith(${JSON.stringify(`/dist/${file}.cjs`)}),
            true
          );
        `,
    ]);
  });

  it('loads the dictionary API from built ESM compat entrypoints', () => {
    for (const conditions of [[], ['--conditions=browser']]) {
      node([
        ...conditions,
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import * as compat from 'gt-react/compat';
          import * as react from 'gt-react';

          assert.equal(typeof compat.GTProvider, 'function');
          assert.equal(typeof compat.useTranslations, 'function');
          assert.equal(typeof compat.initializeGTDictionary, 'function');
          assert.equal('useTranslations' in react, false);
        `,
      ]);
    }
  });

  it('preserves use client in emitted client entrypoints', () => {
    for (const file of [
      'dist/index.client.cjs',
      'dist/index.client.mjs',
      'dist/index.server.cjs',
      'dist/index.server.mjs',
      'dist/compat.client.cjs',
      'dist/compat.client.mjs',
      'dist/compat.server.cjs',
      'dist/compat.server.mjs',
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
