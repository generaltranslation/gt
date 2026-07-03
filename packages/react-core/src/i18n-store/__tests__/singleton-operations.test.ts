import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { I18nStore } from '../I18nStore';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      i18nConfig?: unknown;
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
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
}

function createI18nStoreStub(): I18nStore {
  return {} as I18nStore;
}

describe('react-core i18n store singleton operations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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

  it('preserves an existing global i18n store', async () => {
    const { getI18nStore, setI18nStore } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createI18nStoreStub();

    setI18nStore(store);
    setI18nStore(createI18nStoreStub());

    expect(warn).not.toHaveBeenCalled();
    expect(getI18nStore()).toBe(store);
  });

  it('warns about an existing global i18n store when debug logging is enabled', async () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
    const { getI18nStore, setI18nStore } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createI18nStoreStub();

    setI18nStore(store);
    setI18nStore(createI18nStoreStub());

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Global i18nStore singleton instance was already initialized'
      )
    );
    expect(getI18nStore()).toBe(store);
  });

  it('warns about an existing global i18n store when cached config enables debug logging', async () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
    const { initializeI18nConfig } = await import('../../setup/i18nConfig');

    initializeI18nConfig({ defaultLocale: 'en' });
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', '');

    const { getI18nStore, setI18nStore } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createI18nStoreStub();

    setI18nStore(store);
    setI18nStore(createI18nStoreStub());

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Global i18nStore singleton instance was already initialized'
      )
    );
    expect(getI18nStore()).toBe(store);
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
