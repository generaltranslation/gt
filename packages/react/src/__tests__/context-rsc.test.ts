import { describe, expect, it, vi } from 'vitest';
import {
  createConditionStoreSingleton,
  getI18nConfig,
  initializeI18nConfig,
  type ReadonlyConditionStoreInterface,
} from 'gt-i18n/internal';

describe('gt-react react-server surface', () => {
  it('exposes configured locale spellings without changing the internal list', async () => {
    const { useLocale, useLocales } = await import('../index.rsc');
    try {
      initializeI18nConfig({
        defaultLocale: 'en-us',
        locales: ['en-us', 'en-gb'],
        customMapping: {
          'en-us': { code: 'en-US' },
          'en-gb': { code: 'en-GB' },
        },
      });
      const { setConditionStore } =
        createConditionStoreSingleton<ReadonlyConditionStoreInterface>(
          'Test condition store is not initialized'
        );
      setConditionStore({
        getLocale: () => 'en-gb',
        getEnableI18n: () => true,
      });
      expect(useLocale()).toBe('en-gb');
      expect(useLocales()).toEqual(['en-us', 'en-gb']);
      expect(getI18nConfig().getLocales()).toEqual(['en-us', 'en-gb']);
    } finally {
      const registry = Reflect.get(globalThis, '__generaltranslation');
      if (registry) Reflect.deleteProperty(registry, 'i18n');
    }
  });

  it('initializeGT resolves credentials from the environment', async () => {
    vi.stubEnv('GT_PROJECT_ID', 'env-project-id');
    vi.stubEnv('GT_API_KEY', 'env-api-key');
    const { initializeGT } = await import('../index.rsc');
    try {
      initializeGT({ defaultLocale: 'en', loadTranslations: async () => ({}) });
      expect(getI18nConfig().getTranslationRuntime()).toMatchObject({
        projectId: 'env-project-id',
        apiKey: 'env-api-key',
      });
    } finally {
      vi.unstubAllEnvs();
      const registry = Reflect.get(globalThis, '__generaltranslation');
      if (registry) Reflect.deleteProperty(registry, 'i18n');
    }
  });

  it('exports the RSC context surface', async () => {
    const mod = await import('../index.rsc');
    expect(mod.Branch).toBeTypeOf('function');
    expect('GtInternalBranch' in mod).toBe(false);
    expect(mod.Currency).toBeTypeOf('function');
    expect(mod.DateTime).toBeTypeOf('function');
    expect(mod.Derive).toBeTypeOf('function');
    expect('GtInternalDerive' in mod).toBe(false);
    expect(mod.Num).toBeTypeOf('function');
    expect(mod.Plural).toBeTypeOf('function');
    expect(mod.RelativeTime).toBeTypeOf('function');
    expect('RscT' in mod).toBe(false);
    expect(mod.T).toBeTypeOf('function');
    expect(mod.GtInternalTranslateJsx).toBeTypeOf('function');
    expect(mod.Var).toBeTypeOf('function');
    expect(mod.GtInternalVar).toBeTypeOf('function');
    expect('getFormatLocales' in mod).toBe(false);
    expect('getPluralBranch' in mod).toBe(false);
    expect('renderVariable' in mod).toBe(false);
    expect(mod.GTProvider).toBeTypeOf('function');
    expect(mod.LocaleSelector).toBeTypeOf('function');
    expect(mod.parseLocale).toBeTypeOf('function');
  });
});
