import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeArtifactNames = [
  'internal.cjs',
  'internal.mjs',
  'index.rsc.cjs',
  'index.rsc.mjs',
  'index.client.cjs',
  'index.client.mjs',
  'index.server.cjs',
  'index.server.mjs',
  'macros.cjs',
  'macros.mjs',
].sort();
const builtArtifacts = [
  ...runtimeArtifactNames,
  'prod/internal.cjs',
  'prod/internal.mjs',
  'prod/index.client.prod.cjs',
  'prod/index.client.prod.mjs',
].map((artifact) => join(packageRoot, 'dist', artifact));

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
  if (file.startsWith('internal.')) {
    return specifier === '@generaltranslation/react-core/pure';
  }
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
          const internal = require('gt-react/internal');

          assert.equal(typeof react.GTProvider, 'function');
          assert.equal(typeof react.T, 'function');
          assert.equal(typeof react.parseLocale, 'function');
          assert.equal(typeof react.GtInternalVar, 'function');
          assert.equal(typeof react.GtInternalRuntimeTranslateString, 'function');
          assert.equal(react.getSnapshotGT, undefined);
          assert.equal(typeof internal.snapshotRuntime.getGT, 'function');
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

  it('selects production and development browser artifacts', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';

          assert.equal(
            import.meta.resolve('gt-react').endsWith('/dist/prod/index.client.prod.mjs'),
            true
          );
          assert.equal(
            import.meta.resolve('gt-react/internal').endsWith('/dist/prod/internal.mjs'),
            true
          );
          assert.equal(
            import.meta.resolve('gt-i18n/internal').endsWith('/dist/internal-static.mjs'),
            true
          );
        `,
    ]);
    node([
      '--conditions=browser',
      '--conditions=development',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';

          assert.equal(
            import.meta.resolve('gt-react').endsWith('/dist/index.client.mjs'),
            true
          );
          assert.equal(
            import.meta.resolve('gt-react/internal').endsWith('/dist/internal.mjs'),
            true
          );
          assert.equal(
            import.meta.resolve('gt-i18n/internal').endsWith('/dist/internal.mjs'),
            true
          );
        `,
    ]);
  });

  it('uses locale-only configuration in production browser builds', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { I18nConfig } from 'gt-i18n/internal';

          const config = new I18nConfig({
            defaultLocale: 'en',
            locales: ['en', 'fr'],
            projectId: 'test-project',
          });

          assert.equal(config.resolveSupportedLocale('fr-FR'), 'fr');
          assert.equal(config.isDevHotReloadEnabled(), false);
          assert.throws(() => config.getGTClass(), /not available in production browser builds/);
        `,
    ]);
    node([
      '--conditions=browser',
      '--conditions=development',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { I18nConfig } from 'gt-i18n/internal';

          const config = new I18nConfig({ defaultLocale: 'en' });
          assert.equal(typeof config.getGTClass().translateMany, 'function');
        `,
    ]);
  });

  it('translates from the production SPA snapshot without initializing a cache', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { getReactI18nCache, initializeGTSPA, t } from 'gt-react';
          import { createLookupOptions, hashMessage } from 'gt-i18n/internal';

          Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: { languages: [] },
          });
          const message = 'Hello';
          const lookupOptions = createLookupOptions('fr', {}, 'ICU');
          const hash = hashMessage(message, lookupOptions);

          await initializeGTSPA({
            defaultLocale: 'en',
            locales: ['fr'],
            locale: 'fr',
            _getLocale: () => 'fr',
            loadTranslations: async (locale) => {
              assert.equal(locale, 'fr');
              return { [hash]: 'Bonjour' };
            },
          });

          assert.equal(t(message), 'Bonjour');
          assert.throws(
            () => getReactI18nCache(),
            /not available in production browser builds/
          );
        `,
    ]);
  });

  it('translates from a production provider snapshot without initializing a cache', () => {
    node([
      '--conditions=browser',
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { createElement } from 'react';
          import { renderToStaticMarkup } from 'react-dom/server';
          import { GTProvider, initializeGT, t, useGT } from 'gt-react';
          import { snapshotRuntime } from 'gt-react/internal';
          import { createLookupOptions, hashMessage } from 'gt-i18n/internal';

          Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: { languages: [] },
          });
          const message = 'Hello';
          const lookupOptions = createLookupOptions('fr', {}, 'ICU');
          const hash = hashMessage(message, lookupOptions);

          initializeGT({
            defaultLocale: 'en',
            locales: ['en', 'fr'],
          });

          function Child() {
            const gt = useGT();
            return createElement('span', null, gt(message), ' / ', t(message));
          }

          const html = renderToStaticMarkup(
            createElement(
              GTProvider,
              {
                locale: 'fr',
                _getLocale: () => 'fr',
                translations: { fr: { [hash]: 'Bonjour' } },
              },
              createElement(Child)
            )
          );
          const snapshotGT = await snapshotRuntime.getGT();

          assert.equal(html, '<span>Bonjour / Bonjour</span>');
          assert.equal(snapshotGT(message), 'Bonjour');
        `,
    ]);
  });

  it.each(['workerd', 'worker'])(
    'resolves server entrypoints when %s and browser conditions are active',
    (workerCondition) => {
      node([
        `--conditions=${workerCondition}`,
        '--conditions=browser',
        '-e',
        `
          const assert = require('node:assert/strict');

          assert.equal(
            require.resolve('gt-react').endsWith('/dist/index.server.cjs'),
            true
          );
        `,
      ]);
      node([
        `--conditions=${workerCondition}`,
        '--conditions=browser',
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';

          assert.equal(
            import.meta.resolve('gt-react').endsWith('/dist/index.server.mjs'),
            true
          );
        `,
      ]);
    }
  );

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

  it('keeps development runtime machinery out of the production client graph', () => {
    const productionCode = readdirSync(join(packageRoot, 'dist', 'prod'), {
      recursive: true,
    })
      .map((file) => String(file))
      .filter((file) => /\.(cjs|mjs)$/.test(file))
      .map((file) => readFileSync(join(packageRoot, 'dist', 'prod', file)))
      .join('\n');

    expect(productionCode).not.toMatch(
      /I18nStore|useSyncExternalStore|subscribeToTranslate|lookupTranslationWithFallback|LocalStorageTranslationCache|BatchedMissingTranslationResolver|RuntimeTranslationsCache|VITE_GT_DEV_API_KEY/
    );
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
