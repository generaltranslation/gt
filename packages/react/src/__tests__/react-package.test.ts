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
    file.startsWith('index.') &&
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

          assert.equal(typeof react.GTProvider, 'function');
          assert.equal(typeof react.T, 'function');
          assert.equal(typeof react.parseLocale, 'function');
          assert.equal(typeof react.GtInternalVar, 'function');
          assert.equal(typeof react.GtInternalRuntimeTranslateString, 'function');
        `,
    ]);
  });

  it('throws when initializeGTSPA is called from the server entrypoint', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const react = require('gt-react');

          assert.equal(typeof react.initializeGTSPA, 'function');
          (async () => {
            await assert.rejects(
              () => react.initializeGTSPA({}),
              /server runtime entry point/
            );
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
        `,
    ]);
  });

  it('loads named exports from built ESM entrypoints', () => {
    node([
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { GTProvider, GtInternalRuntimeTranslateString, GtInternalVar, parseLocale, T } from 'gt-react';

          assert.equal(typeof GTProvider, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof parseLocale, 'function');
          assert.equal(typeof GtInternalVar, 'function');
          assert.equal(typeof GtInternalRuntimeTranslateString, 'function');
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

  it('throws when the condition-store factory is called from the server entrypoint', () => {
    node([
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { createOrUpdateBrowserConditionStore } from 'gt-react';

          assert.throws(
            () => createOrUpdateBrowserConditionStore({}),
            /server runtime entry point/
          );
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

  it('preserves use client in emitted client entrypoints', () => {
    for (const file of [
      'dist/index.client.cjs',
      'dist/index.client.mjs',
      'dist/index.server.cjs',
      'dist/index.server.mjs',
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
