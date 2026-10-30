import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useTranslations } from '@generaltranslation/react-core/compat';
import {
  initializeDictionaryManager,
  type Dictionary,
} from 'gt-i18n/internal/compat';
import { initializeGTSRA } from '../../setup/initializeGTSRA';
import { BrowserGTProvider } from '../../provider/BrowserGTProvider';
import { BrowserDictionaryProvider } from '../BrowserDictionaryProvider';
import { ServerDictionaryProvider } from '../ServerDictionaryProvider';

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
  ['BrowserDictionaryProvider', BrowserDictionaryProvider],
  ['ServerDictionaryProvider', ServerDictionaryProvider],
])('%s', (_name, GTDictionaryProvider) => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('reads the source dictionary from its dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <BrowserGTProvider locale='en' translations={{}}>
        <GTDictionaryProvider dictionaries={{ en: { greeting: 'Hello' } }}>
          <Greeting />
        </GTDictionaryProvider>
      </BrowserGTProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });

  it('reads the target dictionary from its dictionaries', () => {
    initialize();

    const html = renderToStaticMarkup(
      <BrowserGTProvider locale='fr' translations={{}}>
        <GTDictionaryProvider
          dictionaries={{
            en: { greeting: 'Hello' },
            fr: { greeting: 'Bonjour' },
          }}
        >
          <Greeting />
        </GTDictionaryProvider>
      </BrowserGTProvider>
    );

    expect(html).toBe('<p>Bonjour</p>');
  });

  it('falls back to the dictionary manager without dictionaries', () => {
    initialize({ greeting: 'Hello' });

    const html = renderToStaticMarkup(
      <GTDictionaryProvider>
        <BrowserGTProvider locale='en' translations={{}}>
          <Greeting />
        </BrowserGTProvider>
      </GTDictionaryProvider>
    );

    expect(html).toBe('<p>Hello</p>');
  });
});

describe('useTranslations outside GTDictionaryProvider', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('throws a diagnostic that names GTDictionaryProvider and /compat', () => {
    initialize({ greeting: 'Hello' });

    expect(() =>
      renderToStaticMarkup(
        <BrowserGTProvider locale='en' translations={{}}>
          <Greeting />
        </BrowserGTProvider>
      )
    ).toThrow(
      /useTranslations\(\) was called outside <GTDictionaryProvider>[\s\S]*'gt-react\/compat'/
    );
  });
});
