import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { initializeI18nConfig } from 'gt-i18n/internal';
import {
  setReactI18nCache,
  useGT,
  useTranslations,
} from '@generaltranslation/react-core/context';
import { ServerGTProvider } from '../ServerGTProvider';
import type { ReactI18nCache } from '@generaltranslation/react-core/context';

const lookupTranslation = vi.fn(() => undefined);
const lookupDictionary = vi.fn(() => undefined);
const lookupDictionaryObj = vi.fn(() => undefined);

function setup() {
  initializeI18nConfig({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
  });
  setReactI18nCache({
    isDevHotReloadEnabled: () => false,
    lookupTranslation,
    lookupDictionary,
    lookupDictionaryObj,
  } as unknown as ReactI18nCache);
}

function InlineGreeting() {
  const gt = useGT();
  return createElement('span', null, gt('Hello', { $id: 'hero.title' }));
}

function DictionaryGreeting() {
  const t = useTranslations('home');
  return createElement('span', null, t('title'));
}

describe('ServerGTProvider render-time lookups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('uses Provider translations on first render when the singleton cache misses', () => {
    const hash = hashSource({
      source: 'Hello',
      id: 'hero.title',
      dataFormat: 'ICU',
    });

    expect(
      renderToString(
        createElement(
          ServerGTProvider,
          {
            locale: 'fr',
            translations: {
              fr: {
                [hash]: 'Bonjour',
              },
            },
          },
          createElement(InlineGreeting)
        )
      )
    ).toBe('<span>Bonjour</span>');

    expect(lookupTranslation).not.toHaveBeenCalled();
  });

  it('uses Provider dictionaries on first render when the singleton cache misses', () => {
    expect(
      renderToString(
        createElement(
          ServerGTProvider,
          {
            locale: 'fr',
            translations: {},
            dictionaries: {
              en: {
                home: {
                  title: 'Hello',
                },
              },
              fr: {
                home: {
                  title: 'Bonjour',
                },
              },
            },
          },
          createElement(DictionaryGreeting)
        )
      )
    ).toBe('<span>Bonjour</span>');

    expect(lookupDictionary).not.toHaveBeenCalled();
    expect(lookupDictionaryObj).not.toHaveBeenCalled();
  });
});
