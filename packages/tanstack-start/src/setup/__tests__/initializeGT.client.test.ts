import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateOrUpdateBrowserConditionStore,
  mockDetermineLocaleClient,
  mockInitializeReactGT,
} = vi.hoisted(() => ({
  mockCreateOrUpdateBrowserConditionStore: vi.fn(),
  mockDetermineLocaleClient: vi.fn(() => 'fr'),
  mockInitializeReactGT: vi.fn(),
}));

vi.mock('gt-react', () => ({
  createOrUpdateBrowserConditionStore: mockCreateOrUpdateBrowserConditionStore,
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/parseLocale', () => ({
  determineLocaleClient: mockDetermineLocaleClient,
}));

import { initializeGT } from '../initializeGT.client';

describe('initializeGT client', () => {
  beforeEach(() => {
    mockCreateOrUpdateBrowserConditionStore.mockReset();
    mockDetermineLocaleClient.mockClear();
    mockInitializeReactGT.mockReset();
  });

  it('initializes React with the cookie locale', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

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
});
