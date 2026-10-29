import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compatPluginModule,
  mockConditionStore,
  mockDictionaryProvider,
  mockIsDictionaryManagerInitialized,
  mockInitializeDictionaryManager,
  mockLoadDictionary,
} = vi.hoisted(() => ({
  compatPluginModule: {
    dictionary: { greeting: 'Hello' },
    loadDictionary: async () => ({}),
  },
  mockConditionStore: { getLocale: vi.fn(() => 'fr') },
  mockDictionaryProvider: vi.fn(),
  mockIsDictionaryManagerInitialized: vi.fn(() => false),
  mockInitializeDictionaryManager: vi.fn(),
  mockLoadDictionary: vi.fn(async (locale: string) => ({ greeting: locale })),
}));

vi.mock('gt-tanstack-start/internal/_config', () => ({ config: {} }));
vi.mock('gt-tanstack-start/internal/_compat-config', () => compatPluginModule);
vi.mock('@generaltranslation/react-core/pure', () => ({
  getReadonlyConditionStore: () => mockConditionStore,
}));
vi.mock('gt-i18n/internal', () => ({
  getDictionaryManager: () => ({ loadDictionary: mockLoadDictionary }),
  getI18nConfig: () => ({ getDefaultLocale: () => 'en' }),
  initializeDictionaryManager: mockInitializeDictionaryManager,
  isDictionaryManagerInitialized: mockIsDictionaryManagerInitialized,
}));
vi.mock('gt-react/compat', () => ({
  GTDictionaryProvider: mockDictionaryProvider,
}));

import type { GTRouterOptions } from '../../router/types';
import { setupRouterGTDictionaryIntegration } from '../setupRouterGTDictionaryIntegration.client';

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

type Element = ReactElement<{
  children: ReactElement<{ dictionaries: unknown; children: ReactNode }>;
}>;

function renderOrSuspend(options: GTRouterOptions): Element | unknown {
  try {
    return (
      options.Wrap as unknown as (props: { children: string }) => unknown
    )({ children: 'app' });
  } catch (thrown) {
    return thrown;
  }
}

describe.sequential('setupRouterGTDictionaryIntegration client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConditionStore.getLocale.mockReturnValue('fr');
  });

  it('hydrates from the server snapshot without loading a dictionary', async () => {
    const appHydrate = vi.fn();
    const router = createRouter({ hydrate: appHydrate });
    setupRouterGTDictionaryIntegration({ router });
    const dehydrated = {
      gtDictionaries: { dictionaries: { fr: { greeting: 'Bonjour SSR' } } },
    };

    await router.options.hydrate?.(dehydrated);
    const element = renderOrSuspend(router.options) as Element;

    expect(mockLoadDictionary).not.toHaveBeenCalled();
    expect(appHydrate).toHaveBeenCalledWith(dehydrated);
    expect(element.props.children).toMatchObject({
      type: mockDictionaryProvider,
      props: { dictionaries: { fr: { greeting: 'Bonjour SSR' } } },
    });
    // The source dictionary is in the manager before the provider renders.
    expect(mockInitializeDictionaryManager).toHaveBeenCalledWith({
      dictionary: compatPluginModule.dictionary,
      loadDictionary: compatPluginModule.loadDictionary,
      cacheExpiryTime: null,
    });
  });

  it('loads the visitor dictionary for client-only roots', async () => {
    const router = createRouter();
    setupRouterGTDictionaryIntegration({ router });

    const suspended = renderOrSuspend(router.options);
    expect(suspended).toBeInstanceOf(Promise);
    expect(renderOrSuspend(router.options)).toBe(suspended);
    await suspended;

    expect(
      (renderOrSuspend(router.options) as Element).props.children.props
        .dictionaries
    ).toEqual({ fr: { greeting: 'fr' } });
  });

  it("keeps a prerendered shell's dictionaries and loads the visitor's before hydrating", async () => {
    const router = createRouter();
    setupRouterGTDictionaryIntegration({ router });

    await router.options.hydrate?.({
      gtDictionaries: {
        dictionaries: { de: { greeting: 'Hallo' } },
        shell: true,
      },
    });

    expect(mockLoadDictionary).toHaveBeenCalledWith('fr');
    expect(
      (renderOrSuspend(router.options) as Element).props.children.props
        .dictionaries
    ).toEqual({ de: { greeting: 'Hallo' }, fr: { greeting: 'fr' } });
  });

  it('chains the existing hydrate and Wrap', async () => {
    const order: string[] = [];
    const OriginalWrap = vi.fn(({ children }: { children: ReactNode }) => (
      <>{children}</>
    ));
    const router = createRouter({
      hydrate: () => {
        order.push('app');
      },
      Wrap: OriginalWrap,
    });
    setupRouterGTDictionaryIntegration({ router });

    await router.options.hydrate?.({
      gtDictionaries: { dictionaries: {} },
    });
    const element = renderOrSuspend(router.options) as Element;

    expect(order).toEqual(['app']);
    expect(element.type).toBe(OriginalWrap);
  });
});
