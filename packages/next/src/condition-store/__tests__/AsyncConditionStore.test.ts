import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncConditionStore } from '../AsyncConditionStore';

const { mockCookies, mockHeaders } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockHeaders: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: mockCookies,
  headers: mockHeaders,
}));

describe('App Router enable-i18n state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, false, true])(
    'reads the configured value (%s) without request-time APIs',
    async (enableI18n) => {
      const store = new AsyncConditionStore({ enableI18n });
      await expect(store.getEnableI18n()).resolves.toBe(enableI18n ?? true);
      expect(mockCookies).not.toHaveBeenCalled();
      expect(mockHeaders).not.toHaveBeenCalled();
    }
  );
});
