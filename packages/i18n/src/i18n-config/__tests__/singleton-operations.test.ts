import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: {
    i18n?: {
      i18nConfig?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

function resetI18nConfigGlobal() {
  const globalObj = globalThis as TestGlobal;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
}

describe('i18n config singleton operations', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    resetI18nConfigGlobal();
  });

  it('throws when the config has not been initialized', async () => {
    const { getI18nConfig, isI18nConfigInitialized } =
      await import('../singleton-operations');

    expect(isI18nConfigInitialized()).toBe(false);
    expect(() => getI18nConfig()).toThrow(
      'Cannot read I18nConfig before it has been initialized'
    );
    expect(isI18nConfigInitialized()).toBe(false);
  });

  it('returns the initialized config', async () => {
    const { getI18nConfig, initializeI18nConfig, isI18nConfigInitialized } =
      await import('../singleton-operations');

    const config = initializeI18nConfig({
      defaultLocale: 'fr',
    });

    expect(isI18nConfigInitialized()).toBe(true);
    expect(getI18nConfig()).toBe(config);
    expect(getI18nConfig().getLocales()).toEqual(['fr']);
  });

  it('shares the initialized config across module reloads', async () => {
    const { initializeI18nConfig } = await import('../singleton-operations');

    const config = initializeI18nConfig({
      defaultLocale: 'fr',
    });

    vi.resetModules();
    const { getI18nConfig, isI18nConfigInitialized } =
      await import('../singleton-operations');

    expect(isI18nConfigInitialized()).toBe(true);
    expect(getI18nConfig()).toBe(config);
  });

  it('warns and preserves an existing global config', async () => {
    const { getI18nConfig, initializeI18nConfig } =
      await import('../singleton-operations');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = initializeI18nConfig({
      defaultLocale: 'en',
    });
    initializeI18nConfig({
      defaultLocale: 'fr',
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Global i18nConfig singleton instance was already initialized'
      )
    );
    expect(getI18nConfig()).toBe(config);
  });

  it('preserves existing i18n global fields when setting config', async () => {
    const globalObj = globalThis as TestGlobal;
    globalObj.__generaltranslation ??= {};
    globalObj.__generaltranslation.i18n = {
      marker: true,
    };
    const { initializeI18nConfig } = await import('../singleton-operations');

    initializeI18nConfig({
      defaultLocale: 'en',
    });

    expect(globalObj.__generaltranslation.i18n.marker).toBe(true);
  });

  it('stores the GT services enabled flag on the config singleton', async () => {
    const { getI18nConfig, initializeI18nConfig } =
      await import('../singleton-operations');

    const config = initializeI18nConfig({
      projectId: 'test-project',
    });

    expect(config.isGTServicesEnabled()).toBe(true);
    expect(getI18nConfig().isGTServicesEnabled()).toBe(true);
  });
});
