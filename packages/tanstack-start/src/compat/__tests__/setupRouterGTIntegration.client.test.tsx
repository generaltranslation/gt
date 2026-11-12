import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compatPluginModule,
  mockConditionStore,
  mockInitializeDictionaryManager,
  mockIsDictionaryManagerInitialized,
  mockLoadDictionary,
  mockProvider,
} = vi.hoisted(() => ({
  compatPluginModule: {
    dictionary: { greeting: 'Hello' },
    loadDictionary: async () => ({}),
  },
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
  },
  mockInitializeDictionaryManager: vi.fn(),
  mockIsDictionaryManagerInitialized: vi.fn(() => false),
  mockLoadDictionary: vi.fn(async (locale: string) => ({ greeting: locale })),
  mockProvider: vi.fn(
    (props: { locale: string; dictionaries?: unknown }) =>
      `${props.locale} ${JSON.stringify(props.dictionaries)}`
  ),
}));

vi.mock('gt-tanstack-start/internal/_config', () => ({ config: {} }));
vi.mock('gt-tanstack-start/internal/_compat-config', () => compatPluginModule);
vi.mock('gt-tanstack-start/internal/localeRouting', () => ({
  getRouterLocaleRewrite: () => undefined,
  replaceWithLocaleURL: vi.fn(),
}));
vi.mock('../../setup/initializeGT.client', () => ({
  ensureInitialized: vi.fn(),
  getClientReload: vi.fn(),
}));
vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: vi.fn(),
}));
vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockConditionStore,
  getTranslationsSnapshot: async (locale: string) => ({ hello: locale }),
}));
vi.mock('gt-i18n/internal', () => ({
  // The browser translations cache never expires unless configured.
  getI18nCache: () => ({ getCacheExpiryTime: () => null }),
  getI18nConfig: () => ({ getDefaultLocale: () => 'en' }),
}));
vi.mock('gt-i18n/internal/compat', () => ({
  getDictionaryManager: () => ({ loadDictionary: mockLoadDictionary }),
  initializeDictionaryManager: mockInitializeDictionaryManager,
  isDictionaryManagerInitialized: mockIsDictionaryManagerInitialized,
}));
vi.mock('gt-react/compat', () => ({ GTProvider: mockProvider }));

import type { GTRouterOptions } from '../../router/types';
import { setupRouterGTIntegration } from '../setupRouterGTIntegration.client';

function createRouter(options: GTRouterOptions = {}) {
  const router = {
    options,
    update: vi.fn((next: Partial<GTRouterOptions>) => {
      router.options = { ...router.options, ...next };
    }),
    history: { location: { state: {} }, replace: vi.fn() },
  };
  return router;
}

function render(options: GTRouterOptions) {
  return renderToString(
    createElement(
      options.Wrap as ComponentType<{ children: ReactNode }>,
      null,
      'app'
    )
  );
}

function renderOrSuspend(options: GTRouterOptions): unknown {
  try {
    return (
      options.Wrap as unknown as (props: { children: string }) => unknown
    )({ children: 'app' });
  } catch (thrown) {
    return thrown;
  }
}

describe.sequential('compat setupRouterGTIntegration client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConditionStore.getLocale.mockReturnValue('fr');
  });

  it("renders the server's translations and dictionaries without loading", async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await router.options.hydrate?.({
      gt: {
        locale: 'fr',
        enableI18n: true,
        translations: {},
        dictionaries: { fr: { greeting: 'Bonjour SSR' } },
      },
    });

    expect(render(router.options)).toBe(
      'fr {&quot;fr&quot;:{&quot;greeting&quot;:&quot;Bonjour SSR&quot;}}'
    );
    expect(mockLoadDictionary).not.toHaveBeenCalled();
    // The source dictionary is in the manager before the provider renders.
    expect(mockInitializeDictionaryManager).toHaveBeenCalledWith({
      dictionary: compatPluginModule.dictionary,
      loadDictionary: compatPluginModule.loadDictionary,
      cacheExpiryTime: null,
    });
  });

  it("loads the visitor's translations and dictionaries for client-only roots", async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await renderOrSuspend(router.options);

    expect(mockProvider).not.toHaveBeenCalled();
    expect(render(router.options)).toBe(
      'fr {&quot;fr&quot;:{&quot;greeting&quot;:&quot;fr&quot;}}'
    );
    expect(mockProvider).toHaveBeenLastCalledWith(
      expect.objectContaining({ translations: { hello: 'fr' } }),
      undefined
    );
  });

  it("hydrates a prerendered shell with the shell's dictionaries, then renders the visitor's", async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await router.options.hydrate?.({
      gt: {
        locale: 'de',
        enableI18n: true,
        translations: {},
        dictionaries: { de: { greeting: 'Hallo' } },
        shell: true,
      },
    });

    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    // React renders the server snapshot while hydrating, so the first render
    // must match the shell HTML.
    expect(render(router.options)).toBe(
      'de {&quot;de&quot;:{&quot;greeting&quot;:&quot;Hallo&quot;}}'
    );
  });

  it('keeps throwing a dictionary load failure from Wrap', async () => {
    const error = new Error('dictionary failed');
    mockLoadDictionary.mockRejectedValueOnce(error);
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await expect(renderOrSuspend(router.options)).rejects.toBe(error);
    expect(renderOrSuspend(router.options)).toBe(error);
    expect(renderOrSuspend(router.options)).toBe(error);
    expect(mockLoadDictionary).toHaveBeenCalledOnce();
  });
});
