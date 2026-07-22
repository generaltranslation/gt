import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDetermineLocaleClient, mockInitializeReactGT } = vi.hoisted(() => ({
  mockDetermineLocaleClient: vi.fn(() => 'fr'),
  mockInitializeReactGT: vi.fn(),
}));

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/parseLocale', () => ({
  determineLocaleClient: mockDetermineLocaleClient,
}));

import { initializeGT } from '../initializeGT.client';

describe('initializeGT client', () => {
  beforeEach(() => {
    mockDetermineLocaleClient.mockClear();
    mockInitializeReactGT.mockReset();
  });

  it('initializes React with the cookie locale', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith({
      ...config,
      locale: 'fr',
    });
    expect(mockDetermineLocaleClient).toHaveBeenCalledWith(config);
  });
});
