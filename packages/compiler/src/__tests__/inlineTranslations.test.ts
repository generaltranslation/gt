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
const STRING_HELLO = 'c6e2133cd6d89e5d';

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

  it('adds a _translations prop to <T>', async () => {
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
      '_translations: (locale) => locale === "fr" ? "Bonjour le monde" : undefined'
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

  describe('msg()', () => {
    it('injects an inline translations callback after an undefined options argument', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: { fr: { [icuHash('Hello')]: 'Bonjour' } },
          },
        },
        `import { msg } from 'gt-react';
         export const a = msg('Hello');`
      );
      expect(output).toContain(
        'msg(\'Hello\', undefined, (locale) => locale === "fr" ? "Bonjour" : undefined)'
      );
    });

    it('hashes msg() options the same way as the runtime', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: {
              fr: { [icuHash('Hi {name}', 'greeting')]: 'Salut {name}' },
            },
          },
        },
        `import { msg } from 'gt-react';
         export const a = msg('Hi {name}', { name: 'x', $context: 'greeting' });`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? "Salut {name}" : undefined'
      );
    });

    it('injects per-element translations for msg() arrays', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr', 'es'],
            translations: {
              fr: { [icuHash('One')]: 'Un', [icuHash('Two')]: 'Deux' },
              es: { [icuHash('Two')]: 'Dos' },
            },
          },
        },
        `import { msg } from 'gt-react';
         export const a = msg(['One', 'Two']);`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? ["Un", "Deux"] : locale === "es" ? [undefined, "Dos"] : undefined'
      );
    });

    it('no longer rejects msg() arrays', async () => {
      const output = await transformWithPlugin(
        undefined,
        `import { msg } from 'gt-react';
         export const a = msg(['One', 'Two'], { $id: 'nums' });`
      );
      expect(output).not.toContain('(locale) =>');
    });
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

    it('skips msg() calls with derive content', async () => {
      const output = await transformWithPlugin(
        { inlineTranslations: { locales: ['fr'], translations } },
        `import { msg, derive } from 'gt-react';
         export const a = msg(\`Hello \${derive(getName())}\`);
         export const b = msg(['Hello world', derive(getName())]);`
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
      expect(output ?? '').not.toContain('_translations');
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
      expect(output).not.toContain('_translations');
    });

    it('hashes STRING format msg() calls', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: { fr: { [STRING_HELLO]: 'Bonjour' } },
          },
        },
        `import { msg } from 'gt-react';
         export const a = msg("Hello", { $format: "STRING" });`
      );
      expect(output).toContain(
        '(locale) => locale === "fr" ? "Bonjour" : undefined'
      );
    });

    it('leaves msg() untouched without embedded translations', async () => {
      const output = await transformWithPlugin(
        { inlineTranslations: { locales: ['fr'], translations: { fr: {} } } },
        `import { msg } from 'gt-react';
         export const a = msg(["One", "Two"], { $id: "nums" });
         export const b = msg("Hello");`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('ignores msg() from other packages', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: { fr: { [icuHash('Hello')]: 'Bonjour' } },
          },
        },
        `import { msg } from 'other';
         export const a = msg("Hello");`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });

    it('skips gt() and msg() calls with a derive $context', async () => {
      const output = await transformWithPlugin(
        {
          inlineTranslations: {
            locales: ['fr'],
            translations: {
              fr: {
                [HELLO_WORLD]: 'Bonjour le monde',
                [icuHash('Hello')]: 'Bonjour',
              },
            },
          },
        },
        `import { useGT, msg, derive } from 'gt-react';
         const gt = useGT();
         gt("Hello world", { $context: derive(getContext()) });
         export const c = msg("Hello", { $context: derive(getContext()) });`
      );
      expect(output ?? '').not.toContain('(locale) =>');
    });
  });
});
