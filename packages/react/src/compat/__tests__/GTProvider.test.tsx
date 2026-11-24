import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
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

  it('renders an entry missing from the target dictionary with its translation', () => {
    initialize();
    const source = 'Hello, {name}!';

    function NamedGreeting() {
      const t = useTranslations();
      return <p>{t('greeting', { name: 'Ada' })}</p>;
    }
    const render = (locale: string) =>
      renderToStaticMarkup(
        <GTProvider
          locale={locale}
          translations={{
            fr: {
              [hashSource({ source, dataFormat: 'ICU' })]: 'Bonjour, {name} !',
            },
          }}
          dictionaries={{ en: { greeting: source } }}
        >
          <NamedGreeting />
        </GTProvider>
      );

    expect(render('en')).toBe('<p>Hello, Ada!</p>');
    expect(render('fr')).toBe('<p>Bonjour, Ada !</p>');
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

describe('compat BrowserGTProvider in production', () => {
  beforeEach(() => {
    resetGTGlobals();
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetGTGlobals();
  });

  it('renders translations without an I18nStore', () => {
    initialize();
    const source = 'Hello';

    const html = renderToStaticMarkup(
      <BrowserGTProvider
        locale='fr'
        translations={{
          fr: { [hashSource({ source, dataFormat: 'ICU' })]: 'Bonjour' },
        }}
        dictionaries={{ en: { greeting: source } }}
      >
        <Greeting />
      </BrowserGTProvider>
    );

    expect(html).toBe('<p>Bonjour</p>');
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
