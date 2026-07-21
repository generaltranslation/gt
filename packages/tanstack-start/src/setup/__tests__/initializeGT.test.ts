import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockConditionStore, mockInitializeReactGT, mockStoreConstructor } =
  vi.hoisted(() => {
    const conditionStore = { id: 'condition-store' };
    return {
      mockConditionStore: conditionStore,
      mockInitializeReactGT: vi.fn(),
      mockStoreConstructor: vi.fn(function () {
        return conditionStore;
      }),
    };
  });

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../condition-store/AsyncLocalConditionStore', () => ({
  AsyncLocalConditionStore: mockStoreConstructor,
}));

import { getConditionStore } from '../../condition-store/singleton';
import { initializeGT } from '../initializeGT';

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

describe.sequential('initializeGT', () => {
  beforeEach(() => {
    resetConditionStoreSingleton();
    mockInitializeReactGT.mockReset();
    mockStoreConstructor.mockClear();
  });

  it('initializes React and the request condition store with the same config', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockStoreConstructor).toHaveBeenCalledWith(config);
    expect(getConditionStore()).toBe(mockConditionStore);
  });
});
