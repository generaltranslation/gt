import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  createLookupOptions,
  getTranslateListenerKey,
  I18nCache,
  initializeI18nConfig,
} from 'gt-i18n/internal';
import {
  getReactI18nCache,
  setReactI18nCache,
  useGT,
} from '@generaltranslation/react-core/context';
import { ServerGTProvider } from '../ServerGTProvider';
import type { StringFormat } from '@generaltranslation/format/types';

const message = 'Hello';
const translatedMessage = 'Bonjour';
const lookupOptions = createLookupOptions<StringFormat>('fr', {}, 'ICU');

function getHash(): string {
  const listenerKey = getTranslateListenerKey({
    locale: 'fr',
    message,
    options: lookupOptions,
  });
  return listenerKey.slice(listenerKey.indexOf(':') + 1);
}

function Greeting() {
  const gt = useGT();
  return <span>{gt(message)}</span>;
}

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache(
    new I18nCache({
      loadTranslations: vi.fn().mockResolvedValue({}),
    })
  );
}

describe('ServerGTProvider', () => {
  beforeEach(() => {
    setup();
  });

  it('renders provider translations before they exist in the global cache', () => {
    const html = renderToString(
      <ServerGTProvider
        locale='fr'
        translations={{
          fr: {
            [getHash()]: translatedMessage,
          },
        }}
        dictionaries={{}}
      >
        <Greeting />
      </ServerGTProvider>
    );

    expect(
      getReactI18nCache().lookupTranslation('fr', message, lookupOptions)
    ).toBeUndefined();
    expect(html).toContain(translatedMessage);
  });
});
