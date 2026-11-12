import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTranslations } from '@generaltranslation/react-core/compat';
import {
  initializeDictionaryManager,
  type Dictionary,
} from 'gt-i18n/internal/compat';
import { initializeGTSRA } from '../../setup/initializeGTSRA';
import { BrowserGTProvider as RootGTProvider } from '../../provider/BrowserGTProvider';
import { BrowserGTProvider } from '../BrowserGTProvider';
import { ServerGTProvider } from '../ServerGTProvider';

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
  });
  if (dictionary) initializeDictionaryManager({ dictionary });
}

describe.each([
  ['BrowserGTProvider', BrowserGTProvider],
  ['ServerGTProvider', ServerGTProvider],
])('compat %s', (_name, GTProvider) => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('reads the source dictionary from its dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <GTProvider
        locale='en'
        translations={{}}
        dictionaries={{ en: { greeting: 'Hello' } }}
      >
        <Greeting />
      </GTProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });

  it('reads the target dictionary from its dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <GTProvider
        locale='fr'
        translations={{}}
        dictionaries={{
          en: { greeting: 'Hello' },
          fr: { greeting: 'Bonjour' },
        }}
      >
        <Greeting />
      </GTProvider>
    );

    expect(html).toBe('<p>Bonjour</p>');
  });

  it('falls back to the dictionary manager without dictionaries', () => {
    initialize({ greeting: 'Hello' });

    const html = renderToStaticMarkup(
      <GTProvider locale='en' translations={{}}>
        <Greeting />
      </GTProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });
});

describe('useTranslations under the root GTProvider', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('throws a diagnostic that names the /compat GTProvider', () => {
    initialize({ greeting: 'Hello' });

    expect(() =>
      renderToStaticMarkup(
        <RootGTProvider locale='en' translations={{}}>
          <Greeting />
        </RootGTProvider>
      )
    ).toThrow(
      /useTranslations\(\) was called outside a GTProvider from a \/compat entry[\s\S]*'gt-react\/compat'/
    );
  });
});
