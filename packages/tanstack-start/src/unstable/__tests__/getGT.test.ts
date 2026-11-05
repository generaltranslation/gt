import { hashSource } from 'generaltranslation/id';
import {
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { msg } from 'gt-i18n/unstable';
import { createUnstableGetGT, createUnstableGetMessages } from '../getGT';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const saveTree = ['Save'];
const frenchTranslations = {
  [hashSource({ source: saveTree, dataFormat: 'ICU_TREE' })]: ['Enregistrer'],
};

function createStore(locale: string): ReadonlyConditionStoreInterface {
  return {
    getLocale: () => locale,
    getEnableI18n: () => true,
  } as ReadonlyConditionStoreInterface;
}

describe('createUnstableGetGT', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] });
    setI18nCache(
      new I18nCache({
        loadTranslations: async (locale: string) =>
          locale === 'fr' ? frenchTranslations : {},
      })
    );
  });

  it('returns a GT bound to the store locale at call time', async () => {
    let store = createStore('fr');
    const getGT = createUnstableGetGT(() => store);

    expect((await getGT())`Save`).toBe('Enregistrer');

    store = createStore('en');
    expect((await getGT())`Save`).toBe('Save');
  });

  it('returns an m bound to the store locale at call time', async () => {
    let store = createStore('fr');
    const getMessages = createUnstableGetMessages(() => store);

    expect((await getMessages())(msg('Save'))).toBe('Enregistrer');

    store = createStore('en');
    expect((await getMessages())(msg('Save'))).toBe('Save');
  });
});
