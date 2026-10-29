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
