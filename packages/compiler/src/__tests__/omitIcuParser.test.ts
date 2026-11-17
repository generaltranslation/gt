/**
 * experimentalOmitIcuParser: a production build resolves the ICU string parser
 * to the parser-less build of `@generaltranslation/icu/parser`, and fails when
 * a module imports something that works with ICU strings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import gtUnplugin, { esbuild as gtEsbuild } from '../index';
import type { GTUnpluginOptions } from '../index';
import { transformWithPlugin } from './transformWithPlugin';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PARSER = '@generaltranslation/icu/parser';
// A file of the workspace, as a module that imports the parser is
const IMPORTER = path.join(PACKAGE_ROOT, 'src', 'index.ts');

type RawPlugin = {
  resolveId: (id: string, importer?: string) => string | null;
  vite: {
    config: (
      config: unknown,
      env: { command: 'build' | 'serve' }
    ) =>
      | { resolve: { alias: { find: RegExp; replacement: string }[] } }
      | undefined;
  };
};

function createPlugin(options: GTUnpluginOptions = {}): RawPlugin {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return gtUnplugin.raw(
      { gtConfig: {}, ...options },
      { framework: 'rollup' }
    ) as unknown as RawPlugin;
  } finally {
    warn.mockRestore();
  }
}

const transform = (code: string, options: GTUnpluginOptions = {}) =>
  transformWithPlugin({ experimentalOmitIcuParser: true, ...options }, code);

describe('experimentalOmitIcuParser', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_OMIT_ICU_PARSER', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('resolving the parser', () => {
    it.each([
      ['a module', IMPORTER, 'parser.omitted.mjs'],
      [
        'a CommonJS module',
        IMPORTER.replace(/\.ts$/, '.cjs'),
        'parser.omitted.cjs',
      ],
      ['no importer', undefined, 'parser.omitted.mjs'],
    ])(
      'resolves it for %s to the build without it',
      (_name, importer, file) => {
        const resolved = createPlugin({
          experimentalOmitIcuParser: true,
        }).resolveId(PARSER, importer);
        expect(path.basename(resolved!)).toBe(file);
        const source = fs.readFileSync(resolved!, 'utf8');
        expect(source).toContain('This build left out the ICU message parser');
        expect(source).not.toContain('EXPECT_ARGUMENT_CLOSING_BRACE');
      }
    );

    it.each([
      ['the option is off', {}, 'production', PARSER],
      [
        'the build is not for production',
        { experimentalOmitIcuParser: true },
        'development',
        PARSER,
      ],
      [
        'another module is imported',
        { experimentalOmitIcuParser: true },
        'production',
        '@generaltranslation/icu',
      ],
    ] as const)('leaves it alone when %s', (_name, options, nodeEnv, id) => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      expect(createPlugin(options).resolveId(id, IMPORTER)).toBeNull();
    });

    it.each([
      ['true', true],
      ['1', true],
      ['false', false],
      ['', false],
    ])('reads GT_OMIT_ICU_PARSER=%j', (value, omits) => {
      vi.stubEnv('GT_OMIT_ICU_PARSER', value);
      expect(createPlugin().resolveId(PARSER, IMPORTER) !== null).toBe(omits);
    });

    it('lets the option override GT_OMIT_ICU_PARSER, and rejects a value that is not a boolean', () => {
      vi.stubEnv('GT_OMIT_ICU_PARSER', 'true');
      expect(
        createPlugin({ experimentalOmitIcuParser: false }).resolveId(
          PARSER,
          IMPORTER
        )
      ).toBeNull();
      vi.stubEnv('GT_OMIT_ICU_PARSER', 'yes');
      expect(() => createPlugin()).toThrow(
        '@generaltranslation/compiler Error: GT_OMIT_ICU_PARSER is set to "yes", which is not a boolean'
      );
    });

    it('aliases it in a Vite build, which resolves packages before plugins do', () => {
      const { vite } = createPlugin({ experimentalOmitIcuParser: true });
      const [alias] = vite.config({}, { command: 'build' })!.resolve.alias;
      expect(alias.find.test(PARSER)).toBe(true);
      expect(alias.find.test(`${PARSER}/x`)).toBe(false);
      expect(path.basename(alias.replacement)).toBe('parser.omitted.mjs');
      expect(vite.config({}, { command: 'serve' })).toBeUndefined();
      expect(
        createPlugin().vite.config({}, { command: 'build' })
      ).toBeUndefined();
    });
  });

  describe('imports that work with ICU strings', () => {
    it.each([
      ['useGT', `import { useGT } from 'gt-react';`],
      ['msg', `import { T, msg as message } from 'gt-react';`],
      ['t', `import { t } from 'gt-react';`],
      ['getGT', `import { getGT } from 'gt-next/server';`],
      ['useTranslations', `import { useTranslations } from 'gt-react/compat';`],
      ['useMessages', `export { useMessages } from 'gt-tanstack-start';`],
    ])('fail the build: %s', async (name, statement) => {
      await expect(
        transform(`${statement}\nexport const x = 1;`)
      ).rejects.toThrow(
        new RegExp(
          `@generaltranslation/compiler Error: ${name} from "[^"]+" works with ICU strings, but experimentalOmitIcuParser leaves the ICU parser out of this build\\..*App\\.tsx:1:\\d+`,
          's'
        )
      );
    });

    it.each([
      [
        'a tagged template from /unstable',
        `import { t, useGT, msg } from 'gt-react/unstable';\nexport const label = () => t\`Save\`;`,
      ],
      [
        'components',
        `import { T, Num, Plural, useLocale } from 'gt-react';\nexport const x = [T, Num, Plural, useLocale];`,
      ],
      [
        'a type',
        `import type { useGT } from 'gt-react';\nimport { type msg, T } from 'gt-react';\nexport const x: typeof useGT | typeof msg | typeof T = T;`,
      ],
      [
        'another package',
        `import { useGT, t } from 'other-i18n';\nexport const x = [useGT, t];`,
      ],
    ])('pass with %s', async (_name, code) => {
      await expect(transform(code)).resolves.not.toThrow();
    });

    it("pass in an installed package, whose own imports are not the app's", async () => {
      const plugin = gtUnplugin.raw(
        { gtConfig: {}, experimentalOmitIcuParser: true },
        { framework: 'rollup' }
      ) as unknown as {
        transform: (this: unknown, code: string, id: string) => unknown;
      };
      const code = `import { useGT } from 'gt-react';\nexport const x = useGT;`;
      const context = { addWatchFile() {} };
      expect(() =>
        plugin.transform.call(
          context,
          code,
          '/app/node_modules/ui-kit/index.js'
        )
      ).not.toThrow();
      expect(() =>
        plugin.transform.call(context, code, '/app/src/index.js')
      ).toThrow('useGT from "gt-react" works with ICU strings');
    });

    it('pass when the parser is not left out', async () => {
      const code = `import { useGT } from 'gt-react';\nexport const x = useGT;`;
      await expect(
        transform(code, { experimentalOmitIcuParser: false })
      ).resolves.not.toThrow();
      vi.stubEnv('NODE_ENV', 'development');
      await expect(transform(code)).resolves.not.toThrow();
    });
  });

  it("adds itself to webpack's persistent cache version, which also caches resolutions", () => {
    const cacheVersion = (experimentalOmitIcuParser: boolean) => {
      const options = { cache: { type: 'filesystem', version: 'next' } };
      (
        gtUnplugin.raw({ gtConfig: {}, experimentalOmitIcuParser }, {
          framework: 'webpack',
        } as never) as unknown as { webpack(compiler: unknown): void }
      ).webpack({ options });
      return options.cache.version;
    };
    expect(cacheVersion(false)).toBe('next');
    expect(cacheVersion(true)).toMatch(
      /^next\|gt-inline-translations:[0-9a-f]{16}$/
    );
  });

  it('leaves the parser out of a bundle that formats message trees', async () => {
    const bundle = async (experimentalOmitIcuParser: boolean) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { outputFiles } = await build({
          stdin: {
            contents: `import { initializeGTSPA } from 'gt-react';
              import { t } from 'gt-react/unstable';
              export const run = (name) =>
                initializeGTSPA({ defaultLocale: 'en' }).then(() => t\`Hello \${{ name }}\`);`,
            resolveDir: PACKAGE_ROOT,
            loader: 'js',
          },
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'browser',
          external: ['react', 'react-dom', 'react/jsx-runtime'],
          define: { 'process.env.NODE_ENV': '"production"' },
          logLevel: 'silent',
          plugins: [gtEsbuild({ gtConfig: {}, experimentalOmitIcuParser })],
        });
        return outputFiles[0].text;
      } finally {
        warn.mockRestore();
      }
    };
    const [withParser, withoutParser] = await Promise.all([
      bundle(false),
      bundle(true),
    ]);
    // The parser's error table, and the stub's one error
    expect(withParser).toContain('A placeholder is not closed');
    expect(withoutParser).not.toContain('A placeholder is not closed');
    expect(withoutParser).toContain(
      'This build left out the ICU message parser'
    );
    expect(withParser.length - withoutParser.length).toBeGreaterThan(30_000);
  });
});
