import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockAddRuntimeCredentials,
  mockCreateConditionStore,
  mockInternalInitializeGTSRA,
} = vi.hoisted(() => ({
  mockAddRuntimeCredentials: vi.fn(),
  mockCreateConditionStore: vi.fn(),
  mockInternalInitializeGTSRA: vi.fn(),
}));

vi.mock('@generaltranslation/react-core/pure', () => ({
  internalInitializeGTSRA: mockInternalInitializeGTSRA,
}));

vi.mock('../../condition-store/createBrowserConditionStore', () => ({
  createOrUpdateBrowserConditionStore: mockCreateConditionStore,
}));

vi.mock('../runtimeCredentials', () => ({
  addRuntimeCredentials: mockAddRuntimeCredentials,
}));

import { initializeGTSRAClient } from '../initializeGTSRAClient';

describe('initializeGTSRAClient', () => {
  beforeEach(() => {
    mockAddRuntimeCredentials.mockReset();
    mockCreateConditionStore.mockReset();
    mockInternalInitializeGTSRA.mockReset();
  });

  it('initializes React and the browser condition store with the same config', () => {
    const runtimeConfig = {
      cacheExpiryTime: null,
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      locale: 'fr',
      projectId: 'project-id',
    };
    mockAddRuntimeCredentials.mockReturnValue(runtimeConfig);

    initializeGTSRAClient({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      locale: 'fr',
    });

    expect(mockAddRuntimeCredentials).toHaveBeenCalledWith({
      cacheExpiryTime: null,
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      locale: 'fr',
    });
    expect(mockInternalInitializeGTSRA).toHaveBeenCalledWith(runtimeConfig);
    expect(mockCreateConditionStore).toHaveBeenCalledWith(runtimeConfig);
  });
});
