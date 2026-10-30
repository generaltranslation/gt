import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compatPluginModule,
  mockConditionStore,
  mockDictionaryProvider,
  mockGTProvider,
  pluginModule,
} = vi.hoisted(() => ({
  compatPluginModule: {
    dictionary: { greeting: 'Hello' },
    loadDictionary: vi.fn(async () => ({ greeting: 'Bonjour' })),
  },
  mockConditionStore: {
    getLocale: vi.fn(() => 'fr'),
    getRegion: vi.fn(() => undefined),
    getEnableI18n: vi.fn(() => true),
    isLocaleRoutingEnabled: vi.fn(() => false),
  },
  mockDictionaryProvider: vi.fn(),
  mockGTProvider: vi.fn(),
  pluginModule: { config: { cacheExpiryTime: 0 as number | null } },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);
vi.mock('gt-tanstack-start/internal/_compat-config', () => compatPluginModule);
vi.mock('gt-react', () => ({
  GTProvider: mockGTProvider,
  initializeGT: vi.fn(),
}));
vi.mock('gt-react/compat', () => ({
  GTDictionaryProvider: mockDictionaryProvider,
}));

import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import type { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import { setupRouterGTIntegration } from '../../router/setupRouterGTIntegration.server';
import type { GTRouterOptions } from '../../router/types';
import { setupRouterGTDictionaryIntegration } from '../setupRouterGTDictionaryIntegration.server';

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

function renderWrap(options: GTRouterOptions): unknown {
  return (options.Wrap as unknown as (props: { children: string }) => unknown)({
    children: 'app',
  });
}

type Element = ReactElement<{ children?: ReactNode; dictionaries?: unknown }>;

/** The element types from the outermost Wrap down to the app. */
function providerChain(element: unknown): unknown[] {
  const chain: unknown[] = [];
  let node = element;
  while (isValidElement(node)) {
    const { type, props } = node as Element;
    // Each Wrap is a function component; render it to reach its providers.
    if (type === mockGTProvider || type === mockDictionaryProvider) {
      chain.push(type);
      node = props.children;
    } else if (typeof type === 'function') {
      node = (type as (props: unknown) => unknown)(props);
    } else {
      node = props.children;
    }
  }
  return chain;
}

describe.sequential('setupRouterGTDictionaryIntegration server', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    internalInitializeGTSRA({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: async () => ({}),
    });
    setConditionStore(
      mockConditionStore as unknown as AsyncLocalConditionStore
    );
    mockConditionStore.getLocale.mockReturnValue('fr');
    compatPluginModule.loadDictionary.mockClear();
  });

  it('dehydrates the request dictionary beside the app data and renders it', async () => {
    const router = createRouter({ dehydrate: () => ({ app: true }) });
    setupRouterGTDictionaryIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toEqual({
      app: true,
      gtDictionaries: { dictionaries: { fr: { greeting: 'Bonjour' } } },
    });
    const element = renderWrap(router.options) as Element;
    expect(element.props.children).toMatchObject({
      type: mockDictionaryProvider,
      props: { dictionaries: { fr: { greeting: 'Bonjour' } } },
    });
  });

  it('honors the dictionary cache expiry across requests', async () => {
    // Each request creates its own router; the manager owns caching.
    compatPluginModule.loadDictionary
      .mockResolvedValueOnce({ greeting: 'Bonjour v1' })
      .mockResolvedValueOnce({ greeting: 'Bonjour v2' });
    const first = createRouter();
    setupRouterGTDictionaryIntegration({ router: first });
    await first.options.dehydrate?.();
    const second = createRouter();
    setupRouterGTDictionaryIntegration({ router: second });

    await expect(second.options.dehydrate?.()).resolves.toEqual({
      gtDictionaries: { dictionaries: { fr: { greeting: 'Bonjour v2' } } },
    });
    expect(compatPluginModule.loadDictionary).toHaveBeenCalledTimes(2);
  });

  it('loads no dictionary for the default locale, which is bundled', async () => {
    mockConditionStore.getLocale.mockReturnValue('en');
    const router = createRouter();
    setupRouterGTDictionaryIntegration({ router });

    await expect(router.options.dehydrate?.()).resolves.toEqual({
      gtDictionaries: { dictionaries: {} },
    });
    expect(compatPluginModule.loadDictionary).not.toHaveBeenCalled();
  });

  it.each([
    { order: 'after setupRouterGTIntegration', compatFirst: false },
    { order: 'before setupRouterGTIntegration', compatFirst: true },
  ])(
    'composes with the native integration when called $order',
    async ({ compatFirst }) => {
      const router = createRouter({ dehydrate: () => ({ app: true }) });
      if (compatFirst) setupRouterGTDictionaryIntegration({ router });
      setupRouterGTIntegration({ router });
      if (!compatFirst) setupRouterGTDictionaryIntegration({ router });

      const dehydrated = (await router.options.dehydrate?.()) as Record<
        string,
        unknown
      >;
      expect(dehydrated).toMatchObject({
        app: true,
        gt: { locale: 'fr' },
        gtDictionaries: { dictionaries: { fr: { greeting: 'Bonjour' } } },
      });
      expect(providerChain(renderWrap(router.options))).toEqual(
        compatFirst
          ? [mockDictionaryProvider, mockGTProvider]
          : [mockGTProvider, mockDictionaryProvider]
      );
    }
  );

  it('keeps native router state free of dictionaries without the compat integration', async () => {
    const router = createRouter();
    setupRouterGTIntegration({ router });

    const dehydrated = await router.options.dehydrate?.();
    expect(dehydrated).toHaveProperty('gt');
    expect(dehydrated).not.toHaveProperty('gtDictionaries');
    expect(compatPluginModule.loadDictionary).not.toHaveBeenCalled();
  });
});
