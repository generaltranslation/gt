import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConditionStore,
  mockInitializeReactGT,
  mockStoreConstructor,
  pluginModule,
} = vi.hoisted(() => {
  const conditionStore = {
    id: 'condition-store',
    isLocaleRoutingEnabled: vi.fn(() => true),
  };
  return {
    mockConditionStore: conditionStore,
    mockInitializeReactGT: vi.fn(),
    mockStoreConstructor: vi.fn(function () {
      return conditionStore;
    }),
    pluginModule: {
      config: undefined as Record<string, unknown> | undefined,
      loadTranslations: undefined,
    },
  };
});

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../condition-store/AsyncLocalConditionStore', () => ({
  AsyncLocalConditionStore: mockStoreConstructor,
}));

import { getConditionStore } from '../../condition-store/singleton';

// The module remembers that it initialized, so each test evaluates it again.
const load = () => import('../initializeGT.server');

type GlobalWithRegistry = {
  __generaltranslation?: {
    tanstackStart?: Record<string, unknown>;
  };
};

function resetConditionStoreSingleton() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

describe('server initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    resetConditionStoreSingleton();
    mockInitializeReactGT.mockReset();
    mockStoreConstructor.mockClear();
  });

  it('initializes React and the request condition store once with the same config', async () => {
    pluginModule.config = { defaultLocale: 'en', locales: ['en', 'fr'] };
    const { ensureInitialized } = await load();

    ensureInitialized();
    ensureInitialized();

    expect(mockInitializeReactGT).toHaveBeenCalledOnce();
    expect(mockStoreConstructor).toHaveBeenCalledWith(
      mockInitializeReactGT.mock.calls[0][0]
    );
    expect(getConditionStore()).toBe(mockConditionStore);
  });

  it('initializes again when the module is evaluated again, as after a Vite dev server restart', async () => {
    pluginModule.config = { defaultLocale: 'en', locales: ['en', 'fr'] };
    (await load()).ensureInitialized();

    vi.resetModules();
    (await load()).ensureInitialized();

    expect(mockInitializeReactGT).toHaveBeenCalledTimes(2);
    expect(mockStoreConstructor).toHaveBeenCalledTimes(2);
  });

  it('does nothing without the plugin', async () => {
    pluginModule.config = undefined;
    const { ensureInitialized, isLocaleRoutingEnabled } = await load();

    ensureInitialized();

    expect(mockInitializeReactGT).not.toHaveBeenCalled();
    expect(isLocaleRoutingEnabled()).toBe(false);
  });

  it('reads locale routing from the initialized condition store', async () => {
    const { ensureInitialized, isLocaleRoutingEnabled } = await load();
    expect(isLocaleRoutingEnabled()).toBe(false);

    pluginModule.config = {
      defaultLocale: 'en',
      locales: ['en'],
      localeRouting: true,
    };
    ensureInitialized();
    expect(isLocaleRoutingEnabled()).toBe(true);

    mockConditionStore.isLocaleRoutingEnabled.mockReturnValue(false);
    expect(isLocaleRoutingEnabled()).toBe(false);
  });
});
