import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateOrUpdateBrowserConditionStore,
  mockDetermineLocaleClient,
  mockGetPathnameForLocale,
  mockInitializeReactGT,
  pluginModule,
} = vi.hoisted(() => ({
  mockCreateOrUpdateBrowserConditionStore: vi.fn(),
  mockDetermineLocaleClient: vi.fn(() => 'fr'),
  mockGetPathnameForLocale: vi.fn(() => '/fr/about'),
  mockInitializeReactGT: vi.fn(),
  pluginModule: {
    config: undefined as Record<string, unknown> | undefined,
    loadTranslations: undefined,
    dictionary: undefined,
    loadDictionary: undefined,
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

vi.mock('../../functions/localeRouting', () => ({
  getPathnameForLocale: mockGetPathnameForLocale,
}));

// Initialization runs once per module instance, so each case loads fresh
// modules with its own plugin config.
async function initializeWith(config: Record<string, unknown>) {
  pluginModule.config = config;
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
    mockGetPathnameForLocale.mockClear();
    mockInitializeReactGT.mockReset();
    vi.unstubAllGlobals();
  });

  it('reloads through the locale pathname when locale routing is enabled', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/ar/about?view=full#bio',
        pathname: '/ar/about',
        search: '?view=full',
        hash: '#bio',
        assign,
      },
    });
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr', 'ar'],
      localeRouting: true,
    };

    await initializeWith(config);

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls[0][0];
    browserConfig._reload({ locale: 'fr' });
    expect(mockGetPathnameForLocale).toHaveBeenCalledWith('/ar/about', 'fr');
    expect(assign).toHaveBeenCalledWith(
      'https://example.com/fr/about?view=full#bio'
    );
  });

  it('passes the initialized route reload to the provider', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/fr/products?view=full#details',
        pathname: '/fr/products',
        assign,
      },
    });
    const { GTProvider, getClientReload } = await initializeWith({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'de'],
      localeRouting: true,
    });

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls.at(-1)![0];
    const props = { locale: 'fr', translations: {} };
    const provider = GTProvider(props);
    expect(getClientReload()).toBe(browserConfig._reload);
    expect(provider.props._reload).toBe(browserConfig._reload);

    mockGetPathnameForLocale.mockReturnValueOnce('/de/products');
    provider.props._reload({
      locale: 'de',
      region: undefined,
      enableI18n: true,
    });
    expect(mockGetPathnameForLocale).toHaveBeenCalledWith('/fr/products', 'de');
    expect(assign).toHaveBeenCalledWith(
      'https://example.com/de/products?view=full#details'
    );
  });

  it('keeps protocol-relative pathnames on the current origin', async () => {
    const assign = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://example.com/fr//evil.example?view=full#bio',
        pathname: '/fr//evil.example',
        search: '?view=full',
        hash: '#bio',
        assign,
      },
    });
    mockGetPathnameForLocale.mockReturnValueOnce('//evil.example');

    await initializeWith({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      localeRouting: true,
    });

    const browserConfig =
      mockCreateOrUpdateBrowserConditionStore.mock.calls[0][0];
    browserConfig._reload({ locale: 'en' });
    expect(assign).toHaveBeenCalledWith(
      'https://example.com//evil.example?view=full#bio'
    );
  });

  it('initializes React with the cookie locale', async () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    await initializeWith(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockDetermineLocaleClient).toHaveBeenCalledWith(config);
    expect(mockCreateOrUpdateBrowserConditionStore).toHaveBeenCalledWith({
      ...config,
      locale: 'fr',
    });
    expect(mockInitializeReactGT.mock.invocationCallOrder[0]).toBeLessThan(
      mockDetermineLocaleClient.mock.invocationCallOrder[0]
    );
  });

  it('exposes the initialized locale routing setting', async () => {
    const routed = await initializeWith({
      defaultLocale: 'en',
      locales: ['en'],
      localeRouting: true,
    });
    expect(routed.isLocaleRoutingEnabled()).toBe(true);

    const unrouted = await initializeWith({
      defaultLocale: 'en',
      locales: ['en'],
    });
    expect(unrouted.isLocaleRoutingEnabled()).toBe(false);
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
    vi.resetModules();
    const { ensureInitialized } = await import('../initializeGT.client');
    ensureInitialized();
    expect(mockInitializeReactGT).not.toHaveBeenCalled();
  });
});
