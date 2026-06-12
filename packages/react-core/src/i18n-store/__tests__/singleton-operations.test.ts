import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { I18nStore } from '../I18nStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      marker?: string;
      [key: string]: unknown;
    };
    reactCore?: {
      i18nStore?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetI18nStoreGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.reactCore) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.reactCore,
      'i18nStore'
    );
  }
}

function createI18nStoreStub(): I18nStore {
  return {} as I18nStore;
}

describe('react-core i18n store singleton operations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    resetI18nStoreGlobal();
  });

  it('shares the i18n store across module reloads', async () => {
    const { setI18nStore } = await import('../singleton-operations');
    const store = createI18nStoreStub();

    setI18nStore(store);

    vi.resetModules();
    const { getI18nStore, isI18nStoreInitialized } =
      await import('../singleton-operations');

    expect(isI18nStoreInitialized()).toBe(true);
    expect(getI18nStore()).toBe(store);
  });

  it('warns when overwriting an existing global i18n store', async () => {
    const { setI18nStore } = await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    setI18nStore(createI18nStoreStub());
    setI18nStore(createI18nStoreStub());

    expect(warn).toHaveBeenCalledWith(
      '@generaltranslation/react-core: Overwriting global i18nStore singleton instance.'
    );
  });

  it('preserves existing package globals when setting the i18n store', async () => {
    const globalObj = globalThis as TestGlobal;
    globalObj.__generaltranslation ??= {};
    globalObj.__generaltranslation.i18n = {
      marker: 'keep',
    };
    const { setI18nStore } = await import('../singleton-operations');

    setI18nStore(createI18nStoreStub());

    expect(globalObj.__generaltranslation.i18n.marker).toBe('keep');
  });
});
