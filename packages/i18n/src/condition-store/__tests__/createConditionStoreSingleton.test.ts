import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadonlyConditionStoreInterface } from '../../i18n-cache/types';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      conditionStore?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetConditionStoreGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.i18n,
      'conditionStore'
    );
  }
}

function createConditionStoreStub(): ReadonlyConditionStoreInterface {
  return {
    getLocale: () => 'en',
    getRegion: () => undefined,
    getEnableI18n: () => true,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  };
}

describe('condition store singleton factory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    resetConditionStoreGlobal();
  });

  it('shares the condition store across module reloads', async () => {
    const { createConditionStoreSingleton } =
      await import('../createConditionStoreSingleton');
    const conditionStore = createConditionStoreStub();

    createConditionStoreSingleton('not initialized').setConditionStore(
      conditionStore
    );

    vi.resetModules();
    const { createConditionStoreSingleton: createReloadedSingleton } =
      await import('../createConditionStoreSingleton');

    expect(createReloadedSingleton('not initialized').getConditionStore()).toBe(
      conditionStore
    );
  });

  it('warns and preserves an existing global condition store', async () => {
    const { createConditionStoreSingleton } =
      await import('../createConditionStoreSingleton');
    const singleton = createConditionStoreSingleton('not initialized');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const conditionStore = createConditionStoreStub();

    singleton.setConditionStore(conditionStore);
    singleton.setConditionStore(createConditionStoreStub());

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Overwriting global conditionStore singleton instance'
      )
    );
    expect(singleton.getConditionStore()).toBe(conditionStore);
  });
});
