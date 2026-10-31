import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url))))
);

// Locale twins are experimental: their API is published only from the
// `/experimental` entry points.
const TWIN_ONLY_EXPORTS = [
  'GtInternalRegisterLocaleTwin',
  'markNavigatingReload',
];
const SHARED_EXPORTS = [
  'T',
  'useGT',
  'useMessages',
  'msg',
  't',
  'getGT',
  'getMessages',
  'getLocale',
  'setupRouterGTIntegration',
  'LocaleSelector',
];

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
    timeout: 60_000,
  });
}

function nodeWithExit(conditions: string[], script: string): void {
  execFileSync(
    process.execPath,
    [
      ...conditions.map((condition) => `--conditions=${condition}`),
      '--input-type=module',
      '--eval',
      // Loading the entrypoint under worker conditions leaves open handles.
      `${script}\nprocess.exit(0);`,
    ],
    { cwd: packageRoot, stdio: 'pipe' }
  );
}

// Each test blocks on child processes, so concurrent tests only queue and every
// timeout would also count the time spent waiting for the others.
describe.sequential(
  'gt-tanstack-start/experimental package exports',
  // Each test starts Node processes that load the built package, which can
  // take several seconds on a busy CI runner.
  { timeout: 30_000 },
  () => {
    beforeAll(() => {
      // The regular package export tests rebuild dist first (vitest.config.ts
      // runs this project after them); build only when it is missing.
      if (
        existsSync(join(packageRoot, 'dist/experimental/index.server.mjs')) &&
        existsSync(join(packageRoot, 'dist/experimental/plugin/vite.mjs'))
      ) {
        return;
      }
      buildPackage();
    }, 120_000);

    it.each([
      ['default', [], 'function'],
      ['worker', ['worker'], 'function'],
      ['workerd', ['workerd'], 'function'],
      ['browser', ['browser'], 'undefined'],
    ])(
      'exports the locale twin API (%s condition)',
      (_name, conditions, createLocaleTwinAssetsType) => {
        nodeWithExit(
          conditions,
          `
            import assert from 'node:assert/strict';
            import * as experimental from 'gt-tanstack-start/experimental';
            import * as regular from 'gt-tanstack-start';
            import * as gtReact from 'gt-react/experimental';

            for (const name of ${JSON.stringify([...TWIN_ONLY_EXPORTS, ...SHARED_EXPORTS])}) {
              assert.equal(typeof experimental[name], 'function', name);
            }
            for (const name of ${JSON.stringify([...TWIN_ONLY_EXPORTS, 'createLocaleTwinAssets'])}) {
              assert.equal(name in regular, false, 'gt-tanstack-start leaked ' + name);
            }
            for (const name of ['T', 'useGT', 'msg']) {
              assert.equal(experimental[name], gtReact[name], name);
            }
            assert.notEqual(experimental.getGT, regular.getGT);
            assert.equal(typeof experimental.createLocaleTwinAssets, '${createLocaleTwinAssetsType}');
          `
        );
      }
    );

    it('builds the experimental entries against gt-react/experimental', () => {
      for (const file of [
        'dist/experimental/index.client.mjs',
        'dist/experimental/index.server.mjs',
      ]) {
        const code = readFileSync(join(packageRoot, file), 'utf8');
        expect(code, file).toContain('"gt-react/experimental"');
        expect(code, file).not.toMatch(/from "gt-react"/);
      }
    });

    it('loads the experimental Vite plugin with the experimental compiler', () => {
      nodeWithExit(
        [],
        `
          import assert from 'node:assert/strict';
          import { gtTanstackStart } from 'gt-tanstack-start/experimental/plugin/vite';

          const plugins = gtTanstackStart({
            experimentalCompilerOptions: { type: 'babel', logLevel: 'silent' },
          });
          assert.deepEqual(
            plugins.map((plugin) => plugin.name),
            ['gt-tanstack-start', '@generaltranslation/GT_PLUGIN']
          );
          // The experimental compiler adds the locale twin Vite hooks
          assert.equal(typeof plugins[1].resolveId, 'function');
        `
      );
    });
  }
);
