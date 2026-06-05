import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('react i18n config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('stores render strategy on the I18nConfig singleton', async () => {
    const { getI18nConfig: getBaseI18nConfig } =
      await import('gt-i18n/internal');
    const { getI18nConfig, initializeI18nConfig } =
      await import('../i18nConfig');

    const config = initializeI18nConfig({ defaultLocale: 'en' }, 'SPA');

    expect(getI18nConfig()).toBe(config);
    expect(getBaseI18nConfig()).toBe(config);
    expect(getI18nConfig().getRenderStrategy()).toBe('SPA');
  });

  it('rejects base I18nConfig setup without render strategy support', async () => {
    const { initializeI18nConfig } = await import('gt-i18n/internal');
    const { getI18nConfig } = await import('../i18nConfig');

    initializeI18nConfig({ defaultLocale: 'en' });

    expect(() => getI18nConfig()).toThrow(
      /Cannot read ReactI18nConfig after base I18nConfig setup/
    );
  });
});
