import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetLocale = vi.hoisted(() => vi.fn(() => 'fr'));

vi.mock('../runtime', () => ({
  getLocale: mockGetLocale,
}));

import { parseLocale } from '../parseLocale';

describe('parseLocale', () => {
  beforeEach(() => {
    mockGetLocale.mockClear();
  });

  it('is a deprecated alias for getLocale', () => {
    expect(parseLocale()).toBe('fr');
    expect(mockGetLocale).toHaveBeenCalledOnce();
  });
});
