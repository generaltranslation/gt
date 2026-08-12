import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as gtVue from '../index';

const sourceDirectories = [
  '__tests__',
  'components',
  'composables',
  'messages',
  'rendering',
  'runtime',
  'types',
];

describe('gt-vue package layout', () => {
  it('keeps every source directory under src', () => {
    const src = fileURLToPath(new URL('..', import.meta.url));
    expect(readdirSync(src).sort()).toEqual(
      [...sourceDirectories, 'index.ts'].sort()
    );
    expect(
      sourceDirectories.filter((directory) =>
        existsSync(new URL(`../../${directory}`, import.meta.url))
      )
    ).toEqual([]);
  });

  it('exports the complete runtime API from the root entry point', () => {
    expect(Object.keys(gtVue).sort()).toEqual(
      [
        'Branch',
        'Currency',
        'DateTime',
        'Num',
        'Plural',
        'T',
        'Var',
        'createGT',
        'initializeGTSPA',
        'msg',
        't',
        'useGT',
        'useLocale',
        'useMessages',
        'useSetLocale',
      ].sort()
    );
  });

  it('accepts React rich-wire literals through TranslationCatalog', () => {
    const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
    const fixtureDirectory = mkdtempSync(
      join(packageRoot, '.gt-vue-typecheck-')
    );
    const fixture = join(fixtureDirectory, 'catalog.ts');
    writeFileSync(
      fixture,
      `
        import type { TranslationCatalog } from '../src/index.js';

        const catalog = {
          rootFalse: false,
          rootTrue: true,
          rootNull: null,
          nestedFalse: { t: 'div', c: false },
          nestedTrue: { t: 'div', c: true },
          nestedNull: { t: 'div', c: { t: 'span', c: null } },
          branches: {
            t: 'Branch',
            d: { t: 'b', b: { active: true, inactive: false, empty: null } },
          },
        } satisfies TranslationCatalog;

        // @ts-expect-error React omits boolean and null values inside arrays.
        const invalidArray = [false] satisfies TranslationCatalog[string];

        void catalog;
        void invalidArray;
      `
    );

    try {
      execFileSync(
        process.execPath,
        [
          join(packageRoot, 'node_modules/typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          'ESNext',
          '--moduleResolution',
          'Bundler',
          '--target',
          'ES2022',
          fixture,
        ],
        { stdio: 'pipe' }
      );
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  }, 30_000);

  it('publishes documented T metadata props and compiler aliases', () => {
    const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
    const fixtureDirectory = mkdtempSync(
      join(packageRoot, '.gt-vue-typecheck-')
    );
    const fixture = join(fixtureDirectory, 't-props.ts');
    writeFileSync(
      fixture,
      `
        import { T } from '../src/index.js';

        type TPublicProps = InstanceType<typeof T>['$props'];

        const documented = {
          context: 'welcome',
          id: 'welcome-id',
          maxChars: 80,
          requiresReview: true,
        } satisfies TPublicProps;
        const aliases = {
          $context: 'welcome',
          $id: 'welcome-id',
          $maxChars: 80,
          $requiresReview: true,
          _hash: 'compiled-hash',
        } satisfies TPublicProps;

        // @ts-expect-error maxChars must be numeric.
        const invalidMaxChars = { maxChars: '80' } satisfies TPublicProps;
        // @ts-expect-error requiresReview must be boolean.
        const invalidReview = { $requiresReview: 'yes' } satisfies TPublicProps;

        void documented;
        void aliases;
        void invalidMaxChars;
        void invalidReview;
      `
    );

    try {
      execFileSync(
        process.execPath,
        [
          join(packageRoot, 'node_modules/typescript/bin/tsc'),
          '--noEmit',
          '--strict',
          '--skipLibCheck',
          '--module',
          'ESNext',
          '--moduleResolution',
          'Bundler',
          '--target',
          'ES2022',
          fixture,
        ],
        { stdio: 'pipe' }
      );
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  }, 30_000);

  it('publishes server-safe SPA guards and tree-shakes non-SPA consumers', () => {
    const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
    const fixtureDirectory = mkdtempSync(
      join(packageRoot, '.gt-vue-tree-shaking-')
    );
    const packDirectory = join(fixtureDirectory, 'pack');
    const unpackDirectory = join(fixtureDirectory, 'unpacked');
    const nodeModulesDirectory = join(fixtureDirectory, 'node_modules');
    const outputDirectory = join(fixtureDirectory, 'output');
    mkdirSync(packDirectory);
    mkdirSync(unpackDirectory);
    mkdirSync(nodeModulesDirectory);
    mkdirSync(join(nodeModulesDirectory, '@generaltranslation'));

    try {
      execFileSync(
        process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        ['pack', '--pack-destination', packDirectory],
        { cwd: packageRoot, stdio: 'pipe' }
      );
      const archive = readdirSync(packDirectory).find((file) =>
        file.endsWith('.tgz')
      );
      expect(archive).toBeDefined();
      execFileSync(
        'tar',
        ['-xzf', join(packDirectory, archive!), '-C', unpackDirectory],
        { stdio: 'pipe' }
      );

      for (const [name, target] of [
        ['gt-vue', join(unpackDirectory, 'package')],
        ['@generaltranslation/format', join(packageRoot, '..', 'format')],
        ['generaltranslation', join(packageRoot, '..', 'core')],
        ['gt-i18n', join(packageRoot, '..', 'i18n')],
        ['vue', realpathSync(join(packageRoot, 'node_modules', 'vue'))],
      ]) {
        symlinkSync(target, join(nodeModulesDirectory, name), 'junction');
      }

      for (const [moduleFormat, script] of [
        [
          'ESM',
          `
            const gtVue = await import('gt-vue');
            assertServerRuntime(gtVue);

            function assertServerRuntime(runtime) {
              if (typeof runtime.initializeGTSPA !== 'function') process.exit(1);
              if (typeof runtime.t !== 'function') process.exit(1);
              try {
                runtime.t('Server message');
                process.exit(1);
              } catch (error) {
                if (!String(error).includes('t() cannot run in a server-rendered environment')) process.exit(1);
              }
            }
          `,
        ],
        [
          'CommonJS',
          `
            const gtVue = require('gt-vue');
            if (typeof gtVue.initializeGTSPA !== 'function') process.exit(1);
            if (typeof gtVue.t !== 'function') process.exit(1);
            try {
              gtVue.t('Server message');
              process.exit(1);
            } catch (error) {
              if (!String(error).includes('t() cannot run in a server-rendered environment')) process.exit(1);
            }
          `,
        ],
      ] as const) {
        expect(() =>
          execFileSync(
            process.execPath,
            moduleFormat === 'ESM'
              ? ['--input-type=module', '--eval', script]
              : ['--eval', script],
            { cwd: fixtureDirectory, stdio: 'pipe' }
          )
        ).not.toThrow();
      }

      expect(() =>
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '--eval',
            `
              import { createRequire } from 'node:module';

              const require = createRequire(import.meta.url);
              const esm = await import('gt-vue');
              const commonjs = require('gt-vue');
              let cookie = 'generaltranslation.locale=en';
              globalThis.document = {
                get cookie() { return cookie; },
                set cookie(value) { cookie = value; },
              };
              globalThis.window = { location: { reload() {} } };

              const esmPlugin = await esm.initializeGTSPA();
              const commonjsPlugin = await commonjs.initializeGTSPA();
              if (commonjsPlugin !== esmPlugin) process.exit(1);
              if (commonjs.t('Shared source') !== 'Shared source') process.exit(1);
            `,
          ],
          { cwd: fixtureDirectory, stdio: 'pipe' }
        )
      ).not.toThrow();

      for (const exportName of ['msg', 'useGT']) {
        const consumerEntry = join(
          fixtureDirectory,
          `consumer-${exportName}.mjs`
        );
        const consumerOutputDirectory = `${outputDirectory}-${exportName}`;
        writeFileSync(
          consumerEntry,
          `export { ${exportName} } from 'gt-vue';\n`
        );

        execFileSync(
          process.execPath,
          [
            join(packageRoot, 'node_modules/tsdown/dist/run.mjs'),
            consumerEntry,
            '--no-config',
            '--format',
            'esm',
            '--out-dir',
            consumerOutputDirectory,
            '--logLevel',
            'silent',
          ],
          { cwd: fixtureDirectory, stdio: 'pipe' }
        );

        const bundledFile = readdirSync(consumerOutputDirectory).find((file) =>
          file.endsWith('.mjs')
        );
        expect(bundledFile).toBeDefined();
        const bundledSource = readFileSync(
          join(consumerOutputDirectory, bundledFile!),
          'utf8'
        );
        expect(bundledSource).toContain('gt-i18n/internal/string');
        if (exportName === 'msg') {
          expect(bundledSource).not.toContain('from "vue"');
        }
        expect(bundledSource).not.toContain('defineComponent');
        expect(bundledSource).not.toContain('translateVueChildren');
        expect(bundledSource).not.toContain('gt-vue-raw-t-children');
        expect(bundledSource).not.toMatch(
          /(?:from\s*|import\s*)["']generaltranslation["']/
        );
        expect(bundledSource).not.toMatch(/["']gt-i18n\/internal["']/);
        expect(bundledSource).not.toContain('spaRuntime');
        expect(bundledSource).not.toContain(
          'The browser SPA runtime is not initialized'
        );
        expect(bundledSource).not.toContain(
          'initializeGTSPA() cannot run in a server-rendered environment'
        );
        expect(bundledSource).not.toContain(
          't() cannot run in a server-rendered environment'
        );
      }
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
