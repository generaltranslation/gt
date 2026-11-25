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

describe('AsyncConditionStore.hasRequestLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['a request', new Headers({ 'accept-language': 'fr' }), true],
    ['no request, as in a static render', new Headers(), false],
  ])(
    'with the default getLocale, reads the headers of %s',
    async (_name, requestHeaders, expected) => {
      mockHeaders.mockResolvedValue(requestHeaders);
      await expect(
        new AsyncConditionStore({}).hasRequestLocale()
      ).resolves.toBe(expected);
    }
  );

  it('has one when a locale was registered, without reading the headers', async () => {
    const store = new AsyncConditionStore({});
    store.enterWith('fr');
    await expect(store.hasRequestLocale()).resolves.toBe(true);
    expect(mockHeaders).not.toHaveBeenCalled();
  });

  it('has one with a custom getLocale, without reading the headers', async () => {
    const store = new AsyncConditionStore({ getLocale: async () => 'fr' });
    await expect(store.hasRequestLocale()).resolves.toBe(true);
    expect(mockHeaders).not.toHaveBeenCalled();
  });
});
