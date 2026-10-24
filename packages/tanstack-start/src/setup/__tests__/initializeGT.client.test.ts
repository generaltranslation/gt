import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateOrUpdateBrowserConditionStore,
  mockDetermineLocaleClient,
  mockInitializeReactGT,
  mockReload,
  pluginModule,
} = vi.hoisted(() => ({
  mockCreateOrUpdateBrowserConditionStore: vi.fn(),
  mockDetermineLocaleClient: vi.fn(() => 'fr'),
  mockInitializeReactGT: vi.fn(),
  mockReload: vi.fn(),
  pluginModule: {
    config: undefined as Record<string, unknown> | undefined,
    loadTranslations: undefined,
    dictionary: undefined,
    loadDictionary: undefined,
    createLocaleReload: vi.fn(),
    getPathLocale: vi.fn(),
  },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: mockCreateOrUpdateBrowserConditionStore,
  initializeGT: mockInitializeReactGT,
  GTProvider: () => null,
}));

vi.mock('../../functions/parseLocale', () => ({
  determineLocaleClient: mockDetermineLocaleClient,
}));

// Initialization runs once per global setup, so each case clears it and loads
// fresh modules with its own plugin config.
async function initializeWith(config: Record<string, unknown>) {
  pluginModule.config = config;
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  vi.resetModules();
  const setup = await import('../initializeGT.client');
  const { GTProvider } = await import('../../provider/GTProvider.client');
  setup.ensureInitialized();
  return { ...setup, GTProvider };
}

describe.sequential('client initialization', () => {
  beforeEach(() => {
    mockCreateOrUpdateBrowserConditionStore.mockReset();
    mockDetermineLocaleClient.mockClear();
    mockInitializeReactGT.mockReset();
    // Locale routing off, as localeRouting.disabled exports it.
    pluginModule.createLocaleReload.mockReset();
    pluginModule.getPathLocale.mockReset();
  });

  it('uses the locale routing reload and pathname locale from the config module', async () => {
    pluginModule.createLocaleReload.mockReturnValue(mockReload);
    pluginModule.getPathLocale.mockReturnValue('ar');
    const config = { defaultLocale: 'en', locales: ['en', 'fr', 'ar'] };

    const { GTProvider, getClientReload } = await initializeWith(config);

    expect(mockDetermineLocaleClient).toHaveBeenCalledWith(config, 'ar');
    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledWith({
      ...config,
      _reload: mockReload,
      locale: 'fr',
    });
    expect(getClientReload()).toBe(mockReload);
    expect(GTProvider({ locale: 'fr', translations: {} }).props._reload).toBe(
      mockReload
    );
  });

  it('initializes React with the cookie locale', async () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    await initializeWith(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockDetermineLocaleClient).toHaveBeenCalledWith(config, undefined);
    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledWith({
      ...config,
      _reload: undefined,
      locale: 'fr',
    });
    expect(mockInitializeReactGT.mock.invocationCallOrder[0]).toBeLessThan(
      mockDetermineLocaleClient.mock.invocationCallOrder[0]
    );
  });

  it('initializes once, and not without the plugin', async () => {
    const setup = await initializeWith({
      defaultLocale: 'en',
      locales: ['en'],
    });
    setup.ensureInitialized();
    expect(mockInitializeReactGT).toHaveBeenCalledOnce();

    mockInitializeReactGT.mockReset();
    pluginModule.config = undefined;
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    vi.resetModules();
    const { ensureInitialized } = await import('../initializeGT.client');
    ensureInitialized();
    expect(mockInitializeReactGT).not.toHaveBeenCalled();
  });
});
