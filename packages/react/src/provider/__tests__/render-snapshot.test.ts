import { createElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig, ReadonlyConditionStore } from 'gt-i18n/internal';
import { InternalGTProvider } from '../../../../react-core/src/context/InternalGTProvider';
import { T } from '../../../../react-core/src/components/translation/T';
import { useGT } from '../../../../react-core/src/hooks/useGT';
import { useTranslations } from '../../../../react-core/src/hooks/useTranslations';
import { setReactI18nCache } from '../../../../react-core/src/i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../../../react-core/src/condition-store/singleton-operations';
import { setRenderStrategy } from '../../../../react-core/src/setup/globals';
import type { ReactI18nCache } from '../../../../react-core/src/i18n-cache/ReactI18nCache';

const cache = {
  isDevHotReloadEnabled: vi.fn(() => false),
  lookupTranslation: vi.fn(() => undefined),
  lookupDictionary: vi.fn(() => undefined),
  lookupDictionaryObj: vi.fn(() => undefined),
  updateTranslations: vi.fn(),
  updateDictionaries: vi.fn(),
};

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setRenderStrategy('server-render');
  setReactI18nCache(cache as unknown as ReactI18nCache);
  setReadonlyConditionStore(new ReadonlyConditionStore({ locale: 'fr' }));
}

function Provider({ children }: { children: ReactNode }) {
  return createElement(
    InternalGTProvider,
    {
      translations: {
        fr: {
          'jsx-hash': 'Bonjour',
          'inline-hash': 'Salut',
        },
      },
      dictionaries: {
        en: {
          greeting: 'Hello',
        },
        fr: {
          greeting: 'Bonjour',
        },
      },
    },
    children
  );
}

describe('provider render snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders <T> from provider translations when the singleton cache misses', () => {
    const html = renderToString(
      createElement(
        Provider,
        null,
        createElement(T, { _hash: 'jsx-hash' }, 'Hello')
      )
    );

    expect(html).toBe('Bonjour');
    expect(cache.lookupTranslation).toHaveBeenCalled();
    expect(cache.updateTranslations).not.toHaveBeenCalled();
    expect(cache.updateDictionaries).not.toHaveBeenCalled();
  });

  it('renders useGT from provider translations when the singleton cache misses', () => {
    function InlineTranslation() {
      const gt = useGT();
      return createElement(
        'span',
        null,
        gt('Hello', { $_hash: 'inline-hash' })
      );
    }

    const html = renderToString(
      createElement(Provider, null, createElement(InlineTranslation))
    );

    expect(html).toBe('<span>Salut</span>');
    expect(cache.lookupTranslation).not.toHaveBeenCalled();
  });

  it('renders useTranslations from provider dictionaries when the singleton cache misses', () => {
    function DictionaryTranslation() {
      const t = useTranslations();
      return createElement('span', null, t('greeting'));
    }

    const html = renderToString(
      createElement(Provider, null, createElement(DictionaryTranslation))
    );

    expect(html).toBe('<span>Bonjour</span>');
    expect(cache.lookupDictionary).not.toHaveBeenCalled();
  });
});
