import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInitializeReactGT, mockParseLocale } = vi.hoisted(() => ({
  mockInitializeReactGT: vi.fn(),
  mockParseLocale: vi.fn(() => 'fr'),
}));

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/parseLocale', () => ({
  parseLocale: mockParseLocale,
}));

import { initializeGT } from '../initializeGT.client';

describe('initializeGT client', () => {
  beforeEach(() => {
    mockInitializeReactGT.mockReset();
    mockParseLocale.mockClear();
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
    expect(mockParseLocale).toHaveBeenCalledOnce();
  });
});
