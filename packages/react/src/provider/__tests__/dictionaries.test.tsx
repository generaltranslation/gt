import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nStore } from '@generaltranslation/react-core/pure';
import { InternalGTProvider } from '@generaltranslation/react-core/components';
import { useTranslations } from '@generaltranslation/react-core/hooks';
import { initializeGTSRA } from '../../setup/initializeGTSRA';
import { BrowserGTProvider } from '../BrowserGTProvider';
import type { Dictionary } from 'gt-i18n';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: Record<string, unknown>;
};

// Resets the config, cache and dictionary manager. The React contexts are
// created once at module load, so the reactCore namespace stays.
function resetGTGlobals() {
  delete (globalThis as TestGlobal).__generaltranslation?.i18n;
}

function Greeting() {
  const t = useTranslations();
  return <p>{t('greeting')}</p>;
}

function initialize(dictionary?: Dictionary) {
  initializeGTSRA({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    loadTranslations: async () => ({}),
    dictionary,
  });
}

describe('dictionaries reach useTranslations', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('reads the source dictionary from GTProvider dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <BrowserGTProvider
        locale='en'
        translations={{}}
        dictionaries={{ en: { greeting: 'Hello' } }}
      >
        <Greeting />
      </BrowserGTProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });

  it('reads the target dictionary from GTProvider dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <BrowserGTProvider
        locale='fr'
        translations={{}}
        dictionaries={{
          en: { greeting: 'Hello' },
          fr: { greeting: 'Bonjour' },
        }}
      >
        <Greeting />
      </BrowserGTProvider>
    );

    expect(html).toBe('<p>Bonjour</p>');
  });

  it('falls back to the dictionary manager without a dictionary provider', () => {
    initialize({ greeting: 'Hello' });

    const html = renderToStaticMarkup(
      <InternalGTProvider
        translations={{}}
        locale='en'
        region={undefined}
        enableI18n
        setLocale={() => undefined}
        setRegion={() => undefined}
        setEnableI18n={() => undefined}
        i18nStore={new I18nStore()}
      >
        <Greeting />
      </InternalGTProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });
});
