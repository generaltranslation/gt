import { hashSource } from 'generaltranslation/id';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { pluginModule } = vi.hoisted(() => ({
  pluginModule: {
    config: { defaultLocale: 'en', locales: ['en', 'fr'] },
    loadTranslations: vi.fn(async (locale: string) =>
      locale === 'fr' ? { [saveHash()]: 'Enregistrer' } : {}
    ),
  },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);
vi.mock('gt-tanstack-start/internal/_compat-config', () => ({
  dictionary: {},
  loadDictionary: async () => ({}),
}));

function saveHash() {
  return hashSource({ source: 'Save', dataFormat: 'MESSAGE_TREE' });
}

// The production branch is chosen when the module loads.
async function loadProductionModules() {
  vi.stubEnv('NODE_ENV', 'production');
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  vi.resetModules();
  const pure = await import('@generaltranslation/react-core/pure');
  pure.initializeI18nConfig(pluginModule.config);
  const internal = await import('gt-i18n/internal');
  return { pure, internal, ...(await import('../translations.client')) };
}

describe.sequential('production client translations', () => {
  afterEach(() => {
    pluginModule.loadTranslations.mockClear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('loads a locale into the snapshot once and translates from it without an i18nCache', async () => {
    const { pure, internal, loadClientGTParams, loadClientTranslations } =
      await loadProductionModules();

    const t = internal.createGT(
      await loadClientGTParams({ locale: 'fr', enableI18n: true })
    );
    expect(t`Save`).toBe('Enregistrer');
    await expect(loadClientTranslations('fr')).resolves.toEqual({
      fr: { [saveHash()]: 'Enregistrer' },
    });

    expect(pluginModule.loadTranslations).toHaveBeenCalledOnce();
    expect(pure.isGlobalTranslationsSnapshotInitialized()).toBe(true);
    expect(() => pure.getReactI18nCache()).toThrow();
  });

  it("reads the server's translations without loading", async () => {
    const { internal, hydrateClientTranslations, loadClientGTParams } =
      await loadProductionModules();

    hydrateClientTranslations({ fr: { [saveHash()]: 'Sauver' } });
    const t = internal.createGT(
      await loadClientGTParams({ locale: 'fr', enableI18n: true })
    );

    expect(t`Save`).toBe('Sauver');
    expect(pluginModule.loadTranslations).not.toHaveBeenCalled();
  });

  it('loads a locale again after a failed load, into the translations the provider holds', async () => {
    const { loadClientGTParams, loadClientTranslations } =
      await loadProductionModules();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pluginModule.loadTranslations.mockRejectedValueOnce(new Error('offline'));

    const providerTranslations = await loadClientTranslations('fr');
    expect(providerTranslations).toEqual({});
    await loadClientGTParams({ locale: 'fr', enableI18n: true });

    expect(providerTranslations).toEqual({
      fr: { [saveHash()]: 'Enregistrer' },
    });
    expect(pluginModule.loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('shares loads with the /compat i18nCache', async () => {
    const { pure, loadClientTranslations } = await loadProductionModules();
    const { ensureDictionaryManager } =
      await import('../../compat/dictionaryManager.client');

    ensureDictionaryManager();
    const [cached] = await Promise.all([
      pure.getReactI18nCache().loadTranslations('fr'),
      loadClientTranslations('fr'),
    ]);

    expect(cached).toEqual({ [saveHash()]: 'Enregistrer' });
    expect(pluginModule.loadTranslations).toHaveBeenCalledOnce();
  });
});
