import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConditionStore,
  mockEnsureInitialized,
  mockInitializeDictionaryManager,
  mockLoadDictionary,
  mockProvider,
} = vi.hoisted(() => ({
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
  },
  mockEnsureInitialized: vi.fn(),
  mockInitializeDictionaryManager: vi.fn(),
  mockLoadDictionary: vi.fn(async (locale: string) => ({ greeting: locale })),
  mockProvider: vi.fn(
    (props: { locale: string; dictionaries?: unknown }) =>
      `${props.locale} ${JSON.stringify(props.dictionaries)}`
  ),
}));

vi.mock('gt-tanstack-start/internal/_config', () => ({ config: {} }));
vi.mock('gt-tanstack-start/internal/_compat-config', () => ({
  dictionary: { greeting: 'Hello' },
  loadDictionary: async () => ({}),
}));
vi.mock('../../setup/initializeGT.server', () => ({
  ensureInitialized: mockEnsureInitialized,
  getServerConditionStore: () => mockConditionStore,
  isLocaleRoutingEnabled: () => false,
}));
vi.mock('gt-react', () => ({ GTProvider: vi.fn() }));
vi.mock('@generaltranslation/react-core/pure', () => ({
  getTranslationsSnapshot: async (locale: string) => ({ hello: locale }),
}));
vi.mock('gt-i18n/internal', () => ({
  getDictionaryManager: () => ({ loadDictionary: mockLoadDictionary }),
  getI18nConfig: () => ({ getDefaultLocale: () => 'en' }),
  initializeDictionaryManager: mockInitializeDictionaryManager,
  isDictionaryManagerInitialized: () => false,
}));
vi.mock('gt-react/compat', () => ({ GTProvider: mockProvider }));

import type { GTRouterOptions } from '../../router/types';
import { setupRouterGTIntegration } from '../setupRouterGTIntegration.server';

function createRouter(options: GTRouterOptions = {}, isShell?: () => boolean) {
  const router = {
    options,
    isShell,
    update: vi.fn((next: Partial<GTRouterOptions>) => {
      router.options = { ...router.options, ...next };
    }),
    history: { location: { state: {} }, replace: vi.fn() },
  };
  return router;
}

describe.sequential('compat setupRouterGTIntegration server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConditionStore.getLocale.mockReturnValue('fr');
  });

  it("dehydrates the request locale's translations and dictionaries", async () => {
    const router = createRouter({ dehydrate: () => ({ app: true }) });
    setupRouterGTIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toEqual({
      app: true,
      gt: {
        locale: 'fr',
        region: undefined,
        enableI18n: true,
        translations: { hello: 'fr' },
        dictionaries: { fr: { greeting: 'fr' } },
      },
    });
    expect(mockInitializeDictionaryManager).toHaveBeenCalledOnce();
  });

  it('renders the /compat GTProvider with the dictionaries', async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });
    await router.options.dehydrate?.();

    expect(
      renderToString(
        createElement(
          router.options.Wrap as ComponentType<{ children: ReactNode }>,
          null,
          'app'
        )
      )
    ).toBe('fr {&quot;fr&quot;:{&quot;greeting&quot;:&quot;fr&quot;}}');
  });

  it('marks the state of a prerendered SPA shell', async () => {
    const router = createRouter({}, () => true);
    setupRouterGTIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toMatchObject({
      gt: { dictionaries: { fr: { greeting: 'fr' } }, shell: true },
    });
  });

  it('leaves the default locale to the bundled source dictionary', async () => {
    mockConditionStore.getLocale.mockReturnValue('en');
    const router = createRouter();
    setupRouterGTIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toMatchObject({
      gt: { dictionaries: {} },
    });
    expect(mockLoadDictionary).not.toHaveBeenCalled();
  });
});
