import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import gtUnplugin from '../index';
import type { GTUnpluginOptions } from '../index';
import { transformWithPlugin } from './transformWithPlugin';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import { renderInlineTranslationsModule } from '../transform/injection/inline-translations/inlineTranslationsModules';

// Same hashes inlineTranslations.test.ts pins
const HELLO_WORLD = '8ffa9649730810de';
const JSX_HELLO_WORLD = 'ebc5c5a5022c5050';

const USEGT_CODE = `
  import { useGT } from 'gt-react/unstable';
  const gt = useGT();
  gt\`Hello world\`;
`;

const T_COMPONENT_CODE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  export const el = jsx(T, { children: "Hello world" });
`;

const TRANSLATIONS = {
  fr: { [HELLO_WORLD]: 'Bonjour le monde', [JSX_HELLO_WORLD]: 'Bonjour (T)' },
  es: { [HELLO_WORLD]: 'Hola mundo', [JSX_HELLO_WORLD]: 'Hola (T)' },
  de: { [HELLO_WORLD]: 'Hallo Welt', [JSX_HELLO_WORLD]: 'Hallo (T)' },
  cn: { [HELLO_WORLD]: '你好世界', [JSX_HELLO_WORLD]: '你好 (T)' },
  'fr-FR': { [HELLO_WORLD]: 'Bonjour (FR)' },
};

function createOutputDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-static-locale-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [locale, entries] of Object.entries(TRANSLATIONS)) {
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(entries));
  }
  return dir;
}

function options(
  experimentalStaticLocale?: string,
  config: Partial<NonNullable<GTUnpluginOptions['gtConfig']>> = {},
  embeddedLocales = ['fr', 'es']
): GTUnpluginOptions {
  return {
    ...(experimentalStaticLocale !== undefined && { experimentalStaticLocale }),
    gtConfig: {
      defaultLocale: 'en',
      locales: ['fr', 'es', 'de'],
      ...config,
      files: {
        gt: {
          output: path.join(createOutputDir(), '[locale].json'),
          inlineTranslations: { locales: embeddedLocales },
        },
      },
    },
  };
}

describe('experimentalStaticLocale', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GT_STATIC_LOCALE', '');
    clearInlineTranslationsCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('embeds every configured locale when unset', async () => {
    const output = await transformWithPlugin(options(), USEGT_CODE);
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : void 0'
    );
  });

  it('collapses unstable gt callbacks to the static locale', async () => {
    const output = await transformWithPlugin(options('es'), USEGT_CODE);
    expect(output).toContain(
      '(locale) => locale === "es" ? "Hola mundo" : void 0'
    );
    expect(output).not.toContain('Bonjour');
  });

  it('collapses the <T> inline prop to the static locale', async () => {
    const output = await transformWithPlugin(options('fr'), T_COMPONENT_CODE);
    expect(output).toContain(
      'inline: (locale) => locale === "fr" ? "Bonjour (T)" : void 0'
    );
    expect(output).not.toContain('Hola');
  });

  it('reads the static locale from GT_STATIC_LOCALE', async () => {
    vi.stubEnv('GT_STATIC_LOCALE', 'es');
    const output = await transformWithPlugin(options(), USEGT_CODE);
    expect(output).toContain(
      '(locale) => locale === "es" ? "Hola mundo" : void 0'
    );
    expect(output).not.toContain('Bonjour');
  });

  it('prefers the option over GT_STATIC_LOCALE', async () => {
    vi.stubEnv('GT_STATIC_LOCALE', 'es');
    const output = await transformWithPlugin(options('fr'), USEGT_CODE);
    expect(output).toContain('"Bonjour le monde"');
    expect(output).not.toContain('Hola mundo');
  });

  it('embeds nothing for the default locale', async () => {
    const output = await transformWithPlugin(options('en'), USEGT_CODE);
    expect(output).toContain('$_hash');
    expect(output).not.toContain('(locale) =>');
  });

  it('embeds nothing for a dialect of the default locale', async () => {
    const output = await transformWithPlugin(options('en-US'), USEGT_CODE);
    expect(output).not.toContain('(locale) =>');
  });

  it('embeds nothing for a locale that is not embedded', async () => {
    const output = await transformWithPlugin(options('de'), USEGT_CODE);
    expect(output).toContain('$_hash');
    expect(output).not.toContain('(locale) =>');
    expect(output).not.toContain('Hallo');
  });

  it('resolves a regional spelling to the embedded locale', async () => {
    const output = await transformWithPlugin(options('fr-CA'), USEGT_CODE);
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('resolves a custom mapping alias to the embedded locale', async () => {
    const output = await transformWithPlugin(
      options('francais', { customMapping: { francais: { code: 'fr' } } }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : void 0'
    );
  });

  it('resolves a canonical locale to its embedded alias', async () => {
    // The runtime passes the configured alias ("cn") to the callback
    const output = await transformWithPlugin(
      options(
        'zh-CN',
        { locales: ['cn', 'fr'], customMapping: { cn: { code: 'zh-CN' } } },
        ['cn', 'fr']
      ),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "cn" ? "\\u4F60\\u597D\\u4E16\\u754C" : void 0'
    );
    expect(output).not.toContain('Bonjour');
  });

  it.each([
    ['nested in gtConfig', (config: GTUnpluginOptions) => config],
    [
      'passed as top-level plugin options',
      ({ gtConfig, ...config }: GTUnpluginOptions) => ({
        ...config,
        ...gtConfig,
      }),
    ],
  ])('resolves a custom mapping alias %s', async (_, toOptions) => {
    const output = await transformWithPlugin(
      toOptions(
        options(
          'zh-CN',
          {
            locales: ['cn', 'fr'],
            customMapping: { cn: { code: 'zh-CN' } },
          },
          ['cn', 'fr']
        )
      ),
      USEGT_CODE
    );
    expect(output).toContain('(locale) => locale === "cn" ?');
    expect(output).not.toContain('Bonjour');
  });

  it.each([
    ['best fit', true],
    ['lookup', false],
  ] as const)(
    'negotiates with localeMatcher %s from top-level plugin options',
    async (localeMatcher, embeds) => {
      const { gtConfig, ...config } = options(
        'fr-CA',
        { locales: ['fr-FR'], localeMatcher },
        ['fr-FR']
      );
      const output = await transformWithPlugin(
        { ...config, ...gtConfig },
        USEGT_CODE
      );
      expect(output?.includes('Bonjour (FR)')).toBe(embeds);
    }
  );

  it('matches the embedded spelling without configured locales', async () => {
    const output = await transformWithPlugin(
      options('es', { locales: undefined }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "es" ? "Hola mundo" : void 0'
    );
  });

  it('only watches the static locale file', async () => {
    const watched: string[] = [];
    await transformWithPlugin(options('es'), USEGT_CODE, (file) =>
      watched.push(file)
    );
    expect(watched).toHaveLength(1);
    expect(watched[0]).toMatch(/es\.json$/);
  });

  describe('with message modules', () => {
    function moduleOptions(
      staticLocale: string,
      modules: 'physical' | 'virtual'
    ): { root: string; options: GTUnpluginOptions } {
      const root = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), 'gt-static-modules-'))
      );
      onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
      const base = options(staticLocale);
      const gt = base.gtConfig!.files!.gt!;
      return {
        root,
        options: {
          ...base,
          gtConfig: {
            ...base.gtConfig,
            files: {
              gt: {
                ...gt,
                inlineTranslations: { ...gt.inlineTranslations!, modules },
              },
            },
          },
        },
      };
    }

    type ModulesPlugin = {
      buildStart(this: unknown): void;
      load(this: unknown, id: string): { code: string } | null;
    };

    function createModulesPlugin(
      root: string,
      pluginOptions: GTUnpluginOptions
    ) {
      vi.spyOn(process, 'cwd').mockReturnValue(root);
      return gtUnplugin.raw(pluginOptions, {
        framework: 'vite',
      }) as unknown as ModulesPlugin;
    }

    const context = { addWatchFile() {} };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('writes physical modules with only the static locale to its own directory', () => {
      const { root, options: pluginOptions } = moduleOptions('es', 'physical');
      createModulesPlugin(root, pluginOptions).buildStart.call(context);
      const source = fs.readFileSync(
        path.join(root, '.gt/messages/es', `${HELLO_WORLD}.js`),
        'utf8'
      );
      expect(source).toContain('locale === "es" ? "Hola mundo" : undefined');
      expect(source).not.toContain('Bonjour');
      expect(fs.readdirSync(path.join(root, '.gt/messages'))).toEqual(['es']);
    });

    it('serves virtual modules with only the static locale', () => {
      const { root, options: pluginOptions } = moduleOptions('fr', 'virtual');
      const result = createModulesPlugin(root, pluginOptions).load.call(
        context,
        `\0virtual:gt/messages/${HELLO_WORLD}.js`
      );
      expect(result?.code).toContain(
        'locale === "fr" ? "Bonjour le monde" : undefined'
      );
      expect(result?.code).not.toContain('Hola');
    });

    it.each(['en', 'ja'])(
      'leaves the shared modules alone for a locale that embeds nothing (%s)',
      (staticLocale) => {
        const { root, options: pluginOptions } = moduleOptions(
          staticLocale,
          'physical'
        );
        const dir = path.join(root, '.gt/messages');
        fs.mkdirSync(dir, { recursive: true });
        const shared = path.join(dir, `${HELLO_WORLD}.js`);
        fs.writeFileSync(
          shared,
          renderInlineTranslationsModule(
            { fr: { [HELLO_WORLD]: 'Bonjour' } },
            HELLO_WORLD
          )!
        );
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        createModulesPlugin(root, pluginOptions).buildStart.call(context);
        expect(fs.readdirSync(dir)).toEqual([`${HELLO_WORLD}.js`]);
      }
    );
  });

  describe('warnings', () => {
    function createPlugin(pluginOptions: GTUnpluginOptions): string[] {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        gtUnplugin.raw(pluginOptions, { framework: 'vite' });
        return warn.mock.calls.map(([message]) => String(message));
      } finally {
        warn.mockRestore();
      }
    }

    it('warns once for a locale that is not embedded', () => {
      const warnings = createPlugin(options('de'));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('@generaltranslation/compiler Warning:');
      expect(warnings[0]).toContain('"de"');
      expect(warnings[0]).toContain('Embedded locales: fr, es');
    });

    it('does not warn for the default locale', () => {
      expect(createPlugin(options('en'))).toEqual([]);
    });

    it('does not warn for an embedded locale', () => {
      expect(createPlugin(options('fr'))).toEqual([]);
    });
  });
});
