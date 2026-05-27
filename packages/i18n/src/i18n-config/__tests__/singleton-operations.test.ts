import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('i18n config singleton operations', () => {
  beforeEach(() => {
    vi.resetModules();
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
});
