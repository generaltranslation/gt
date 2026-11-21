import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
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

/** Names a source entry exports, read from its top-level statements. */
function getExportedNames(entryPath: string): {
  values: string[];
  types: string[];
} {
  const sourceFile = ts.createSourceFile(
    entryPath,
    readFileSync(entryPath, 'utf8'),
    ts.ScriptTarget.Latest
  );
  const values: string[] = [];
  const types: string[] = [];
  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (
        !statement.exportClause ||
        !ts.isNamedExports(statement.exportClause)
      ) {
        throw new Error(`${entryPath} has an export this test cannot read`);
      }
      for (const element of statement.exportClause.elements) {
        const isType = statement.isTypeOnly || element.isTypeOnly;
        (isType ? types : values).push(element.name.text);
      }
    } else if (
      ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (ts.isFunctionDeclaration(statement) && statement.name) {
        values.push(statement.name.text);
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          values.push(declaration.name.getText(sourceFile));
        }
      } else if (
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement)
      ) {
        types.push(statement.name.text);
      } else {
        throw new Error(`${entryPath} has an export this test cannot read`);
      }
    }
  }
  return { values: values.sort(), types: types.sort() };
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

  it('mirrors the root export conditions for gt-next/compat', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as { exports: Record<string, Record<string, unknown>> };
    const rootConditions = Object.keys(packageJson.exports['.']);
    const compatExport = packageJson.exports['./compat'];

    expect(Object.keys(compatExport)).toEqual(rootConditions);
    expect(JSON.stringify(compatExport).replaceAll('compat.', 'index.')).toBe(
      JSON.stringify(packageJson.exports['.'])
    );
    expect(packageJson.exports['./compat/server']).toEqual(
      JSON.parse(
        JSON.stringify(packageJson.exports['./server']).replaceAll(
          './dist/server',
          './dist/compat/server'
        )
      )
    );
  });

  it.each([
    [['react-server', 'browser'], 'compat.rsc.mjs'],
    [['workerd', 'browser'], 'compat.server.mjs'],
    [['browser'], 'compat.client.mjs'],
    [[], 'compat.server.mjs'],
  ])('resolves gt-next/compat with conditions %j to %s', (conditions, file) => {
    runNode([
      ...conditions.map((condition) => `--conditions=${condition}`),
      '--input-type=module',
      '--eval',
      `
          import assert from 'node:assert/strict';
          import { basename } from 'node:path';
          import { fileURLToPath } from 'node:url';

          assert.equal(
            basename(fileURLToPath(import.meta.resolve('gt-next/compat'))),
            ${JSON.stringify(file)}
          );
        `,
    ]);
  });

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

  it('exposes exactly the supported subpaths', () => {
    const { exports } = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as { exports: Record<string, unknown> };

    expect(Object.keys(exports)).toEqual([
      '.',
      './compat',
      './config',
      './server',
      './compat/server',
      './middleware',
      './link',
      './internal/_dictionary',
      './internal/_load-translations',
      './internal/_load-dictionary',
      './internal/_getLocale',
      './internal/_getRegion',
    ]);
  });

  // No `t` or `m`: Next has no synchronous global locale store (RSC's is async).
  const rootExports = [
    'Currency',
    'DateTime',
    'Derive',
    'GTProvider',
    'GtInternalTranslateJsx',
    'GtInternalVar',
    'LocaleSelector',
    'N',
    'Num',
    'Ordinal',
    'Plural',
    'RegionSelector',
    'RelativeTime',
    'Select',
    'T',
    'Var',
    'date',
    'derive',
    'getDefaultLocale',
    'getLocaleProperties',
    'getLocales',
    'getTranslationsSnapshot',
    'getVersionId',
    'isLocaleSupported',
    'mFallback',
    'msg',
    'n',
    'number',
    'ordinal',
    'parseLocale',
    'part',
    'plural',
    'resolveCanonicalLocale',
    'select',
    'time',
    'useDefaultLocale',
    'useGT',
    'useLocale',
    'useLocaleDirection',
    'useLocaleProperties',
    'useLocaleSelector',
    'useLocales',
    'useLocalizeHref',
    'useMessages',
    'useRegion',
    'useSetLocale',
    'withGTServerSideProps',
    'withGTStaticProps',
  ];
  // Server Components cannot set the locale.
  const rscExports = rootExports.filter(
    (name) => name !== 'useLocaleSelector' && name !== 'useSetLocale'
  );
  const serverExports = [
    'Tx',
    'dyn',
    'getGT',
    'getLocale',
    'getLocaleDirection',
    'getLocalizeHref',
    'getMessages',
    'getRegion',
    'registerLocale',
    'tx',
  ];
  const messageTypes = ['GT', 'GTOptions', 'M', 'Msg', 'Part', 'Placeholder'];

  it.each([
    // The types entry is what TypeScript users see outside Server Components.
    ['index.types.ts', rootExports],
    ['index.client.ts', rootExports],
    ['index.server.ts', rootExports],
    ['index.rsc.ts', rscExports],
    ['server.ts', serverExports],
  ])('exports the tagged-template message API from %s', (file, expected) => {
    const { values, types } = getExportedNames(join(packageRoot, 'src', file));

    expect(values).toEqual(expected);
    if (file !== 'server.ts') {
      expect(types).toEqual(expect.arrayContaining(messageTypes));
    }
  });

  const distIt = existsSync(distInitGTServerPath) ? it : it.skip;
  const distClientIt = existsSync(distClientPath) ? it : it.skip;
  // Local JS-only builds (`build:no-swc-plugin`) need not ship the WASM, but
  // full CI builds must, so this is gated on CI rather than on dist contents.
  const swcPluginIt = process.env.CI ? it : it.skip;

  swcPluginIt('ships the SWC plugin WASM alongside the built config', () => {
    expect(existsSync(distSwcPluginPath)).toBe(true);
  });

  const distFile = (file: string) =>
    pathToFileURL(join(packageRoot, 'dist', file)).href;
  // Plain Node cannot load server-only or Next's react-server React, so the
  // RSC barrel is imported by path and server-only is stubbed.
  const stubServerOnly = `data:text/javascript,${encodeURIComponent(`
    import { register } from 'node:module';
    register('data:text/javascript,' + encodeURIComponent(
      'export const resolve = (specifier, context, next) => specifier === "server-only" ? { url: "data:text/javascript,", shortCircuit: true } : next(specifier, context);'
    ));
  `)}`;

  distIt.each([
    ['client', ['--conditions=browser'], 'gt-next', rootExports],
    ['server', [], 'gt-next', rootExports],
    ['rsc', [], distFile('index.rsc.mjs'), rscExports],
    ['/server', [], 'gt-next/server', serverExports],
  ])(
    'loads the tagged-template message API from the built %s entry',
    (_runtime, conditions, entry, expected) => {
      runNode([
        `--import=${stubServerOnly}`,
        ...conditions,
        '--input-type=module',
        '--eval',
        `
          import assert from 'node:assert/strict';
          const entry = await import(${JSON.stringify(entry)});
          const i18n = await import('gt-i18n');

          assert.deepEqual(Object.keys(entry).sort(), ${JSON.stringify(expected)});
          if (entry.msg) {
            for (const name of ['msg', 'mFallback', 'derive', 'plural', 'part', 'n']) {
              assert.equal(entry[name], i18n[name], name);
            }
          }
        `,
      ]);
    }
  );

  distIt.each([
    ['index.client', 'initializeGTClient'],
    ['index.server', 'initializeGT'],
    ['index.rsc', 'initializeGTServer'],
    ['server', 'initializeGTServer'],
  ])('initializes GT from the built %s barrel', (entry, init) => {
    for (const extension of ['mjs', 'js']) {
      expect(
        readFileSync(join(packageRoot, 'dist', `${entry}.${extension}`), 'utf8')
      ).toMatch(new RegExp(`\\b${init}\\)?\\(\\)`));
    }
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
        i18nCacheParams: {
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
