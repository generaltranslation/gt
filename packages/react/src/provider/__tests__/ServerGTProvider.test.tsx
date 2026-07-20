import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { useLocale } from '@generaltranslation/react-core/hooks';
import { ServerGTProvider } from '../ServerGTProvider';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
  };
};

function resetConditionStoreSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.i18n,
      'conditionStore'
    );
  }
}

function LocaleValue() {
  return <span>{useLocale()}</span>;
}

describe('ServerGTProvider', () => {
  afterEach(resetConditionStoreSingleton);

  it('reuses an initialized request condition store', () => {
    resetConditionStoreSingleton();
    const ambientConditionStore: ReadonlyConditionStoreInterface = {
      getLocale: () => 'fr',
      getRegion: () => 'FR',
      getEnableI18n: () => false,
      setLocale: () => {},
      setRegion: () => {},
      setEnableI18n: () => {},
    };
    const { setConditionStore } =
      createConditionStoreSingleton<ReadonlyConditionStoreInterface>(
        'ConditionStore is unavailable'
      );
    setConditionStore(ambientConditionStore);

    const markup = renderToStaticMarkup(
      <ServerGTProvider locale='en' translations={{ en: {} }}>
        <LocaleValue />
      </ServerGTProvider>
    );

    expect(markup).toContain('<span>fr</span>');
  });
});
