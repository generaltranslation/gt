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

  it('defaults public pure initialization to server-render', async () => {
    const { getI18nConfig: getBaseI18nConfig } =
      await import('gt-i18n/internal');
    const { getI18nConfig, initializeI18nConfig } = await import('../../pure');

    const config = initializeI18nConfig({ defaultLocale: 'en' });

    expect(getI18nConfig()).toBe(config);
    expect(getBaseI18nConfig()).toBe(config);
    expect(getI18nConfig().getRenderStrategy()).toBe('server-render');
  });

  it('rejects invalid runtime render strategy values', async () => {
    const { initializeI18nConfig } = await import('../i18nConfig');
    const initializeWithRuntimeRenderStrategy = initializeI18nConfig as (
      params: Parameters<typeof initializeI18nConfig>[0],
      renderStrategy: unknown
    ) => unknown;

    expect(() =>
      initializeWithRuntimeRenderStrategy({ defaultLocale: 'en' }, 'invalid')
    ).toThrow(/Invalid React render strategy/);
  });

  it('rejects base I18nConfig setup without render strategy support', async () => {
    const { initializeI18nConfig } = await import('gt-i18n/internal');
    const { getI18nConfig } = await import('../i18nConfig');

    initializeI18nConfig({ defaultLocale: 'en' });

    expect(() => getI18nConfig()).toThrow(
      /Cannot read ReactI18nConfig after base I18nConfig setup/
    );
  });

  it('accepts branded ReactI18nConfig instances from another bundled copy', async () => {
    const { I18nConfig, setI18nConfig: setBaseI18nConfig } =
      await import('gt-i18n/internal');
    const { getI18nConfig } = await import('../i18nConfig');

    const bundledConfig = new I18nConfig({ defaultLocale: 'en' });
    Object.defineProperty(
      bundledConfig,
      Symbol.for('generaltranslation.react-core.ReactI18nConfig'),
      { value: true }
    );
    Object.defineProperty(bundledConfig, 'getRenderStrategy', {
      value: () => 'SPA',
    });

    setBaseI18nConfig(bundledConfig);

    expect(getI18nConfig()).toBe(bundledConfig);
    expect(getI18nConfig().getRenderStrategy()).toBe('SPA');
  });
});
