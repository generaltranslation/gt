import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateConditionStore, mockInitializeReactGT, mockParseLocale } =
  vi.hoisted(() => ({
    mockCreateConditionStore: vi.fn(),
    mockInitializeReactGT: vi.fn(),
    mockParseLocale: vi.fn(() => 'fr'),
  }));

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('gt-react/internal', () => ({
  createOrUpdateBrowserConditionStore: mockCreateConditionStore,
}));

vi.mock('../../functions/parseLocale', () => ({
  parseLocale: mockParseLocale,
}));

import { initializeGT } from '../initializeGT.client';

describe('initializeGT client', () => {
  beforeEach(() => {
    mockCreateConditionStore.mockReset();
    mockInitializeReactGT.mockReset();
    mockParseLocale.mockClear();
  });

  it('initializes React and seeds the browser condition store from the cookie locale', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    };

    initializeGT(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockParseLocale).toHaveBeenCalledOnce();
    expect(mockCreateConditionStore).toHaveBeenCalledWith({
      ...config,
      locale: 'fr',
    });
  });
});
