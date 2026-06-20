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

  it('accepts branded react i18n config instances from another bundle', async () => {
    const { I18nConfig, setI18nConfig: setBaseI18nConfig } =
      await import('gt-i18n/internal');
    const { getI18nConfig } = await import('../i18nConfig');
    const reactI18nConfigBrand = Symbol.for(
      '@generaltranslation/react-core/ReactI18nConfig'
    );

    class CrossBundleReactI18nConfig extends I18nConfig {
      constructor() {
        super({ defaultLocale: 'en' });
        Object.defineProperty(this, reactI18nConfigBrand, { value: true });
      }
    }

    const config = new CrossBundleReactI18nConfig();
    setBaseI18nConfig(config);

    expect(getI18nConfig()).toBe(config);
  });
});
