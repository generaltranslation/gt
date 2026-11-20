import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeI18nConfig,
  ReactI18nCache,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { T } from '@generaltranslation/react-core/components';
import { useGT } from '@generaltranslation/react-core/hooks';
import { hashSource } from 'generaltranslation/id';
import { hashContent } from 'gt-i18n/internal';
import { ServerGTProvider } from '../ServerGTProvider';

describe('ServerGTProvider', () => {
  afterEach(() => {
    Reflect.deleteProperty(
      Reflect.get(globalThis, '__generaltranslation'),
      'i18n'
    );
  });

  function setupCachedTranslations() {
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    const cache = new ReactI18nCache({});
    // Translations another request added to the process-wide cache.
    cache.updateTranslations({
      fr: {
        [hashSource({ source: 'Hello', dataFormat: 'MESSAGE_TREE' })]:
          'Bonjour',
        [hashContent('Goodbye', { $format: 'JSX' })]: 'Au revoir',
      },
    });
    setReactI18nCache(cache);
  }

  function Greeting() {
    return <span>{useGT()`Hello`}</span>;
  }

  it('renders only the translations given to it, which the browser also receives', () => {
    setupCachedTranslations();

    expect(
      renderToString(
        <ServerGTProvider locale='fr' translations={{ fr: {} }}>
          <Greeting />
          <T>Goodbye</T>
        </ServerGTProvider>
      )
    ).toBe('<span>Hello</span>Goodbye');
  });

  it('reads the process-wide cache when it is given no translations', () => {
    setupCachedTranslations();

    expect(
      renderToString(
        // @ts-expect-error JavaScript callers can omit translations.
        <ServerGTProvider locale='fr'>
          <Greeting />
          <T>Goodbye</T>
        </ServerGTProvider>
      )
    ).toBe('<span>Bonjour</span>Au revoir');
  });
});
