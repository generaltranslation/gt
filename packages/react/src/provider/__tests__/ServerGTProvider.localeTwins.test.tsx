/**
 * With locale twins the server renders without a translations snapshot: it
 * loads the whole request locale into its cache (gt-tanstack-start's
 * gtMiddleware does this) and the provider takes no `translations` prop.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';
import { useGT } from '@generaltranslation/react-core/hooks';
import { initializeGTSRA } from '../../setup/initializeGTSRA';
import { ServerGTProvider } from '../ServerGTProvider';

const HASH = '0123456789abcdef';

function Greeting() {
  const gt = useGT();
  return <span>{gt('Hello', { $_hash: HASH })}</span>;
}

function resetI18nGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

describe('ServerGTProvider with locale twins', () => {
  beforeEach(resetI18nGlobals);
  afterEach(resetI18nGlobals);

  it('renders translations loaded on the server without a snapshot prop', async () => {
    initializeGTSRA({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      files: {
        gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' },
      },
      loadTranslations: async (locale: string) =>
        locale === 'fr' ? { [HASH]: 'Bonjour' } : {},
    });
    await getTranslationsSnapshot('fr');

    expect(
      renderToStaticMarkup(
        <ServerGTProvider locale='fr'>
          <Greeting />
        </ServerGTProvider>
      )
    ).toBe('<span>Bonjour</span>');
  });
});
