/**
 * gt.config.json's files.gt.inlineTranslations embeds translations for the
 * configured locales as a callback argument at each translation call site.
 */
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
import { transformWithPlugin } from './transformWithPlugin';
import type { GTUnpluginOptions } from '../index';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import { hashSource } from 'generaltranslation/id';

const icuHash = (source: string, context?: string) =>
  hashSource({ source, ...(context && { context }), dataFormat: 'ICU' });

// Same hashes the SWC plugin tests pin (packages/next/swc-plugin/src/inline_translations_tests.rs)
const HELLO_WORLD = '05a87bce151d258b';
const JSX_HELLO_WORLD = 'ebc5c5a5022c5050';

const T_COMPONENT_CODE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  export const el = jsx(T, { children: "Hello world" });
`;

const USEGT_CODE = `
  import { useGT } from 'gt-react';
  const gt = useGT();
  gt("Hello world");
`;

async function getHash(code: string, pattern: RegExp): Promise<string> {
  const output = await transformWithPlugin(undefined, code);
  const hash = output?.match(pattern)?.[1];
  if (!hash) throw new Error('hash not found in output:\n' + output);
  return hash;
}

const getGtHash = () => getHash(USEGT_CODE, /"\$_hash": "([^"]+)"/);
const getTHash = () => getHash(T_COMPONENT_CODE, /_hash: "([^"]+)"/);

function createOutputDir(
  translations: Record<string, Record<string, unknown>> = {}
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [locale, entries] of Object.entries(translations)) {
    fs.writeFileSync(path.join(dir, `${locale}.json`), JSON.stringify(entries));
  }
  return dir;
}

function gtConfigOptions(
  locales: string[],
  outputDir: string | undefined
): GTUnpluginOptions {
  return {
    gtConfig: {
      files: {
        gt: {
          ...(outputDir && { output: path.join(outputDir, '[locale].json') }),
          inlineTranslations: { locales },
        },
      },
    },
  };
}

/** Options embedding `locales`, with `translations` written to files.gt.output. */
function inlineOptions(
  locales: string[],
  translations: Record<string, Record<string, unknown>>
): GTUnpluginOptions {
  return gtConfigOptions(locales, createOutputDir(translations));
}

describe('inlineTranslations in gt.config.json', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    clearInlineTranslationsCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('appends an inline translations callback to gt() calls', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr', 'es'], {
        fr: { [hash]: 'Bonjour le monde' },
        es: { [hash]: 'Hola mundo' },
      }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : undefined'
    );
  });

  it('only embeds the configured locales', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], {
        fr: { [hash]: 'Bonjour le monde' },
        es: { [hash]: 'Hola mundo' },
      }),
      USEGT_CODE
    );
    expect(output).toContain('"Bonjour le monde"');
    expect(output).not.toContain('Hola mundo');
  });

  it('adds an inline prop to <T>', async () => {
    const hash = await getTHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      T_COMPONENT_CODE
    );
    expect(output).toContain(
      'inline: (locale) => locale === "fr" ? "Bonjour le monde" : undefined'
    );
  });

  it('skips call sites without embedded translations', async () => {
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { 'other-hash': 'Autre' } }),
      USEGT_CODE
    );
    expect(output).not.toContain('(locale) =>');
  });

  it('skips locales without a translations file', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr', 'de'], { fr: { [hash]: 'Bonjour le monde' } }),
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : undefined'
    );
  });

  it('does nothing without files.gt.output', async () => {
    const output = await transformWithPlugin(
      gtConfigOptions(['fr'], undefined),
      USEGT_CODE
    );
    expect(output).not.toContain('(locale) =>');
  });

  it('re-reads a locale file edited between builds', async () => {
    const hash = await getGtHash();
    const dir = createOutputDir({ fr: { [hash]: 'Bonjour le monde' } });
    const file = path.join(dir, 'fr.json');
    const options = gtConfigOptions(['fr'], dir);
    await transformWithPlugin(options, USEGT_CODE);

    fs.writeFileSync(file, JSON.stringify({ [hash]: 'Salut le monde' }));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    const output = await transformWithPlugin(options, USEGT_CODE);
    expect(output).toContain('"Salut le monde"');
    expect(output).not.toContain('"Bonjour le monde"');
  });

  it('registers locale files as watch dependencies', async () => {
    const hash = await getGtHash();
    const dir = createOutputDir({ fr: { [hash]: 'Bonjour le monde' } });
    const watched: string[] = [];
    await transformWithPlugin(
      gtConfigOptions(['fr', 'de'], dir),
      USEGT_CODE,
      (watchedFile) => watched.push(watchedFile)
    );
    expect(watched).toEqual([path.join(dir, 'fr.json')]);
  });

  it('appends an inline translations callback to standalone t() calls', async () => {
    const code = `
      import { t } from 'gt-react';
      t("Hello world");
    `;
    const hash = await getHash(code, /"\$_hash": "([^"]+)"/);
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      code
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : undefined'
    );
  });

  it('does not embed translations outside production builds', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      inlineOptions(['fr'], { fr: { [hash]: 'Bonjour le monde' } }),
      USEGT_CODE
    );
    expect(output).not.toContain('Bonjour le monde');
  });

  describe('derive (not supported)', () => {
    // null output means the file was left untouched
    const translations = {
      fr: { [icuHash('Hello world')]: 'Bonjour le monde' },
    };

    it('skips gt() calls with derive content', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        `import { useGT, derive } from 'gt-react';
         const gt = useGT();
         gt(\`Hello \${derive(getName())}\`);`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('skips <T> with <Derive> children', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], translations),
        `import { jsx, jsxs } from 'react/jsx-runtime';
         import { T, Derive } from 'gt-react';
         export const el = jsxs(T, { children: ["Hello ", jsx(Derive, { children: getName() })] });`
      );
      expect(output ?? '').not.toContain('inline:');
    });
  });

  describe('parity with the SWC plugin', () => {
    it('computes the same gt() and <T> hashes', async () => {
      expect(await getGtHash()).toBe(HELLO_WORLD);
      expect(await getTHash()).toBe(JSX_HELLO_WORLD);
    });

    it('keeps locale order from the config', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['es', 'fr'], {
          fr: { [HELLO_WORLD]: 'Bonjour le monde' },
          es: { [HELLO_WORLD]: 'Hola mundo' },
        }),
        USEGT_CODE
      );
      expect(output).toContain(
        'locale === "es" ? "Hola mundo" : locale === "fr" ? "Bonjour le monde"'
      );
    });

    it('does nothing without inline translations', async () => {
      const output = await transformWithPlugin(undefined, USEGT_CODE);
      expect(output).not.toContain('(locale) =>');
    });

    it('embeds translations for gt() calls with options', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [icuHash('Hi {name}', 'greeting')]: 'Salut {name}' },
        }),
        `import { useGT } from 'gt-react';
         const gt = useGT();
         gt("Hi {name}", { name: user, $context: "greeting" });`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? "Salut {name}" : undefined'
      );
    });

    it('uses a user-supplied hash for gt() calls', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], { fr: { custom: 'Perso' } }),
        `import { useGT } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $_hash: "custom" });`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? "Perso" : undefined'
      );
    });

    describe('spreads', () => {
      const customOptions = () =>
        inlineOptions(['fr'], { fr: { custom: 'Perso' } });

      it.each([
        [
          'gt',
          `import { useGT } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $_hash: "custom", ...overrides });`,
        ],
        [
          't',
          `import { t } from 'gt-react';
         t("Hello world", { $_hash: "custom", ...overrides });`,
        ],
      ])(
        'skips %s() calls whose $_hash a later spread can replace',
        async (_, code) => {
          const output = await transformWithPlugin(customOptions(), code);
          expect(output ?? '').not.toContain('(locale) =>');
        }
      );

      it('embeds when $_hash comes after the spread', async () => {
        const output = await transformWithPlugin(
          customOptions(),
          `import { useGT } from 'gt-react';
           const gt = useGT();
           gt("Hello world", { ...overrides, $_hash: "custom" });`
        );
        expect(output).toContain(
          '(locale) => locale === "fr" ? "Perso" : undefined'
        );
      });

      it('embeds under the computed hash appended after a spread', async () => {
        const output = await transformWithPlugin(
          inlineOptions(['fr'], { fr: { [HELLO_WORLD]: 'Bonjour le monde' } }),
          `import { useGT } from 'gt-react';
           const gt = useGT();
           gt("Hello world", { ...options });`
        );
        expect(output).toContain('"Bonjour le monde"');
      });

      it('skips <T> with spread props', async () => {
        const output = await transformWithPlugin(
          inlineOptions(['fr'], {
            fr: { [JSX_HELLO_WORLD]: 'Bonjour le monde' },
          }),
          `import { jsx } from 'react/jsx-runtime';
           import { T } from 'gt-react';
           export const el = jsx(T, { ...props, children: "Hello world" });`
        );
        expect(output ?? '').not.toContain('inline:');
      });
    });

    it('embeds JSX children objects for <T>', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [JSX_HELLO_WORLD]: ['Bonjour ', { c: 'monde', i: 1 }] },
        }),
        T_COMPONENT_CODE
      );
      expect(output).toContain('locale === "fr" ? ["Bonjour ", {');
      expect(output).toContain('c: "monde"');
    });

    it('skips <T> without embedded translations', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], { fr: {} }),
        T_COMPONENT_CODE
      );
      expect(output).toContain('_hash: "');
      expect(output).not.toContain('inline:');
    });

    it('never embeds translations in msg() calls', async () => {
      // msg() strings load from the msg()-only translations file instead
      const output = await transformWithPlugin(
        inlineOptions(['fr'], { fr: { [icuHash('Hello')]: 'Bonjour' } }),
        `import { msg } from 'gt-react';
         export const a = msg("Hello");
         export const b = msg("Hello", { $id: "greeting" });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('skips gt() calls with a derive $context', async () => {
      const output = await transformWithPlugin(
        inlineOptions(['fr'], {
          fr: { [HELLO_WORLD]: 'Bonjour le monde' },
        }),
        `import { useGT, derive } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $context: derive(getContext()) });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });
  });
});
