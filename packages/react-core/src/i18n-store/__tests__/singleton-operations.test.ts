import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import type { I18nStore } from '../I18nStore';
import { getI18nStore, setI18nStore } from '../singleton-operations';

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
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetI18nStoreGlobal();
  });

  it('shares the i18n store across module reloads', async () => {
    const store = createI18nStoreStub();

    setI18nStore(store);

    vi.resetModules();
    const reloaded = await import('../singleton-operations');

    expect(reloaded.getI18nStore).not.toBe(getI18nStore);
    expect(reloaded.isI18nStoreInitialized()).toBe(true);
    expect(reloaded.getI18nStore()).toBe(store);
  });

  it('preserves an existing global i18n store', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createI18nStoreStub();

    setI18nStore(store);
    setI18nStore(createI18nStoreStub());

    expect(warn).not.toHaveBeenCalled();
    expect(getI18nStore()).toBe(store);
  });

  it('warns about an existing global i18n store when debug logging is enabled', () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
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

  it('warns about an existing global i18n store when cached config enables debug logging', () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'DEBUG');
    initializeI18nConfig({ defaultLocale: 'en' });
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', '');

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

  it('preserves existing package globals when setting the i18n store', () => {
    const globalObj = globalThis as TestGlobal;
    globalObj.__generaltranslation ??= {};
    globalObj.__generaltranslation.i18n = {
      marker: 'keep',
    };

    setI18nStore(createI18nStoreStub());

    expect(globalObj.__generaltranslation.i18n.marker).toBe('keep');
  });
});
