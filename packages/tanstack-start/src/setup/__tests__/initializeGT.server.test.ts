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
      dictionary: undefined,
      loadDictionary: undefined,
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
import {
  ensureInitialized,
  isLocaleRoutingEnabled,
} from '../initializeGT.server';

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

describe.sequential('server initialization', () => {
  beforeEach(() => {
    resetConditionStoreSingleton();
    mockInitializeReactGT.mockReset();
    mockStoreConstructor.mockClear();
  });

  it('initializes React and the request condition store once with the same config', () => {
    pluginModule.config = { defaultLocale: 'en', locales: ['en', 'fr'] };

    ensureInitialized();
    ensureInitialized();

    expect(mockInitializeReactGT).toHaveBeenCalledOnce();
    expect(mockStoreConstructor).toHaveBeenCalledWith(
      mockInitializeReactGT.mock.calls[0][0]
    );
    expect(getConditionStore()).toBe(mockConditionStore);
  });

  it('does nothing without the plugin', () => {
    pluginModule.config = undefined;

    ensureInitialized();

    expect(mockInitializeReactGT).not.toHaveBeenCalled();
    expect(isLocaleRoutingEnabled()).toBe(false);
  });

  it('reads locale routing from the initialized condition store', () => {
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
