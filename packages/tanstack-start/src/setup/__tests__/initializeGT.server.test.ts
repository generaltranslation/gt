import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInitializeReactGT, mockInitializeRequestConditions } = vi.hoisted(
  () => ({
    mockInitializeReactGT: vi.fn(),
    mockInitializeRequestConditions: vi.fn(),
  })
);

vi.mock('gt-react', () => ({
  initializeGT: mockInitializeReactGT,
}));

vi.mock('../../functions/requestConditions', () => ({
  initializeRequestConditions: mockInitializeRequestConditions,
}));

import { initializeGT } from '../initializeGT.server';

describe('initializeGT server', () => {
  beforeEach(() => {
    mockInitializeReactGT.mockReset();
    mockInitializeRequestConditions.mockReset();
  });

  it('initializes React and request conditions with the same config', () => {
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      localeRouting: true,
    };

    initializeGT(config);

    expect(mockInitializeReactGT).toHaveBeenCalledWith(config);
    expect(mockInitializeRequestConditions).toHaveBeenCalledWith(true);
  });
});
