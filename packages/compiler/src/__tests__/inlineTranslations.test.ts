/**
 * The inlineTranslations option embeds translations for the configured
 * locales as a callback argument at each translation call site.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transformWithPlugin } from './transformWithPlugin';
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

describe('inlineTranslations plugin option', () => {
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
      {
        inlineTranslations: {
          locales: ['fr', 'es'],
          translations: {
            fr: { [hash]: 'Bonjour le monde' },
            es: { [hash]: 'Hola mundo' },
          },
        },
      },
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : locale === "es" ? "Hola mundo" : undefined'
    );
  });

  it('only embeds the configured locales', async () => {
    const hash = await getGtHash();
    const output = await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr'],
          translations: {
            fr: { [hash]: 'Bonjour le monde' },
            es: { [hash]: 'Hola mundo' },
          },
        },
      },
      USEGT_CODE
    );
    expect(output).toContain('"Bonjour le monde"');
    expect(output).not.toContain('Hola mundo');
  });

  it('adds an inline prop to <T>', async () => {
    const hash = await getTHash();
    const output = await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr'],
          translations: { fr: { [hash]: 'Bonjour le monde' } },
        },
      },
      T_COMPONENT_CODE
    );
    expect(output).toContain(
      'inline: (locale) => locale === "fr" ? "Bonjour le monde" : undefined'
    );
  });

  it('skips call sites without embedded translations', async () => {
    const output = await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr'],
          translations: { fr: { 'other-hash': 'Autre' } },
        },
      },
      USEGT_CODE
    );
    expect(output).not.toContain('(locale) =>');
  });

  it('reads locale files from a [locale] path template', async () => {
    const hash = await getGtHash();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
    fs.writeFileSync(
      path.join(dir, 'fr.json'),
      JSON.stringify({ [hash]: 'Bonjour le monde' })
    );
    const output = await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr', 'de'],
          path: path.join(dir, '[locale].json'),
        },
      },
      USEGT_CODE
    );
    expect(output).toContain(
      '(locale) => locale === "fr" ? "Bonjour le monde" : undefined'
    );
  });

  it('re-reads a locale file edited between builds', async () => {
    const hash = await getGtHash();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
    const file = path.join(dir, 'fr.json');
    const options = {
      inlineTranslations: {
        locales: ['fr'],
        path: path.join(dir, '[locale].json'),
      },
    };
    fs.writeFileSync(file, JSON.stringify({ [hash]: 'Bonjour le monde' }));
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
    const file = path.join(dir, 'fr.json');
    fs.writeFileSync(file, JSON.stringify({ [hash]: 'Bonjour le monde' }));
    const watched: string[] = [];
    await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr', 'de'],
          path: path.join(dir, '[locale].json'),
        },
      },
      USEGT_CODE,
      (watchedFile) => watched.push(watchedFile)
    );
    expect(watched).toEqual([file]);
  });

  it('watches file-backed locales next to explicit translations', async () => {
    const hash = await getGtHash();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-inline-'));
    const frFile = path.join(dir, 'fr.json');
    fs.writeFileSync(frFile, JSON.stringify({ [hash]: 'Bonjour le monde' }));
    fs.writeFileSync(
      path.join(dir, 'es.json'),
      JSON.stringify({ [hash]: 'Hola' })
    );
    const watched: string[] = [];
    await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr', 'es'],
          path: path.join(dir, '[locale].json'),
          translations: { es: { [hash]: 'Hola mundo' } },
        },
      },
      USEGT_CODE,
      (watchedFile) => watched.push(watchedFile)
    );
    expect(watched).toEqual([frFile]);
  });

  it('appends an inline translations callback to standalone t() calls', async () => {
    const code = `
      import { t } from 'gt-react';
      t("Hello world");
    `;
    const hash = await getHash(code, /"\$_hash": "([^"]+)"/);
    const output = await transformWithPlugin(
      {
        inlineTranslations: {
          locales: ['fr'],
          translations: { fr: { [hash]: 'Bonjour le monde' } },
        },
      },
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
      {
        inlineTranslations: {
          locales: ['fr'],
          translations: { fr: { [hash]: 'Bonjour le monde' } },
        },
      },
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
        { inlineTranslations: { locales: ['fr'], translations } },
        `import { useGT, derive } from 'gt-react';
         const gt = useGT();
         gt(\`Hello \${derive(getName())}\`);`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('skips <T> with <Derive> children', async () => {
      const output = await transformWithPlugin(
        { inlineTranslations: { locales: ['fr'], translations } },
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
        {
          inlineTranslations: {
            locales: ['es', 'fr'],
            translations: {
              fr: { [HELLO_WORLD]: 'Bonjour le monde' },
              es: { [HELLO_WORLD]: 'Hola mundo' },
            },
          },
        },
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
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: {
              fr: { [icuHash('Hi {name}', 'greeting')]: 'Salut {name}' },
            },
          },
        },
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
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: { fr: { custom: 'Perso' } },
          },
        },
        `import { useGT } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $_hash: "custom" });`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? "Perso" : undefined'
      );
    });

    it('embeds JSX children objects for <T>', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: {
              fr: { [JSX_HELLO_WORLD]: ['Bonjour ', { c: 'monde', i: 1 }] },
            },
          },
        },
        T_COMPONENT_CODE
      );
      expect(output).toContain('locale === "fr" ? ["Bonjour ", {');
      expect(output).toContain('c: "monde"');
    });

    it('skips <T> without embedded translations', async () => {
      const output = await transformWithPlugin(
        { inlineTranslations: { locales: ['fr'], translations: { fr: {} } } },
        T_COMPONENT_CODE
      );
      expect(output).toContain('_hash: "');
      expect(output).not.toContain('inline:');
    });

    it('never embeds translations in msg() calls', async () => {
      // msg() strings load from the msg()-only translations file instead
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: { fr: { [icuHash('Hello')]: 'Bonjour' } },
          },
        },
        `import { msg } from 'gt-react';
         export const a = msg("Hello");
         export const b = msg("Hello", { $id: "greeting" });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('skips gt() calls with a derive $context', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: {
              fr: { [HELLO_WORLD]: 'Bonjour le monde' },
            },
          },
        },
        `import { useGT, derive } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $context: derive(getContext()) });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });
  });
});
