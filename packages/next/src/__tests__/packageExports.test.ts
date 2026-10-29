import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const distInitGTServerPath = join(packageRoot, 'dist/setup/initGT.server.mjs');
const distClientPath = join(packageRoot, 'dist/index.client.mjs');
const distSwcPluginPath = join(packageRoot, 'dist/gt_swc_plugin.wasm');

function runNode(args: string[]): void {
  const result = spawnSync(process.execPath, args, {
    cwd: packageRoot,
    encoding: 'utf8',
  });

  expect(result.status, result.stderr).toBe(0);
}

function collectStaticModuleGraph(entryPath: string): Set<string> {
  const modules = new Set<string>();
  const pending = [entryPath];
  const relativeImportPattern =
    /(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g;

  while (pending.length) {
    const modulePath = pending.pop()!;
    if (modules.has(modulePath) || !existsSync(modulePath)) continue;
    modules.add(modulePath);

    const source = readFileSync(modulePath, 'utf8');
    for (const match of source.matchAll(relativeImportPattern)) {
      pending.push(resolve(dirname(modulePath), match[1]));
    }
  }

  return new Set(
    [...modules].map((modulePath) => relative(packageRoot, modulePath))
  );
}

type TypedTargets = Record<'import' | 'default', { types: string }>;

describe('gt-next package exports', () => {
  it('uses RSC-specific declarations for the react-server condition', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as {
      exports: {
        '.': TypedTargets & { 'react-server': TypedTargets };
      };
    };
    const rootExport = packageJson.exports['.'];

    expect(rootExport['react-server'].import.types).toBe(
      './dist/index.rsc.d.mts'
    );
    expect(rootExport['react-server'].default.types).toBe(
      './dist/index.rsc.d.ts'
    );
    expect(rootExport.import.types).toBe('./dist/index.types.d.mts');
    expect(rootExport.default.types).toBe('./dist/index.types.d.ts');
  });

  it.each(['workerd', 'worker'])(
    'resolves the server entrypoint when %s and browser conditions are active',
    (workerCondition) => {
      const packageJson = JSON.parse(
        readFileSync(join(packageRoot, 'package.json'), 'utf8')
      ) as {
        exports: {
          '.': Record<
            string,
            | string
            | {
                import?: string;
                default?: string;
              }
          >;
        };
      };

      expect(packageJson.exports['.'][workerCondition]).toEqual({
        import: './dist/index.server.mjs',
        default: './dist/index.server.js',
      });

      runNode([
        `--conditions=${workerCondition}`,
        '--conditions=browser',
        '--input-type=module',
        '--eval',
        `
          import assert from 'node:assert/strict';
          import { basename } from 'node:path';
          import { fileURLToPath } from 'node:url';

          assert.equal(
            basename(fileURLToPath(import.meta.resolve('gt-next'))),
            'index.server.mjs'
          );
        `,
      ]);
    }
  );

  it('prefers the RSC entrypoint over worker and browser conditions', () => {
    runNode([
      '--conditions=react-server',
      '--conditions=workerd',
      '--conditions=worker',
      '--conditions=browser',
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        import { basename } from 'node:path';
        import { fileURLToPath } from 'node:url';

        assert.equal(
          basename(fileURLToPath(import.meta.resolve('gt-next'))),
          'index.rsc.mjs'
        );
      `,
    ]);
  });

  it('mirrors the root conditions for gt-next/unstable', () => {
    const { exports, sideEffects } = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as { exports: Record<string, unknown>; sideEffects: string[] };
    const toUnstable = (value: unknown) =>
      JSON.parse(JSON.stringify(value).replaceAll('/index.', '/unstable.'));

    expect(exports['./unstable']).toEqual(toUnstable(exports['.']));
    expect(exports['./unstable/server']).toEqual({
      import: {
        types: './dist/unstable/server.d.mts',
        default: './dist/unstable/server.mjs',
      },
      default: {
        types: './dist/unstable/server.d.ts',
        default: './dist/unstable/server.js',
      },
    });
    expect(sideEffects).toEqual(
      expect.arrayContaining([
        './dist/unstable.server.*',
        './dist/unstable.rsc.*',
        './dist/unstable.client.*',
        './dist/unstable/server.*',
      ])
    );
  });

  it.each([
    [[], 'unstable.server.mjs'],
    [['browser'], 'unstable.client.mjs'],
    [['workerd', 'browser'], 'unstable.server.mjs'],
    [['react-server', 'worker', 'browser'], 'unstable.rsc.mjs'],
  ])('resolves gt-next/unstable with conditions %j', (conditions, file) => {
    runNode([
      ...conditions.map((condition) => `--conditions=${condition}`),
      '--input-type=module',
      '--eval',
      `
        import assert from 'node:assert/strict';
        import { basename } from 'node:path';
        import { fileURLToPath } from 'node:url';

        assert.equal(
          basename(fileURLToPath(import.meta.resolve('gt-next/unstable'))),
          ${JSON.stringify(file)}
        );
      `,
    ]);
  });

  const distUnstableIt = existsSync(
    join(packageRoot, 'dist/unstable.types.d.ts')
  )
    ? it
    : it.skip;

  const distFile = (file: string) =>
    pathToFileURL(join(packageRoot, 'dist', file)).href;
  // Plain Node cannot load server-only or Next's react-server React, so the
  // RSC barrels are imported by path and server-only is stubbed.
  const stubServerOnly = `data:text/javascript,${encodeURIComponent(`
    import { register } from 'node:module';
    register('data:text/javascript,' + encodeURIComponent(
      'export const resolve = (specifier, context, next) => specifier === "server-only" ? { url: "data:text/javascript,", shortCircuit: true } : next(specifier, context);'
    ));
  `)}`;

  distUnstableIt.each([
    ['client', ['--conditions=browser'], 'gt-next', 'gt-next/unstable'],
    ['server', [], 'gt-next', 'gt-next/unstable'],
    ['rsc', [], distFile('index.rsc.mjs'), distFile('unstable.rsc.mjs')],
    ['/server', [], 'gt-next/server', 'gt-next/unstable/server'],
  ])(
    'keeps the %s root cache when the unstable entry loads later',
    (_runtime, conditions, rootEntry, unstableEntry) => {
      const result = spawnSync(
        process.execPath,
        [
          `--import=${stubServerOnly}`,
          ...conditions,
          '--input-type=module',
          '--eval',
          `
            import assert from 'node:assert/strict';
            await import(${JSON.stringify(rootEntry)});
            const { getI18nCache } = await import('gt-i18n/internal');
            const cache = getI18nCache();
            const tree = [{ type: 0, value: 'Enregistrer' }];
            cache.updateTranslations({ fr: { save: tree } });

            const unstable = await import(${JSON.stringify(unstableEntry)});

            // No global sync locale store backs a t tag in gt-next.
            assert.equal(unstable.t, undefined);
            assert.equal(getI18nCache(), cache);
            assert.deepEqual(getI18nCache().lookupTranslationByHash('fr', 'save'), tree);
          `,
        ],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS: JSON.stringify({
              defaultLocale: 'en',
              locales: ['en', 'fr'],
            }),
          },
        }
      );

      expect(result.status, result.stderr).toBe(0);
    }
  );

  // Re-running init is safe: GT's global singletons keep the first instance.
  // Side-effect imports of the root barrels would be dropped by the build.
  distUnstableIt.each([
    ['unstable.client', 'initializeGTClient'],
    ['unstable.server', 'initializeGT'],
    ['unstable.rsc', 'initializeGTServer'],
    ['unstable/server', 'initializeGTServer'],
  ])('initializes GT from the built %s barrel', (entry, init) => {
    for (const extension of ['mjs', 'js']) {
      expect(
        readFileSync(join(packageRoot, 'dist', `${entry}.${extension}`), 'utf8')
      ).toMatch(new RegExp(`\\b${init}\\)?\\(\\)`));
    }
  });

  distUnstableIt('ships declarations for the unstable server entry', () => {
    expect(existsSync(join(packageRoot, 'dist', 'unstable/server.d.ts'))).toBe(
      true
    );
  });

  const distIt = existsSync(distInitGTServerPath) ? it : it.skip;
  const distClientIt = existsSync(distClientPath) ? it : it.skip;
  // Local JS-only builds (`build:no-swc-plugin`) need not ship the WASM, but
  // full CI builds must, so this is gated on CI rather than on dist contents.
  const swcPluginIt = process.env.CI ? it : it.skip;

  swcPluginIt('ships the SWC plugin WASM alongside the built config', () => {
    expect(existsSync(distSwcPluginPath)).toBe(true);
  });

  distIt('keeps custom request functions visible to bundler aliases', () => {
    const serverBuild = readFileSync(distInitGTServerPath, 'utf8');

    expect(serverBuild).toContain('gt-next/internal/_getLocale');
    expect(serverBuild).toContain('gt-next/internal/_getRegion');
    expect(serverBuild).not.toContain('createRequire');
    expect(serverBuild).not.toContain('serverRequire');
  });

  distClientIt(
    'keeps server diagnostics out of the client module graph',
    () => {
      const clientModules = collectStaticModuleGraph(distClientPath);

      expect(clientModules).toContain('dist/errors/client.mjs');
      expect(clientModules).toContain('dist/errors/request.mjs');
      expect(clientModules).not.toContain('dist/errors/createErrors.mjs');
    }
  );

  distIt('initializes custom resolvers from the ESM server build', () => {
    const script = `
      import { initializeGTServer } from ${JSON.stringify(
        pathToFileURL(distInitGTServerPath).href
      )};

      initializeGTServer({
        i18nConfigParams: {
          defaultLocale: 'en',
          locales: ['en'],
        },
        nextI18nCacheParams: {
          defaultLocale: 'en',
          locales: ['en'],
        },
      });

      console.log('ok');
    `;

    for (const envFlag of [
      '_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED',
      '_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED',
    ]) {
      const result = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', script],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            _GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED: 'false',
            _GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED: 'false',
            [envFlag]: 'true',
          },
        }
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('ok');
    }
  });
});
