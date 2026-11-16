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
});
